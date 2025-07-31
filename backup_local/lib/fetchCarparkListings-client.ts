import { createClient } from '@supabase/supabase-js';

const PUBLIC_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLIC_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const sbClient = createClient(PUBLIC_URL, PUBLIC_ANON);

export type CarparkListingRow = {
  listing_id: string;
  estate_name: string | null;
  subdistrict_raw: string | null;
  district_norm: string | null;
  price_hkd_src: number | null;
  price_hkd: number | null;
  cover_image_url: string | null;
  building_age: number | null;
  agency_name: string | null;
  license_no: string | null;
  detail_url: string | null;
  description?: string | null;
  payload?: any;
};

export interface FetchClientOpts {
  district?: string;
  limit?: number;
  offset?: number;
  includeDescription?: boolean;
  includePayload?: boolean;
}

export async function fetchClientCarparks(opts: FetchClientOpts = {}): Promise<CarparkListingRow[]> {
  const {
    district,
    limit = 20,
    offset = 0,
    includeDescription = false,
    includePayload = false,
  } = opts;

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

  let q = sbClient
    .from('carpark_listings')
    .select(cols.join(','))
    .eq('is_active', true)
    .order('last_seen_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (district) q = q.eq('district_norm', district);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}