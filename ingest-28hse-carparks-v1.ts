// ingest-28hse-carparks-v1.ts
import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://egyuetfeubznhcvmtary.supabase.co"
const SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVneXVldGZldWJ6bmhjdm10YXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTM3NTAwNSwiZXhwIjoyMDY2OTUxMDA1fQ.euSeh4C7FDt3vLWkBm1nt9wjxo8ZH25hQqAGNyW1gaA"
const JSON_PATH    = process.env.JSON_PATH || './28hse-carparks.json';

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function main () {
  const raw = await fs.readFile(JSON_PATH, 'utf8');
  const arr = JSON.parse(raw);
  if (!Array.isArray(arr)) throw new Error('JSON must be an array');

  const seenIds: string[] = [];

  for (const o of arr) {
    const id = o.listingId;
    if (!id) continue;
    seenIds.push(String(id));

    // ingest (normalized + raw append)
    const { error: ingErr } = await sb.rpc('ingest_carpark_json', { _payload: o });
    if (ingErr) {
      console.error('ingest error', id, ingErr);
      continue;
    }

    // sync media
    const { error: medErr } = await sb.rpc('sync_carpark_media', { _listing_id: id, _payload: o });
    if (medErr) console.error('media error', id, medErr);
  }

  // mark stale
  if (seenIds.length) {
    const { error: staleErr } = await sb.rpc('mark_carparks_inactive', { _active_ids: seenIds });
    if (staleErr) console.error('mark inactive error', staleErr);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});