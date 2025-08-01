// app/api/admin/generate-openai-image/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

// ---------- CONFIG ----------
const OPENAI_TIMEOUT_MS = 300_000; // allow long image jobs
const DEFAULT_SIZE = '1792x1024'; // 16:9
const BUCKET = process.env.HKI_IMAGE_BUCKET || 'public'; // change if needed
const PREFIX = process.env.HKI_IMAGE_PREFIX || 'hki/generated';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: OPENAI_TIMEOUT_MS,
});

// Prompt baseline if caller does not supply one
const DEFAULT_PROMPT = [
  'Professional news photograph, general news photography, editorial style, photojournalistic quality,',
  'clean composition, professional lighting, high resolution, suitable for digital news publication,',
  'consistent visual identity, standardized news media aesthetic, no text overlays, no watermarks,',
  'no brand logos, realistic and authentic, newsroom-neutral grade, 16:9 aspect ratio',
].join(' ');

// ---------- HELPERS ----------
async function fetchAsBuffer(url: string, abortMs = 60_000): Promise<Buffer> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), abortMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } finally {
    clearTimeout(t);
  }
}

async function preprocessImageToPng(input: Buffer, maxDim = 2048): Promise<Buffer> {
  // Keeps within 2048px limit to reduce transfer & processing time
  return sharp(input)
    .resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
}

async function uploadToSupabase(buffer: Buffer, contentType = 'image/png') {
  const fileName = `${Date.now()}-${randomUUID()}.png`;
  const storagePath = `${PREFIX}/${fileName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return { storagePath, publicUrl: data.publicUrl };
}

async function runWithRetry<T>(fn: () => Promise<T>, tries = 2): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      // Retry only on transient connection failures
      const msg = (e?.message || '').toLowerCase();
      if (
        !msg.includes('apiconnectionerror') &&
        !msg.includes('und_err_socket') &&
        !msg.includes('socket') &&
        !msg.includes('fetch failed') &&
        !msg.includes('timeout')
      ) {
        break;
      }
      await new Promise((r) => setTimeout(r, 1000 * (i + 1) + Math.floor(Math.random() * 500)));
    }
  }
  throw lastErr;
}

// ---------- ROUTE ----------
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let mode: 'generate' | 'edit' = 'generate';
    let prompt = DEFAULT_PROMPT;
    let size = DEFAULT_SIZE;
    let imageBuffer: Buffer | undefined;
    let maskBuffer: Buffer | undefined;

    let articleId: string | number | undefined;
    let dbUpdate:
      | undefined
      | {
          table: string;
          idField: string;
          id: string | number;
          field: string; // column to update with image URL
        };

    if (contentType.startsWith('multipart/form-data')) {
      const form = await req.formData();
      mode = (form.get('mode') as string) === 'edit' ? 'edit' : 'generate';
      prompt = (form.get('prompt') as string) || DEFAULT_PROMPT;
      size = (form.get('size') as string) || DEFAULT_SIZE;
      articleId = (form.get('articleId') as string) || undefined;

      const imageFile = form.get('image') as File | null;
      if (imageFile) {
        const ab = await imageFile.arrayBuffer();
        imageBuffer = Buffer.from(ab);
      }
      const maskFile = form.get('mask') as File | null;
      if (maskFile) {
        const ab = await maskFile.arrayBuffer();
        maskBuffer = Buffer.from(ab);
      }

      // Optional DB update config
      const table = (form.get('db_table') as string) || '';
      const idField = (form.get('db_id_field') as string) || '';
      const id = (form.get('db_id') as string) || '';
      const field = (form.get('db_field') as string) || '';
      if (table && idField && id && field) {
        dbUpdate = { table, idField, id, field };
      }
    } else {
      const body = await req.json();
      mode = body.mode === 'edit' ? 'edit' : 'generate';
      prompt = body.prompt || DEFAULT_PROMPT;
      size = body.size || DEFAULT_SIZE;
      articleId = body.articleId || undefined;

      if (body.imageUrl) {
        imageBuffer = await fetchAsBuffer(body.imageUrl);
      }
      if (body.maskUrl) {
        maskBuffer = await fetchAsBuffer(body.maskUrl);
      }
      if (body.dbUpdate) {
        const { table, idField, id, field } = body.dbUpdate || {};
        if (table && idField && id && field) dbUpdate = { table, idField, id, field };
      }
    }

    // ---- Sanity checks ----
    if (mode === 'edit' && !imageBuffer) {
      return NextResponse.json(
        { error: 'edit mode requires an input image (multipart "image" file or "imageUrl")' },
        { status: 400 },
      );
    }

    // ---- Build OpenAI call ----
    let genBuffer: Buffer;

    if (mode === 'generate') {
      const res = await runWithRetry(() =>
        openai.images.generate({
          model: 'gpt-image-1',
          prompt,
          size,
          // response_format defaults to url; use b64_json for stable upload path
          response_format: 'b64_json',
        }),
      );
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) throw new Error('No image returned from gpt-image-1 generate');
      genBuffer = Buffer.from(b64, 'base64');
    } else {
      // Preprocess input (and mask) to keep sizes reasonable
      const processedImage = await preprocessImageToPng(imageBuffer!);
      const imageFile = await toFile(processedImage, 'input.png');

      let maskFileObj: File | undefined;
      if (maskBuffer) {
        // Ensure mask matches dimensions of processed image; skip strict check for simplicity
        const processedMask = await preprocessImageToPng(maskBuffer);
        maskFileObj = (await toFile(processedMask, 'mask.png')) as unknown as File;
      }

      const res = await runWithRetry(() =>
        openai.images.edits({
          model: 'gpt-image-1',
          prompt,
          image: imageFile,
          ...(maskFileObj ? { mask: maskFileObj } : {}),
          size,
          response_format: 'b64_json',
        }),
      );
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) throw new Error('No image returned from gpt-image-1 edit');
      genBuffer = Buffer.from(b64, 'base64');
    }

    // ---- Upload to Supabase storage ----
    const { publicUrl, storagePath } = await uploadToSupabase(genBuffer, 'image/png');

    // ---- Optional: update a DB record if instructed ----
    if (dbUpdate) {
      const { table, idField, id, field } = dbUpdate;
      const { error: updErr } = await supabase
        .from(table)
        .update({ [field]: publicUrl })
        .eq(idField, id);
      if (updErr) throw updErr;
    }

    console.log('Image generated and uploaded:', { mode, size, storagePath });

    return NextResponse.json({
      success: true,
      mode,
      size,
      imageUrl: publicUrl,
      storagePath,
      articleId: articleId || null,
      message: 'Professional editorial image generated successfully with GPT-Image-1',
    });
  } catch (error: any) {
    console.error('OpenAI image generation error:', error);
    const status = String(error?.message || '').toLowerCase().includes('apiconnectionerror') ? 504 : 500;
    return NextResponse.json(
      { error: error?.message || 'Failed to generate image' },
      { status },
    );
  }
}
