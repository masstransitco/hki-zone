#!/usr/bin/env node
/**
 * fetch-hk-news-favicons.js (one-off grabber)
 * ------------------------------------------------------------
 * Quick utility to fetch ONE best small icon (favicon.svg/png/ico)
 * for a curated list of Hong Kong news / media outlets and save
 * them locally under a fixed naming convention for HKI attribution.
 *
 * ❑ Design goals (per Mark request):
 *   - **One-time run** (not a recurring updater) – simplicity > plumbing.
 *   - Pull each outlet homepage HTML; discover icon <link> tags + manifest.
 *   - Prefer SVG logo if exposed; else largest PNG; else any icon; else fallback /favicon.ico.
 *   - Save the chosen file as `<slug>.<ext>` in an output folder (default: ./favicons-output).
 *   - Also emit a JSON summary mapping slug → { url, picked, candidates, notes }.
 *   - Minimal dependencies; **no sharp**, **no icojs** (we won't parse ICO frames, just save raw).
 *
 * Usage:
 *   node fetch-hk-news-favicons.js                 # uses default output ./favicons-output
 *   node fetch-hk-news-favicons.js --out ./icons   # custom output dir
 *   node fetch-hk-news-favicons.js --list          # print outlet list & exit
 *
 * Node version: ≥18 recommended (fetch available but we use axios).
 *
 * Deps to install:
 *   npm install axios cheerio fs-extra minimist
 *
 * ------------------------------------------------------------
 */

const path      = require('path');
const fs        = require('fs');
const fse       = require('fs-extra');
const axios     = require('axios');
const cheerio   = require('cheerio');
const minimist  = require('minimist');
const { URL }   = require('url');

// ────────────────────────────────────────────────────────────────
// 1. Curated Outlet List (edit as needed)
//    slug: lowercase safe filename prefix; url: canonical homepage
// ----------------------------------------------------------------
const OUTLETS = [
  { slug:'hk01',          url:'https://www.hk01.com/' },
  { slug:'hkfp',          url:'https://hongkongfp.com/' },
  { slug:'rthk',          url:'https://www.rthk.hk/' },
  { slug:'singtao',       url:'https://www.stheadline.com/' }, // Sing Tao / Headline Daily network
  { slug:'mingpao',       url:'https://news.mingpao.com/' },
  { slug:'oriental',      url:'https://orientaldaily.on.cc/' },
  { slug:'standard',      url:'https://www.thestandard.com.hk/' },
  { slug:'scmp',          url:'https://www.scmp.com/' },
  { slug:'nownews',       url:'https://news.now.com/' },
  { slug:'tvb',           url:'https://news.tvb.com/' },
  { slug:'inmedia',       url:'https://www.inmediahk.net/' },
  { slug:'coconutshk',    url:'https://coconuts.co/hongkong/' },
  { slug:'newsgov',       url:'https://www.news.gov.hk/' },
  { slug:'hkej',          url:'https://www1.hkej.com/' },
  { slug:'bastille',      url:'https://www.bastillepost.com/' },
  { slug:'metroradio',    url:'https://www.metroradio.com.hk/' },
  { slug:'crhk',          url:'https://www.881903.com/' },
  { slug:'am730',         url:'https://www.am730.com.hk/' },
  // add / comment out below if needed
  // { slug:'appledaily', url:'https://hk.appledaily.com/' }, // mostly archive; may 404 icons
];

// ────────────────────────────────────────────────────────────────
// 2. CLI Args
// ----------------------------------------------------------------
const argv = minimist(process.argv.slice(2), {
  string:['out'],
  boolean:['list','verbose','debug'],
  alias:{ o:'out', v:'verbose' },
  default:{ out:'./favicons-output', verbose:false, debug:false }
});

if (argv.list) {
  console.log('Hong Kong news outlet list:');
  OUTLETS.forEach(o => console.log(` - ${o.slug}\t${o.url}`));
  process.exit(0);
}

const OUTDIR = path.resolve(argv.out);

// ────────────────────────────────────────────────────────────────
// 3. Helpers
// ----------------------------------------------------------------
function log(...args){ if(argv.verbose) console.log(...args); }
function debug(...args){ if(argv.debug) console.log('[debug]',...args); }

function originOf(u){ try{ const x=new URL(u); return x.origin; }catch(_){return null;} }
function resolveUrl(base, rel){ try{ return new URL(rel, base).href; }catch(_){return null;} }

