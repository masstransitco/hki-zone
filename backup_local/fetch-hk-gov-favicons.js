#!/usr/bin/env node
/**
 * fetch-hk-gov-favicons.js
 * ------------------------------------------------------------
 * One-off grabber that:
 *   1️⃣  Scrapes the GovHK directory for every *.gov.hk* website
 *   2️⃣  For each site, discovers <link rel="icon">, manifest icons,
 *       and /favicon.ico, ranks the candidates, and saves the best.
 *   3️⃣  Writes <slug>.<ext> in the chosen output folder and a
 *       meta.json per site plus a manifest for the whole run.
 *
 * Node ≥18 (built-in fetch) recommended, but axios used anyway.
 * Dependencies: axios cheerio fs-extra minimist
 * ------------------------------------------------------------
 */

const path      = require('path');
const fs        = require('fs');
const fse       = require('fs-extra');
const axios     = require('axios');
const cheerio   = require('cheerio');
const minimist  = require('minimist');
const { URL }   = require('url');

// ───────────────────────────────────────────────────────────────
// CLI
// ----------------------------------------------------------------
const argv = minimist(process.argv.slice(2), {
  string : ['out'],
  boolean: ['list','verbose','debug'],
  alias  : { o:'out', v:'verbose' },
  default: { out:'./favicons-output', verbose:false, debug:false }
});
const OUTDIR = path.resolve(argv.out);
function log  (...a){ if (argv.verbose) console.log(...a); }
function debug(...a){ if (argv.debug ) console.log('[debug]', ...a); }

// ───────────────────────────────────────────────────────────────
// 1. Auto-discover *.gov.hk sites
// ----------------------------------------------------------------
async function discoverGovOutlets() {
  const DIR_URL = 'https://www.gov.hk/en/about/govdirectory/govwebsite/alphabetical.htm';
  log(`[dir] Fetching directory  ${DIR_URL}`);
  const res  = await axios.get(DIR_URL, { timeout:15000, responseType:'text' });
  const $    = cheerio.load(res.data);
  const seen = new Set(), outlets = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || !href.includes('.gov.hk')) return;
    const absolute = new URL(href, DIR_URL).href;
    const host     = new URL(absolute).hostname.toLowerCase();
    if (seen.has(host)) return;
    seen.add(host);

    let slug = host.replace(/^www\./,'')
                   .replace(/\.gov\.hk$/,'')
                   .replace(/[^a-z0-9]/g,'_')
                   .replace(/^_+|_+$/g,'');
    if (!slug) slug = host.replace(/\./g,'_');
    outlets.push({ slug, url: absolute });
  });

  outlets.sort((a,b) => a.slug.localeCompare(b.slug));
  return outlets;
}

// ───────────────────────────────────────────────────────────────
// 2. Utility helpers
// ----------------------------------------------------------------
const UA = 'HKI-gov-favicon/1.0 (+https://github.com/your/project)';
function originOf(u){ try{ return new URL(u).origin; }catch{ return null; } }
function resolveUrl(base, rel){ try{ return new URL(rel, base).href; }catch{ return null; } }

function guessExtFromMime(m=''){
  m = m.toLowerCase();
  if (m.includes('svg'))           return 'svg';
  if (m.includes('png'))           return 'png';
  if (m.includes('jpeg')||m.includes('jpg')) return 'jpg';
  if (m.includes('webp'))          return 'webp';
  if (m.includes('gif'))           return 'gif';
  if (m.includes('icon')||m.includes('ico'))  return 'ico';
  return '';
}
function guessExtFromUrl(u=''){
  const q = u.split('?')[0].toLowerCase();
  if (q.endsWith('.svg'))  return 'svg';
  if (q.endsWith('.png'))  return 'png';
  if (q.endsWith('.jpg') || q.endsWith('.jpeg')) return 'jpg';
  if (q.endsWith('.webp')) return 'webp';
  if (q.endsWith('.gif'))  return 'gif';
  if (q.endsWith('.ico') || q.endsWith('.cur'))  return 'ico';
  return '';
}
function parseSizesAttr(s=''){
  return s.split(/\s+/).map(x=>x.trim()).filter(Boolean).map(x=>{
    const [w,h] = x.split('x').map(n=>parseInt(n,10)||0);
    return { w, h };
  });
}

async function fetchHtml(url){
  try {
    const r = await axios.get(url, {
      timeout:15000, responseType:'text', maxRedirects:5,
      headers:{ 'User-Agent': UA }
    });
    return r.data;
  } catch { return ''; }
}
async function fetchBin(url){
  try {
    const r = await axios.get(url, {
      timeout:20000, responseType:'arraybuffer', maxRedirects:5,
      headers:{ 'User-Agent': UA }
    });
    return { ok:true, status:r.status, mime:r.headers['content-type']||'', buf:Buffer.from(r.data) };
  } catch (e){
    return { ok:false, error:String(e) };
  }
}

