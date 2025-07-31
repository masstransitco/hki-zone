// fetch-parks.js  — Node ≥18  (ESM)

import fs     from 'node:fs/promises';
import fetch  from 'node-fetch';

const service =
  'https://services3.arcgis.com/6j1KwZfY2fZrfNMR/ArcGIS/rest/services/' +
  'Parks_Zoos_and_Gardens_in_Hong_Kong/FeatureServer/0/query';

const params = new URLSearchParams({
  f: 'json',
  where: '1=1',           // all 65 rows
  outFields: '*',         // every attribute (safe)
  returnGeometry: 'true',
  outSR: '4326'           // get lat/lon directly
});

const res  = await fetch(`${service}?${params.toString()}`);
const json = await res.json();

if (!json.features) {
  throw new Error(
    `ArcGIS query failed (${json.error?.code ?? '??'}): ` +
    `${json.error?.message ?? JSON.stringify(json).slice(0,200)}`
  );
}

const parks = json.features.map(f => ({
  name_en:  f.attributes.NAME_ENG ?? f.attributes.Name_Eng ?? f.attributes.NAME_EN,
  name_tc:  f.attributes.NAME_TC  ?? f.attributes.Name_Tc,
  address:  f.attributes.ADDRESS  ?? f.attributes.Address,
  latitude:  f.geometry?.y,
  longitude: f.geometry?.x
}));

await fs.writeFile('parks_hk.json', JSON.stringify(parks, null, 2));
console.log(`✨  Saved ${parks.length} parks to parks_hk.json`);