function guessExtFromMime(m){
  if(!m) return '';
  m = m.toLowerCase();
  if(m.includes('svg')) return 'svg';
  if(m.includes('png')) return 'png';
  if(m.includes('jpeg')||m.includes('jpg')) return 'jpg';
  if(m.includes('webp')) return 'webp';
  if(m.includes('gif')) return 'gif';
  if(m.includes('icon')||m.includes('ico')) return 'ico';
  return '';
}
function guessExtFromUrl(u){
  if(!u) return '';
  const q = u.split('?')[0].toLowerCase();
  if(q.endsWith('.svg')) return 'svg';
  if(q.endsWith('.png')) return 'png';
  if(q.endsWith('.jpg')||q.endsWith('.jpeg')) return 'jpg';
  if(q.endsWith('.webp')) return 'webp';
  if(q.endsWith('.gif')) return 'gif';
  if(q.endsWith('.ico')||q.endsWith('.cur')) return 'ico';
  return '';
}

// parse the sizes attr like "32x32 16x16"
function parseSizesAttr(s){
  if(!s) return [];
  return s.split(/\s+/).map(x=>x.trim()).filter(Boolean).map(x=>{
    const [w,h] = x.split('x').map(n=>parseInt(n,10)||0); return {w,h};
  });
}

// fetch text (html) with axios
async function fetchHtml(url){
  try {
    const res = await axios.get(url, { timeout:15000, responseType:'text', maxRedirects:5, headers:{'User-Agent':'HKI-favicon-grabber/1.0'} });
    return res.data;
  } catch(err){
    return '';
  }
}

// fetch binary (arraybuffer)
async function fetchBin(url){
  try {
    const res = await axios.get(url, { timeout:20000, responseType:'arraybuffer', maxRedirects:5, headers:{'User-Agent':'HKI-favicon-grabber/1.0'} });
    return { ok:true, status:res.status, mime:res.headers['content-type']||'', buf:Buffer.from(res.data) };
  } catch(err){
    return { ok:false, error:String(err) };
  }
}

// discover icon candidates from html + manifest + root favicon
async function discoverIcons(pageUrl, html){
  const $ = html ? cheerio.load(html) : null;
  const out = [];
  if($){
    $('link').each((_,el)=>{
      const rel = ($(el).attr('rel')||'').toLowerCase();
      if(!rel) return;
      if(/icon|shortcut|apple-touch-icon|mask-icon/.test(rel)){
        const href = $(el).attr('href'); if(!href) return;
        out.push({source:'html',rel,href:resolveUrl(pageUrl,href),sizes:$(el).attr('sizes')||'',type:$(el).attr('type')||'',color:$(el).attr('color')||''});
      }
    });
    // manifest
    const mHref = $('link[rel="manifest"]').attr('href');
    if(mHref){
      const mUrl = resolveUrl(pageUrl,mHref);
      try{
        const mRes = await axios.get(mUrl,{timeout:10000});
        const manifest = typeof mRes.data==='string' ? JSON.parse(mRes.data) : mRes.data;
        if(Array.isArray(manifest.icons)){
          manifest.icons.forEach(ic=>{
            if(!ic.src) return;
            out.push({source:'manifest',rel:'manifest-icon',href:resolveUrl(mUrl,ic.src),sizes:ic.sizes||'',type:ic.type||'',purpose:ic.purpose||''});
          });
        }
      }catch(_){/*ignore*/}
    }
  }
  // default root favicon.ico
  const root = originOf(pageUrl);
  if(root) out.push({source:'default',rel:'icon',href:`${root}/favicon.ico`,sizes:'',type:''});

  // dedupe by href
  const seen=new Set();
  return out.filter(c=>{ if(!c.href) return false; if(seen.has(c.href)) return false; seen.add(c.href); return true; });
}