// ───────────────────────────────────────────────────────────────
// 3. Favicon discovery + ranking
// ----------------------------------------------------------------
async function discoverIcons(pageUrl, html) {
  const out = [];
  const $ = html ? cheerio.load(html) : null;

  if ($) {
    //  <link rel="icon">, apple-touch-icon, mask-icon …
    $('link').each((_, el) => {
      const rel = ($(el).attr('rel') || '').toLowerCase();
      if (!rel) return;
      if (/icon|shortcut|apple-touch-icon|mask-icon/.test(rel)) {
        const href = $(el).attr('href');
        if (!href) return;
        out.push({
          source:'html',
          rel,
          href : resolveUrl(pageUrl, href),
          sizes: $(el).attr('sizes') || '',
          type : $(el).attr('type')  || ''
        });
      }
    });

    // Manifest icons
    const manifestHref = $('link[rel="manifest"]').attr('href');
    if (manifestHref) {
      const manifestUrl = resolveUrl(pageUrl, manifestHref);
      try {
        const mRes = await axios.get(manifestUrl, { timeout:10000 });
        const manifest = typeof mRes.data === 'string'
          ? JSON.parse(mRes.data) : mRes.data;
        if (Array.isArray(manifest.icons)) {
          manifest.icons.forEach(ic => {
            if (!ic.src) return;
            out.push({
              source :'manifest',
              rel    :'manifest-icon',
              href   : resolveUrl(manifestUrl, ic.src),
              sizes  : ic.sizes  || '',
              type   : ic.type   || '',
              purpose: ic.purpose|| ''
            });
          });
        }
      } catch { /* ignore bad / absent manifests */ }
    }
  }

  // Fallback /favicon.ico
  const root = originOf(pageUrl);
  if (root) {
    out.push({ source:'default', rel:'icon', href:`${root}/favicon.ico`, sizes:'', type:'' });
  }

  // Deduplicate by href
  const seen = new Set();
  return out.filter(c => c.href && !seen.has(c.href) && seen.add(c.href));
}

function rankCandidates(cands) {
  const score = c => {
    let s = 0;
    const ext = c.ext || c.extGuess || '';

    // Format weight
    if (ext === 'svg')        s += 5000;
    else if (ext === 'png')   s += 4000;
    else if (ext === 'webp')  s += 3500;
    else if (ext === 'jpg')   s += 3000;
    else if (ext === 'gif')   s += 2000;
    else if (ext === 'ico')   s += 1000;

    // Larger declared size preferred
    const areas = parseSizesAttr(c.sizes);
    if (areas.length) {
      const maxA = areas.reduce((m,a)=>Math.max(m, a.w*a.h), 0);
      s += maxA;
    }

    // Source weight
    if (c.source === 'html')      s += 50;
    else if (c.source === 'manifest') s += 25;
    else if (c.source === 'default')  s += 10;

    return s;
  };
  return [...cands].sort((a,b) => score(b) - score(a));
}

// ───────────────────────────────────────────────────────────────
// 4. Per-site processing
// ----------------------------------------------------------------
async function processOutlet(outlet) {
  const { slug, url } = outlet;
  log(`\n[${slug}] ${url}`);

  const html   = await fetchHtml(url);
  const cands  = await discoverIcons(url, html) || [];
  // Pre-guess ext before we fetch
  cands.forEach(c => c.extGuess = guessExtFromUrl(c.href));

  // Download each icon
  for (const c of cands) {
    const r = await fetchBin(c.href);
    if (!r.ok) { c.fetchOk=false; c.error=r.error; continue; }
    Object.assign(c, r, {
      fetchOk:true,
      ext: guessExtFromMime(r.mime) || c.extGuess || 'bin',
      bytes: r.buf.length
    });
  }

  // Google fallback if nothing worked
  if (!cands.some(c => c.fetchOk)) {
    const fallback = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(url).hostname)}&sz=128`;
    const r = await fetchBin(fallback);
    if (r.ok) cands.push({
      source :'google-s2',
      rel    :'icon',
      href   : fallback,
      fetchOk: true,
      status : r.status,
      mime   : r.mime,
      buf    : r.buf,
      ext    : guessExtFromMime(r.mime) || 'png',
      bytes  : r.buf.length
    });
  }

  const best = rankCandidates(cands.filter(c => c.fetchOk))[0] || null;

  // ── Write files
  const dir    = path.join(OUTDIR, slug);
  const rawDir = path.join(dir, 'raw');
  await fse.ensureDir(rawDir, { recursive:true });

  for (let i=0; i<cands.length; i++) {
    const c = cands[i];
    if (!c.fetchOk) continue;
    const fname = `icon-${i}.${c.ext || 'bin'}`;
    await fs.promises.writeFile(path.join(rawDir, fname), c.buf);
    c.saved = `raw/${fname}`;
  }

  if (best) {
    const bestName = `${slug}.${best.ext || 'bin'}`;
    await fs.promises.writeFile(path.join(OUTDIR, bestName), best.buf);
    best.bestSaved = bestName;
  }

  await fs.promises.writeFile(
    path.join(dir, 'meta.json'),
    JSON.stringify({
      slug, url,
      picked    : best ? { href:best.href, ext:best.ext, mime:best.mime, bytes:best.bytes, file:best.bestSaved } : null,
      candidates: cands.map(c => ({
        source: c.source, rel: c.rel, href: c.href, ok: !!c.fetchOk,
        ext   : c.ext || c.extGuess || '', mime: c.mime || '',
        bytes : c.bytes || 0, file: c.saved || null, error: c.error || null
      })),
      notes: best ? undefined : 'No icon found'
    }, null, 2)
  );
}

// ───────────────────────────────────────────────────────────────
// 5. Main
// ----------------------------------------------------------------
(async function main() {
  await fse.ensureDir(OUTDIR, { recursive:true });

  const OUTLETS = await discoverGovOutlets();

  if (argv.list) {
    console.log('HKSAR Government sites discovered:');
    OUTLETS.forEach(o => console.log(` - ${o.slug}\t${o.url}`));
    process.exit(0);
  }

  const done = [];
  for (const o of OUTLETS) {
    try   { await processOutlet(o); done.push(o.slug); }
    catch (e) { console.error(`[${o.slug}] ERROR`, e); }
  }

  // Manifest for the whole batch
  await fs.promises.writeFile(
    path.join(OUTDIR, 'manifest.json'),
    JSON.stringify(Object.fromEntries(done.map(s => [s, { file:`${s}.*` }])), null, 2)
  );

  console.log(`\nDone. Saved icons for ${done.length} gov.hk domains in ${OUTDIR}`);
})();