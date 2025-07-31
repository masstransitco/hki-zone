import { fetchCarparkListings } from '../lib/fetchCarparkListings';

function slim(list: any) {
  // Only pick the handful of fields you care about when eyeballing
  const {
    listing_id,
    estate_display,
    estate_name,
    district_norm,
    subdistrict_raw,
    price_display,
    price_hkd_src,
    price_hkd,
    cover_image_url,
  } = list;
  return {
    listing_id,
    estate_display,
    estate_name,
    district_norm,
    subdistrict_raw,
    price_display,
    price_hkd_src,
    price_hkd,
    cover_image_url,
  };
}

async function run() {
  console.log('Testing fetchCarparkListings…');

  const all = await fetchCarparkListings({ limit: 5 });
  console.log('--- First 5 listings (slim) ---');
  console.dir(all.map(slim), { depth: null });

  const kow = await fetchCarparkListings({ district: 'KOWLOON', limit: 5 });
  console.log('--- First 5 KOWLOON (slim) ---');
  console.dir(kow.map(slim), { depth: null });

  const page2 = await fetchCarparkListings({ limit: 5, offset: 5 });
  console.log('--- Page 2 (slim) ---');
  console.dir(page2.map(slim), { depth: null });
}

run().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});