// ranking: svg > png > webp > jpg > gif > ico; tie-break by declared size (largest area) > source priority (html>manifest>default)
function rankCandidates(cands){
  function fmtScore(c){
    const ext = c.ext||'';
    let score=0;
    if(ext==='svg') score+=5000;
    else if(ext==='png') score+=4000;
    else if(ext==='webp') score+=3500;
    else if(ext==='jpg') score+=3000;
    else if(ext==='gif') score+=2000;
    else if(ext==='ico') score+=1000;
    // size bump
    const areas = parseSizesAttr(c.sizes);
    if(areas.length){
      const maxA = areas.reduce((m,a)=>Math.max(m,a.w*a.h),0); score+=maxA;
    }
    // source weight
    if(c.source==='html') score+=50;
    else if(c.source==='manifest') score+=25;
    else if(c.source==='default') score+=10;
    return score;
  }
  return [...cands].sort((a,b)=>fmtScore(b)-fmtScore(a));
}

// main per-outlet workflow
async function processOutlet(outlet){
  const { slug, url } = outlet;
  log(`\n[${slug}] Fetching ${url}`);

  const html = await fetchHtml(url);
  const cands = await discoverIcons(url, html);

  // annotate guessed ext BEFORE fetching bytes (cheap)
  cands.forEach(c=>{ c.extGuess=guessExtFromUrl(c.href); });

  // fetch each candidate serially (small list) – keep simple
  for(const c of cands){
    const r = await fetchBin(c.href);
    if(!r.ok){ c.fetchOk=false; c.error=r.error; continue; }
    c.fetchOk=true; c.status=r.status; c.mime=r.mime; c.buf=r.buf; c.ext=guessExtFromMime(r.mime)||c.extGuess||'bin';
    c.bytes=r.buf.length;
  }

  // add a vendor fallback IF nothing fetched OK
  if(!cands.some(c=>c.fetchOk)){
    const domain = new URL(url).hostname;
    const gUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
    const r = await fetchBin(gUrl);
    if(r.ok){
      cands.push({source:'google-s2',rel:'icon',href:gUrl,fetchOk:true,status:r.status,mime:r.mime,buf:r.buf,ext:guessExtFromMime(r.mime)||'png',bytes:r.buf.length});
    }
  }

  // pick best among fetchOk
  const okCands = cands.filter(c=>c.fetchOk);
  const ranked = rankCandidates(okCands);
  const best = ranked[0] || null;

  // write files
  const dir = path.join(OUTDIR, slug);
  await fse.ensureDir(dir);
  // raw candidates
  const rawDir = path.join(dir,'raw');
  await fse.ensureDir(rawDir);
  for(let i=0;i<cands.length;i++){
    const c = cands[i];
    if(!c.fetchOk) continue;
    const ext = c.ext || 'bin';
    const fname = `icon-${i}.${ext}`;
    await fs.promises.writeFile(path.join(rawDir,fname), c.buf);
    c.saved=`raw/${fname}`;
  }
  // best flat copy at slug.ext
  if(best){
    const bestExt = best.ext || 'bin';
    const bestPath = path.join(OUTDIR, `${slug}.${bestExt}`);
    await fs.promises.writeFile(bestPath, best.buf);
    best.bestSaved = path.relative(OUTDIR, bestPath) || `${slug}.${bestExt}`;
  }

  // build meta
  const meta = {
    slug,url,
    picked: best ? {href:best.href,ext:best.ext,mime:best.mime,bytes:best.bytes,file:`${slug}.${best.ext||'bin'}`} : null,
    candidates: cands.map(c=>({source:c.source,rel:c.rel,href:c.href,ok:!!c.fetchOk,status:c.status||null,ext:c.ext||c.extGuess||'',mime:c.mime||'',bytes:c.bytes||0,file:c.saved||null,error:c.error||null})),
    notes: !best ? 'No icon found; used none.' : undefined,
  };
  await fs.promises.writeFile(path.join(dir,'meta.json'), JSON.stringify(meta,null,2));

  return meta;
}

// ────────────────────────────────────────────────────────────────
// 4. Main
// ----------------------------------------------------------------
(async function main(){
  await fse.ensureDir(OUTDIR);
  const allMeta = [];
  for(const o of OUTLETS){
    try{ const m = await processOutlet(o); allMeta.push(m); }
    catch(err){
      console.error(`[${o.slug}] ERROR`, err);
      allMeta.push({slug:o.slug,url:o.url,error:String(err)});
    }
  }
  // write manifest
  const manifest = {};
  allMeta.forEach(m=>{ manifest[m.slug]=m; });
  await fs.promises.writeFile(path.join(OUTDIR,'manifest.json'), JSON.stringify(manifest,null,2));
  console.log(`\nDone. Saved icons + manifest to ${OUTDIR}`);
})();
