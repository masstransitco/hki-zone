// lib/fetchCarparkListings.ts
import { createClient } from '@supabase/supabase-js';

const url  =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';
const anon =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';
if (!url || !anon) throw new Error('Missing Supabase envs');

const sb = createClient(url, anon);

// Adjustable sanity cap for numeric prices
const PRICE_CAP = Number(process.env.CARPARK_PRICE_CAP_HKD ?? 20_000_000);

// ---------------------------------------------
// Helpers
// ---------------------------------------------
function cleanTitle(str?: string | null): string | null {
  if (!str) return null;
  const cleaned = str.replace(/\s*#\d+.*$/i, '').trim();
  return cleaned || null;
}

function parseHumanPrice(raw?: string | null): number | null {
  if (!raw) return null;
  const txt = raw.replace(/,/g, '').trim();
  // detect 萬 (ten-thousands)
  const hasWan = /萬/.test(txt);
  const hasM   = /M/i.test(txt) || /Millions?/i.test(txt);

  // grab first number-ish chunk
  const m = txt.match(/[\d.]+/);
  if (!m) return null;
  let num = Number(m[0]);
  if (!isFinite(num)) return null;

  if (hasWan) {
    // 1 萬 = 10,000
    num = num * 10_000;
  } else if (hasM) {
    num = num * 1_000_000;
  }
  return num;
}

function safePriceDisplay(
  priceNum: number | null | undefined,
  rawTxt: string | null
): { num: number | null; text: string | null; isNumeric: boolean } {
  let num: number | null =
    priceNum != null && priceNum > 0 && priceNum <= PRICE_CAP
      ? priceNum
      : null;

  let text = rawTxt;
  if (!num && rawTxt) {
    const parsed = parseHumanPrice(rawTxt);
    if (parsed != null && parsed > 0 && parsed <= PRICE_CAP) {
      num = parsed;
    }
  }

  return {
    num,
    text,
    isNumeric: num != null,
  };
}

// ---------------------------------------------
// Main fetch
// ---------------------------------------------
type FetchOpts = {
  district?: string;
  limit?: number;
  offset?: number;
  includePayload?: boolean;      // default false
  includeDescription?: boolean;  // default false
};

export async function fetchCarparkListings({
  district,
  limit = 50,
  offset = 0,
  includePayload = false,
  includeDescription = false,
}: FetchOpts = {}) {
  // Columns: always fetch core; add heavy cols conditionally
  const cols = [
    'listing_id',
    'estate_name',
    'subdistrict_raw',
    'district_norm',
    'price_hkd_src',
    'price_hkd',
    'cover_image_url',
    'building_age',
    'agency_name',
    'license_no',
    'detail_url',
  ];
  if (includeDescription) cols.push('description');
  if (includePayload) cols.push('payload');

  const end = offset + limit - 1;

  let q = sb
    .from('carpark_listings')
    .select(cols.join(','))
    .eq('is_active', true)
    .order('last_seen_at', { ascending: false })
    .range(offset, end);

  if (district) q = q.eq('district_norm', district);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((r: any) => {
    const p = includePayload ? (r.payload ?? {}) : undefined;

    const en_est = cleanTitle(p?.i18n?.en?.detailTitle);
    const zh_est = cleanTitle(p?.i18n?.zh?.detailTitle);

    // Pick best estate label:
    // prefer English if present (better UX in mixed-language UI)
    const estate_display =
      en_est ??
      r.estate_name ??
      zh_est ??
      '(Unknown Estate)';

    // Show both if needed
    const estate_display_en = en_est ?? null;
    const estate_display_zh = zh_est ?? null;

    // Price fallback text from payload (only fetched if includePayload)
    const priceTxt =
      (p?.priceText as string | undefined) ??
      (p?.i18n?.en?.price?.raw as string | undefined) ??
      (p?.i18n?.zh?.price?.raw as string | undefined) ??
      null;

    const { num: safeNum, text: safeTxt, isNumeric } = safePriceDisplay(
      r.price_hkd_src ?? r.price_hkd,
      priceTxt
    );

    return {
      ...r,
      estate_display,
      estate_display_en,
      estate_display_zh,
      price_display: safeNum ?? safeTxt ?? null, // primary for UI sorting: number if sane; else text
      price_display_num: safeNum,                // explicit numeric
      price_display_text: safeTxt,
      price_is_numeric: isNumeric,
      ...(includePayload ? { payload: p } : {}),
    };
  });
}