/*  public/police.js  –  v6  ##############################################
    Prereqs  :  npm i node-fetch@3 string-similarity
    package.json must have { "type": "module" }
    Input    :  ./policestations.json
    Output   :  ./hk_police_with_coords.json
######################################################################### */

import fs from "node:fs/promises";
import fetch from "node-fetch";
import similarity from "string-similarity";

const INPUT  = new URL("./policestations.json",        import.meta.url);
const OUTPUT = new URL("./hk_police_with_coords.json", import.meta.url);
const DEBUG  = process.argv.includes("--debug");

/* ───────── helpers ─────────────────────────────────────────────── */
const sleep = ms => new Promise(r => setTimeout(r, ms));

function tidy(str = "") {
  return str
    .toLowerCase()
    .replace(/police\s+(station|post|report(?:ing)?\s+centre|services\s+centre|control\s+point)/g, "")
    .replace(/\b(division|district)\b/g, "")       // ← NEW
    .replace(/[’']/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const stop = new Set(["the", "of", "and", "hong", "kong", "hk"]);
const tokens = s => tidy(s).split(" ").filter(w => !stop.has(w) && w);

/* geometry → lon/lat */
function lonLat(f) {
  const g = f.geometry?.coordinates ?? [];
  if (g.length === 2 && g.every(Number.isFinite)) return { lon: +g[0], lat: +g[1] };
  const p = f.properties ?? {};
  return { lon: +(p.LONGITUDE ?? NaN), lat: +(p.LATITUDE ?? NaN) };
}

/* ───────── manual overrides ────────────────────────────────────── */
const manualByRaw = {
  "police services centre, central district": { lat: 22.281715, lon: 114.155342 },
  "sai kung division":                        { lat: 22.383349, lon: 114.270445 },
  "tseung kwan o district":                   { lat: 22.324094, lon: 114.261171 },
  "kai tak cruise terminal police reporting centre": { lat: 22.303458, lon: 114.217880 },
  "west kowloon station reporting centre":          { lat: 22.306463, lon: 114.158822 },
  "lantau north division":                    { lat: 22.289487, lon: 113.941576 },
  "lantau south (mui wo) division":           { lat: 22.264791, lon: 113.982364 },
  "hong kong–zhuhai–macao bridge hk port police reporting centre": { lat: 22.302555, lon: 113.944005 },
  "penny's bay police post":                  { lat: 22.318540, lon: 114.044220 },
  "shenzhen bay port reporting centre":       { lat: 22.511645, lon: 113.936382 },
  "lo wu control point":                      { lat: 22.541600, lon: 114.113500 },
  "lok ma chau spur line control point":      { lat: 22.509300, lon: 114.049700 },
  "sok kwu wan police post":                  { lat: 22.208400, lon: 114.114600 }
};

const manualByTidy = {
  "marine west":       { lat: 22.370790, lon: 113.971500 },
  "marine west division": { lat: 22.370790, lon: 113.971500 },
  "marine north":      { lat: 22.418800, lon: 114.205200 },
  "marine north division": { lat: 22.418800, lon: 114.205200 },
  "marine harbour":    { lat: 22.284420, lon: 114.216230 },
  "marine harbour division": { lat: 22.284420, lon: 114.216230 }
};

/* ───────── 1) core list ────────────────────────────────────────── */
const stations = JSON.parse(await fs.readFile(INPUT, "utf8"));

/* ───────── 2) ArcGIS layer ────────────────────────────────────── */
const arcURL =
  "https://opendata.arcgis.com/datasets/a795bc851b4747198e9cdb42c4cbe620_0.geojson";

const arc = await fetch(arcURL, { timeout: 15000 }).then(r => r.json()).catch(() => ({}));
console.log(`✅ ArcGIS mirror: ${arc.features?.length ?? 0} features`);

const arcRows = (arc.features ?? []).map(f => {
  const p = f.properties ?? {};
  const rawName =
    p.STATION_N || p.ENGLISH_N || p.ENG_NAME || p.ENGLISH_NAM ||
    p.ENG_NME   || p.CNAME     || p.NAME_EN  || "";
  const rawAddr = p.ADDRESS    || p.ADDRESS_1 || p.ADDRESS_EN || "";
  const { lat, lon } = lonLat(f);
  return { nameTokens: tokens(rawName), addrTokens: tokens(rawAddr), lat, lon };
});

function bestArc(nameT, addrT) {
  let best = { score: 0, lat: null, lon: null };
  for (const r of arcRows) {
    const sc = Math.max(
      similarity.compareTwoStrings(nameT.join(" "), r.nameTokens.join(" ")),
      similarity.compareTwoStrings(addrT.join(" "), r.addrTokens.join(" "))
    );
    if (sc > best.score) best = { score: sc, lat: r.lat, lon: r.lon };
  }
  return best;
}

/* ───────── 3) merge all sources ───────────────────────────────── */
let fromArc = 0, fromManual = 0, fromNom = 0;

for (const st of stations) {
  const rawKey  = st.name.toLowerCase();
  const tidyKey = tidy(st.name);
  const nameT   = tokens(st.name);
  const addrT   = tokens(st.address);

  /* A) manual by raw name */
  if (manualByRaw[rawKey]) {
    Object.assign(st, { latitude: manualByRaw[rawKey].lat, longitude: manualByRaw[rawKey].lon });
    fromManual++;  continue;
  }

  /* B) manual by tidy key */
  if (manualByTidy[tidyKey]) {
    Object.assign(st, { latitude: manualByTidy[tidyKey].lat, longitude: manualByTidy[tidyKey].lon });
    fromManual++;  continue;
  }

  /* C) ArcGIS token similarity */
  const best = bestArc(nameT, addrT);
  if (best.score >= 0.30 && Number.isFinite(best.lat)) {
    Object.assign(st, { latitude: best.lat, longitude: best.lon });
    fromArc++;  continue;
  }

  /* D) Nominatim fallback */
  const url = "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({ q: st.address + ", Hong Kong", format: "json", limit: 1 });
  try {
    const [g] = await fetch(url, {
      headers: { "User-Agent": "MTC-HKI-police-geocoder/1.0 (+email@example.com)" },
      timeout: 15000
    }).then(r => r.json());
    if (g) {
      Object.assign(st, { latitude: +g.lat, longitude: +g.lon });
      fromNom++;
    } else {
      st.latitude = st.longitude = null;
    }
  } catch { st.latitude = st.longitude = null; }
  await sleep(1100);
}

/* ───────── 4) write output ───────────────────────────────────── */
await fs.writeFile(OUTPUT, JSON.stringify(stations, null, 2));
const nulls = stations.filter(s => s.latitude == null).length;

console.log(
  `✨ 63 stations → ${OUTPUT.pathname}\n` +
  `   ↳ ${fromArc} ArcGIS • ${fromManual} manual • ${fromNom} Nominatim • ${nulls} still null`
);

if (DEBUG && nulls) {
  console.log("\n⚠️  Remaining nulls:");
  stations.filter(s => s.latitude == null).forEach(s => console.log(" •", s.name));
}