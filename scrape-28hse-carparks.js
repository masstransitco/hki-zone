#!/usr/bin/env node
/**
 * scrape-28hse-carparks.js
 *
 * Crawl Carpark-for-sale listings from 28Hse (English + Chinese detail pages).
 * Extract structured listing metadata, bilingual detail info, cleaned photo URLs,
 * robust list summary fields (district / estate / types), price + posted info,
 * and normalized address / agency data.
 *
 * v2025-07-17b
 *
 * Usage (full scrape, dual language, debug first 3 detail pages):
 *   node scrape-28hse-carparks.js --debug-html --debug-limit=3
 *
 * Quick test:
 *   rm -f 28hse-carparks.json
 *   node scrape-28hse-carparks.js --max=5 --debug-html
 */

const axios       = require('axios').default;
const cheerio     = require('cheerio');
const fs          = require('fs-extra');
const path        = require('path');
const { hideBin } = require('yargs/helpers');
const yargs       = require('yargs/yargs');

const argv = yargs(hideBin(process.argv))
  .option('lang',        { type:'string', default:'en', choices:['en','zh'], describe:'Primary scrape language root' })
  .option('dual-lang',   { type:'boolean', default:true, describe:'Also fetch alternate-language detail pages' })
  .option('max',         { type:'number', default:Infinity, describe:'Max listings to collect (cap scrape)' })
  .option('delay',       { type:'number', default:750, describe:'ms between list-page fetches' })
  .option('concurrency', { type:'number', default:4, describe:'Concurrent detail fetches' })
  .option('out',         { type:'string', default:'28hse-carparks.json', describe:'JSON output path' })
  .option('csv',         { type:'string', default:null, describe:'Optional CSV output path (primary lang only)' })
  .option('resume',      { type:'boolean', default:true, describe:'Resume from existing JSON if present' })
  .option('download-images', { type:'boolean', default:false, describe:'Download listing images locally' })
  .option('debug-html',  { type:'boolean', default:false, describe:'Dump raw HTML for troubleshooting' })
  .option('debug-limit', { type:'number', default:3, describe:'Max detail pages to dump per lang when debug-html' })
  .argv;

/* ------------------------------------------------------------------ */
/* Constants / Config                                                  */
/* ------------------------------------------------------------------ */
const ROOT_EN = 'https://www.28hse.com/en/buy/carpark';
const ROOT_ZH = 'https://www.28hse.com/buy/carpark';  // Chinese (no /en)
const ROOT = argv.lang === 'en' ? ROOT_EN : ROOT_ZH;
const PAGE_SUFFIX = '/page-'; // append page num >=2

/* polite headers */
const HTTP_HEADERS = {
  'User-Agent'     : 'Mozilla/5.0 (compatible; MTC-HKI-Scraper/1.0; +https://example.invalid/contact)',
  'Accept-Language': argv.lang === 'en' ? 'en-US,en;q=0.8,zh-HK;q=0.6' : 'zh-HK,zh;q=0.9,en;q=0.5',
  'Accept'         : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Connection'     : 'keep-alive',
  'Cache-Control'  : 'no-cache',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* District tokens (EN & ZH) for fallback extraction */
const DISTRICT_TOKENS_EN = [
  'Central','Central & Western','Wan Chai','Causeway Bay','Mid-Levels','Sheung Wan','Sai Ying Pun','Kowloon',
  'Mong Kok','Tsim Sha Tsui','Yau Ma Tei','Sham Shui Po','Cheung Sha Wan','Kwun Tong','Kowloon Bay',
  'New Territories','Sha Tin','Tsuen Wan','Tuen Mun','Yuen Long','Tai Po','Sai Kung','Tseung Kwan O'
];
const DISTRICT_TOKENS_ZH = [
  '中西區','灣仔','銅鑼灣','半山','上環','西營盤','九龍','旺角','尖沙咀','油麻地','深水埗','長沙灣',
  '觀塘','九龍灣','新界','沙田','荃灣','屯門','元朗','大埔','西貢','將軍澳'
];

const RE_ID = /property-(\d+)/;

/* ------------------------------------------------------------------ */
/* Debug helpers                                                       */
/* ------------------------------------------------------------------ */
async function debugWrite (name, content) {
  if (!argv['debug-html']) return;
  const dir = path.resolve('debug');
  await fs.ensureDir(dir);
  const outFile = path.join(dir, name);
  await fs.writeFile(outFile, content || '', 'utf8');
  console.log(`[debug] wrote ${outFile}`);
}

/* ------------------------------------------------------------------ */
/* URL & image utilities                                               */
/* ------------------------------------------------------------------ */
function absUrl (u) {
  try { return new URL(u, 'https://www.28hse.com/').toString(); }
  catch { return null; }
}
function upgradeImageUrl (u) {
  if (!u) return u;
  return u.replace(/\/resize\/[^/]+/i, '');
}
function isPhotoHost (urlObj) {
  const h = urlObj.hostname.toLowerCase();
  return (
    /^i\d+\.28hse\.com$/.test(h) ||
    /^img\d*\.28hse\.com$/.test(h) ||
    /^photo\d*\.28hse\.com$/.test(h)
  );
}
function hasPhotoExt (urlObj) {
  return /\.(jpe?g|png|webp|gif)$/i.test(urlObj.pathname);
}
function isChromePath (urlObj) {
  const p = urlObj.pathname.toLowerCase();
  return (
    p.includes('/assets/') ||
    p.includes('logo') ||
    p.includes('appstore') ||
    p.includes('googleplay') ||
    p.includes('adsman_') ||
    p.includes('banner') ||
    p.includes('loadingphoto') ||
    p.endsWith('/image.png')
  );
}
function classifyPhotoVariant (urlObj) {
  const p = urlObj.pathname.toLowerCase();
  if (/_large\./.test(p))   return 'large';
  if (/_thumb\./.test(p))   return 'thumb';
  if (/desktop\./.test(p))  return 'desktop';
  return 'orig';
}
function cleanPhotoSet (candidates) {
  const keep = [];
  for (const raw of candidates) {
    const abs = absUrl(raw);
    if (!abs) continue;
    let urlObj;
    try { urlObj = new URL(abs); } catch { continue; }
    if (/^data:/i.test(abs)) continue;
    if (!isPhotoHost(urlObj)) continue;
    if (!hasPhotoExt(urlObj)) continue;
    if (isChromePath(urlObj)) continue;
    const upgraded = upgradeImageUrl(abs);
    keep.push({ raw:abs, upgraded, variant:classifyPhotoVariant(new URL(upgraded)) });
  }
  const map = new Map();
  for (const k of keep) if (!map.has(k.upgraded)) map.set(k.upgraded, k);
  const uniq = [...map.values()];
  const large    = uniq.filter(o=>o.variant==='large');
  const desktop  = uniq.filter(o=>o.variant==='desktop');
  const thumbs   = uniq.filter(o=>o.variant==='thumb');
  const orig     = uniq.filter(o=>o.variant==='orig');
  const photos = [...large, ...desktop, ...orig, ...thumbs].map(o=>o.upgraded);
  const cover =
    (large[0]?.upgraded)   ||
    (desktop[0]?.upgraded) ||
    (orig[0]?.upgraded)    ||
    (thumbs[0]?.upgraded)  ||
    null;
  return { photos, large:large.map(o=>o.upgraded), desktop:desktop.map(o=>o.upgraded), thumb:thumbs.map(o=>o.upgraded), cover };
}

/* ------------------------------------------------------------------ */
/* Network helpers                                                     */
/* ------------------------------------------------------------------ */
async function downloadImage (url, dest) {
  try {
    const res = await axios.get(url, { responseType:'arraybuffer', headers:HTTP_HEADERS, validateStatus:s=>s<500 });
    if (res.status !== 200) return false;
    await fs.outputFile(dest, res.data);
    return true;
  } catch {
    return false;
  }
}
async function fetchHtml (url) {
  try {
    const res = await axios.get(url, {
      headers: HTTP_HEADERS,
      responseType: 'text',
      validateStatus: s => s < 500
    });
    if (res.status !== 200) {
      console.warn(`[warn] ${res.status} ${url}`);
      return null;
    }
    return res.data;
  } catch (err) {
    console.warn(`[err] ${url} :: ${err.message}`);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Concurrency helper: bounded parallelism                            */
/* ------------------------------------------------------------------ */
async function runWithLimit (tasks, limit = 4) {
  const results = new Array(tasks.length);
  let i = 0;
  let active = 0;

  return new Promise((resolve) => {
    const launchNext = () => {
      if (i >= tasks.length && active === 0) return resolve(results);
      while (active < limit && i < tasks.length) {
        const cur = i++;
        active++;
        tasks[cur]().then(
          r => { results[cur] = r; },
          e => { results[cur] = { error: e }; }
        ).finally(() => {
          active--;
          launchNext();
        });
      }
    };
    launchNext();
  });
}

/* ------------------------------------------------------------------ */
/* Build alternate-language detail URL                                */
/* ------------------------------------------------------------------ */
/**
 * Given a detail URL in one language, return the alternate language URL.
 * EN URLs look like: https://www.28hse.com/en/property-123456
 * ZH URLs look like: https://www.28hse.com/property-123456
 */
function altDetailUrl (detailUrl, primaryLang) {
  try {
    const u = new URL(detailUrl);
    if (primaryLang === 'en') {
      // remove '/en' prefix
      u.pathname = u.pathname.replace(/^\/en\//,'/');
    } else {
      // insert '/en' prefix if missing
      if (!/^\/en\//.test(u.pathname)) {
        u.pathname = '/en' + (u.pathname.startsWith('/') ? u.pathname : '/' + u.pathname);
      }
    }
    return u.toString();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */
function cleanTitle (t) {
  if (!t) return t;
  t = t.replace(/^\s*\d+\s+/,'');      // leading number
  t = t.replace(/\bGolden\b/gi,'');    // stray site widget word
  t = t.replace(/\s{2,}/g,' ').trim();
  return t || null;
}
function cleanDetailTitle (t) {
  if (!t) return null;
  let out = t;
  out = out.replace(/\s*#\d+\s*For Sale.*$/i,'');
  out = out.replace(/\s*Property Detail Page.*$/i,'');
  out = out.replace(/\s*售盤樓盤詳細資料.*$/,'');
  out = out.replace(/\s*買盤樓盤詳細資料.*$/,'');
  out = out.replace(/\s*出售\s*$/,'');
  out = out.replace(/\s*放售\s*$/,'');
  out = out.replace(/\s*\|\s*.+$/,''); // drop trailing pipe menus
  out = out.replace(/\s{2,}/g,' ').trim();
  return out || t.trim();
}
function shortEstate (s) {
  if (!s) return null;
  // remove detail strings like " #12345 For Sale..."
  return cleanDetailTitle(s);
}
function pickFirstNonEmpty (...arrs) {
  for (const a of arrs) {
    if (!a) continue;
    const t = Array.isArray(a) ? a.find(v=>v && v.trim()) : a;
    if (typeof t === 'string' && t.trim()) return t.trim();
  }
  return null;
}
function extractPriceBasic (text) {
  if (!text) return null;
  const m = text.match(/(?:HKD|HK\$|\$)\s*[\d,.]+(?:\s*M(?:illions?)?|Million|m)?/i) || text.match(/[\d,.]+\s*萬/);
  return m ? m[0].trim() : null;
}
/**
 * Rich price extraction that returns numeric HKD.
 * Supports forms:
 *   Sell HKD$0.925 Millions
 *   售 $92.5 萬元
 *   HKD$925,000
 */
function extractPriceDetailed (text) {
  if (!text) return null;
  const t = text.replace(/\s+/g,' ');
  // Millions (English)
  let m = t.match(/(?:HKD|HK\$|\$)\s*([\d,.]+)\s*(?:M(?:illions?)?|Million|Millions)/i);
  if (m) {
    const num = parseFloat(m[1].replace(/,/g,''));
    if (!isNaN(num)) return { raw:m[0].trim(), hkd: Math.round(num * 1_000_000), unit:'HKD' };
  }
  // Chinese 萬 / 萬元 (ten-thousand units)
  m = t.match(/(?:HKD|HK\$|\$)?\s*([\d,.]+)\s*萬(?:元)?/i);
  if (m) {
    const num = parseFloat(m[1].replace(/,/g,''));
    if (!isNaN(num)) return { raw:m[0].trim(), hkd: Math.round(num * 10_000), unit:'HKD' };
  }
  // Plain dollar
  m = t.match(/(?:HKD|HK\$|\$)\s*([\d,]+)/i);
  if (m) {
    const num = parseInt(m[1].replace(/,/g,''),10);
    if (!isNaN(num)) return { raw:m[0].trim(), hkd:num, unit:'HKD' };
  }
  return null;
}
function extractPosted (text) {
  if (!text) return null;
  const mEn = text.match(/(\d+\s+(?:hours?|days?)\s+ago\s+posted)/i);
  if (mEn) return mEn[1].trim();
  const mZh = text.match(/(\d+\s*(?:小時|日|天)前\s*刊登)/);
  if (mZh) return mZh[1].trim();
  return null;
}
function extractTypes (text) {
  const out = [];
  if (!text) return out;
  const low = text.toLowerCase();
  if (low.includes('residential') || /住宅車位/.test(text)) out.push('Residential');
  if (low.includes('commercial')  || /工商車位/.test(text)) out.push('Commercial');
  if (low.includes('motor')       || /電單車位/.test(text)) out.push('Motorbike');
  if (low.includes('truck')       || /貨車車位/.test(text)) out.push('Truck');
  if (/室內/.test(text)) out.push('Indoor');
  if (/露天/.test(text)) out.push('Outdoor');
  return [...new Set(out)];
}
function extractDistrictFallback (txt) {
  for (const d of DISTRICT_TOKENS_EN) if (new RegExp(`\\b${d}\\b`, 'i').test(txt)) return d;
  for (const d of DISTRICT_TOKENS_ZH) if (txt.includes(d)) return d;
  return null;
}
/** Extract last street-like line from blob text */
function extractAddressFromBlob (blob) {
  if (!blob) return null;
  const lines = blob.split(/\n+/).map(l=>l.trim()).filter(Boolean);
  // prefer lines with road tokens
  const roadRe = /\b(Road|Rd\.?|Street|St\.?|Ave|Avenue|Drive|Dr\.?|Lane|Ln\.?|Court|Ct\.?|Way)\b/i;
  const zhRoadRe = /(道|街|路|徑|里|巷|坊|道\d*號|號)/;
  let cand = null;
  for (let i=lines.length-1;i>=0;i--) {
    const L = lines[i];
    if (roadRe.test(L) || zhRoadRe.test(L)) { cand = L; break; }
  }
  if (!cand) {
    // fallback to first long-ish line
    cand = lines.find(l=>l.length>6) || null;
  }
  if (!cand) return null;
  // strip leading contact/labels
  cand = cand.replace(/^Contact\s*/i,'');
  cand = cand.replace(/^按此直接至聯絡人資料\s*/,'');
  cand = cand.replace(/\[Agency Ads\]/i,'').trim();
  return cand || null;
}
/** Parse agency info from a cheerio root; scoped to first explicit agency block */
function extractAgencyBlock ($) {
  let agencyName=null, licenseNo=null;
  const sel = [
    '.prop-agency',
    '.property-agency',
    '*:contains("Property Agency Company")',
    '*:contains("地產代理公司")',
    '*:contains("地產代理公司資料")'
  ].join(',');
  $(sel).each((_,el)=>{
    if (agencyName && licenseNo) return;
    const blk = $(el).closest('tr,div,section,li,article') || $(el).parent();
    const txt = blk.text().replace(/\s+/g,' ').trim();
    // license
    const lic = txt.match(/(?:Company\s+License\s+Number|License\s+Number)[:：]?\s*([A-Z0-9-]+)/i) ||
                txt.match(/(?:公司牌照號碼|牌照號碼)[:：]?\s*([A-Z0-9-]+)/i) ||
                txt.match(/\b([A-Z]-\d{5,})\b/);
    if (lic) licenseNo = licenseNo || lic[1] || lic[0];
    // agency name: first a/strong/b text child (excluding 28Hse)
    const nm = blk.find('a,span,strong,b').map((i,e)=>$(e).text().trim()).get().find(v=>v && !/28hse/i.test(v));
    if (nm) agencyName = agencyName || nm;
  });
  return { agencyName, licenseNo };
}

/* ------------------------------------------------------------------ */
/* Robust list-card parsing                                            */
/* ------------------------------------------------------------------ */
function parseListingCards (html, lang) {
  const base = (lang === 'en' ? ROOT_EN : ROOT_ZH);
  const $ = cheerio.load(html);
  const listings = [];
  const seenIds  = new Set();

  const cardSel = [
    '.property_box',
    '.property-box',
    '.property_row',
    '.property-row',
    '.list-row',
    '.row-property',
    'li[data-id]',
    'article[data-id]',
    '.property-item'
  ].join(',');

  const cards = $(cardSel);
  const cardNodes = cards.length ? cards : $('a[href*="/property-"]').parent(); // fallback

  cardNodes.each((_,el)=>{
    const card = $(el);
    let id = card.attr('data-id') || null;

    if (!id) {
      const a = card.find('a[href*="/property-"]').first();
      if (a.length) {
        const href = a.attr('href');
        const full = new URL(href, base).toString();
        const m = full.match(RE_ID);
        if (m) id = m[1];
      }
    }
    if (!id) {
      const href = card.attr('href');
      if (href) {
        const full = new URL(href, base).toString();
        const m = full.match(RE_ID);
        if (m) id = m[1];
      }
    }
    if (!id) return;
    if (seenIds.has(id)) return;
    seenIds.add(id);

    const a = card.find('a[href*="/property-"]').first();
    const detailUrl = a.length
      ? new URL(a.attr('href'), base).toString()
      : `${base.replace(/\/buy\/carpark.*$/,'')}/property-${id}`;

    const t1 = a.text().trim();
    const t2 = card.find('h1,h2,h3,h4,strong,b').first().text().trim();
    const t3 = card.find('.title, .prop-title').first().text().trim();
    const t4 = card.text().trim().split('\n')[0];
    let title = cleanTitle(pickFirstNonEmpty(t1, t2, t3, t4));

    const locLinks = card.find('.location a, .property-location a, .list-loc a, .prop-loc a');
    const locTexts = locLinks.map((i,e)=>$(e).text().trim()).get().filter(Boolean);
    let district = null, estate = null;
    if (locTexts.length >= 2) {
      district = locTexts[locTexts.length-2];
      estate   = locTexts[locTexts.length-1];
    } else if (locTexts.length === 1) {
      district = locTexts[0];
    }

    const cardText = card.text().replace(/\s+/g,' ').trim();
    district = district || extractDistrictFallback(cardText);
    if (!estate && district && cardText.includes(district)) {
      const rest = cardText.split(district).pop().trim();
      const m = rest.match(/^[,:-]\s*([^|]+)/);
      if (m) estate = m[1].trim();
    }

    const pSel = card.find('.price, .property-price, .list-price, [class*="price"]').first().text().trim();
    const priceText = extractPriceBasic(pSel) || extractPriceBasic(cardText);

    const postedSel = card.find('.posted, .list-posted, [class*="posted"]').text();
    const postedAgo = extractPosted(postedSel) || extractPosted(cardText);

    const typeTags = card.find('.tag, .label, .badge, .prop-type').map((i,e)=>$(e).text().trim()).get().join(' ');
    const types = extractTypes(typeTags + ' ' + cardText);

    listings.push({
      listingId : id,
      title,
      district,
      estate,
      priceText,
      types,
      postedAgo,
      detailUrl,
      lang
    });
  });

  return listings;
}

/* ------------------------------------------------------------------ */
/* Detail parse (language-aware, expanded address/agency/price)        */
/* ------------------------------------------------------------------ */
function parseDetail (html, lang) {
  const $ = cheerio.load(html);

  const h = $('h1,h2,h3').first().text().trim();
  const bodyText = $('body').text().replace(/\s+/g,' ').trim();

  /* ---- summary block: try to isolate listing header/price panel ---- */
  let summaryText = null;
  const headerSel = [
    '#main_content .listing_header',
    '.listing_header',
    '.property_header',
    '.mproperty-header',
    '.prop-summary',
    '.prop-info',
    '.property-info',
    '.property_box',
    '.detail_header',
    '.propertyDetail_top',
    '.mySliderPictures' // gallery container often adjacent
  ].join(',');
  const headerNode = $(headerSel).first();
  if (headerNode.length) {
    summaryText = headerNode.text().replace(/\s+/g,' ').trim();
  } else {
    // fallback to top chunk of body
    summaryText = bodyText.slice(0,800);
  }

  /* ---- created/updated ---- */
  let createdDate=null, updatedDate=null;
  const cuMatch = bodyText.match(/Created:(\d{4}-\d{2}-\d{2})\s*\|\s*Updated:(\d{4}-\d{2}-\d{2})/i);
  if (cuMatch) {
    createdDate=cuMatch[1]; updatedDate=cuMatch[2];
  } else {
    const cMatch = bodyText.match(/Created:(\d{4}-\d{2}-\d{2})/i) ||
                   bodyText.match(/建立日期[:：]\s*(\d{4}-\d{2}-\d{2})/) ||
                   bodyText.match(/刊登(?:日期|:)?\s*(\d{4}-\d{2}-\d{2})/) ||
                   bodyText.match(/刊登:(\d{4}-\d{2}-\d{2})/) ||
                   bodyText.match(/刊登\D*(\d{4}-\d{2}-\d{2})/);
    const uMatch = bodyText.match(/Updated:(\d{4}-\d{2}-\d{2})/i) ||
                   bodyText.match(/更新日期[:：]\s*(\d{4}-\d{2}-\d{2})/) ||
                   bodyText.match(/最後更新[:：]?\s*(\d{4}-\d{2}-\d{2})/) ||
                   bodyText.match(/更新:(\d{4}-\d{2}-\d{2})/) ||
                   bodyText.match(/更新\D*(\d{4}-\d{2}-\d{2})/);
    if (cMatch) createdDate=cMatch[1];
    if (uMatch) updatedDate=uMatch[1];
  }

  /* ---- building age ---- */
  let buildingAge=null;
  const ageMatch = bodyText.match(/Building age:\s*(\d+)\s*Year/i) ||
                   bodyText.match(/樓齡[:：]\s*(\d+)/);
  if (ageMatch) buildingAge = Number(ageMatch[1]);

  /* ---- address ---- */
  let address=null;
  const addrSel = [
    '.prop-address',
    '.property-address',
    '*:contains("Address")',
    '*:contains("地址")'
  ].join(',');
  $(addrSel).each((_,el)=>{
    if (address) return;
    const txt = $(el).text();
    if (!/Address|地址/.test(txt)) return;
    const next = $(el).next();
    if (next && next.text().trim()) {
      address = next.text().trim();
      return;
    }
    const par = $(el).closest('tr,div,section,li,dd,dt');
    if (par && par.text()) {
      address = par.text().replace(/Address|地址/,'').trim();
    }
  });
  if (!address) {
    const infoBlk = $('.property-info, .prop-info').text();
    const m = infoBlk.match(/Address(?:：|:)?\s*([^|]+?)(?:\s{2,}|$)/i) ||
              infoBlk.match(/地址[:：]\s*([^|]+?)(?:\s{2,}|$)/);
    if (m) address = m[1].trim();
  }
  address = extractAddressFromBlob(address || summaryText || bodyText);

  /* ---- agency ---- */
  let agencyName=null, licenseNo=null;
  const agencyParsed = extractAgencyBlock($);
  agencyName = agencyParsed.agencyName;
  licenseNo  = agencyParsed.licenseNo;

  /* ---- types ---- */
  const t = bodyText.toLowerCase();
  const kinds = [];
  if (t.includes('residential carpark') || /住宅車位/.test(bodyText)) kinds.push('Residential');
  if (t.includes('commercial carpark')  || /工商車位/.test(bodyText)) kinds.push('Commercial');
  if (t.includes('motor bike carpark') || t.includes('motorbike') || /電單車位/.test(bodyText)) kinds.push('Motorbike');
  if (t.includes('truck carpark')       || /貨車車位/.test(bodyText)) kinds.push('Truck');
  if (/室內車位/.test(bodyText)) kinds.push('Indoor');
  if (/露天車位/.test(bodyText)) kinds.push('Outdoor');

  /* ---- description (trimmed) ---- */
  let description = null;
  const descNode = $('body').find('p,div,section').filter((i,el)=>{
    const txt=$(el).text().trim();
    // Avoid nav; require some carpark keywords OR be in summary header
    return txt.length>30 && (/carpark|parking|車位/i.test(txt)) && !/Language 語言|Login|Register|會員登入/.test(txt);
  }).first();
  if (descNode.length) {
    description = descNode.text().replace(/\s+/g,' ').trim();
  } else {
    // fallback: take first 300 chars from summaryText after stripping boiler
    description = summaryText.replace(/No\.1 HK Property Portal.*?(Carpark|車位)/,'$1').trim().slice(0,300);
  }

  /* ---- price & posted from summary ---- */
  const priceObj = extractPriceDetailed(summaryText) || extractPriceDetailed(bodyText);
  const postedAgoDetail = extractPosted(summaryText) || extractPosted(bodyText);

  /* ---- photos ---- */
  const candidates = [];
  const gallerySel = [
    '[class*="gallery"] img',
    '[class*="photo"] img',
    '[class*="image"] img',
    '[class*="slider"] img',
    '.prop-image img',
    'img[data-src]',
    'img[src]'
  ].join(',');
  $(gallerySel).each((_,el)=>{
    const $el = $(el);
    let src = $el.attr('data-src') || $el.attr('data-original') || $el.attr('src');
    if (!src) return;
    if (/data:image\/|transparent|blank\.gif/i.test(src)) return;
    candidates.push(src);
  });
  const cleaned = cleanPhotoSet(candidates);
  if (!cleaned.photos.length) {
    const alt = [];
    $('img[src]').each((_,el)=>{
      const src = $(el).attr('src');
      if (/desktop\./i.test(src)) alt.push(absUrl(src));
    });
    if (alt.length) {
      cleaned.photos = alt;
      cleaned.cover  = alt[0];
    }
  }
  const imageFull   = cleaned.large.length ? cleaned.large : cleaned.photos;
  const imageThumbs = cleaned.thumb.length ? cleaned.thumb : cleaned.photos;
  const coverImage  = cleaned.cover || null;
  const photos      = cleaned.photos;

  return {
    lang,
    detailTitle : h,
    summaryText,
    description,
    createdDate,
    updatedDate,
    buildingAge,
    address,
    agencyName,
    licenseNo,
    carparkKinds: kinds,
    imageThumbs,
    imageFull,
    coverImage,
    photos,
    priceObj,
    postedAgoDetail
  };
}

/* ------------------------------------------------------------------ */
/* Extract total count from first page                                 */
/* ------------------------------------------------------------------ */
function extractTotalCount (html, lang) {
  if (!html) return null;
  let m;
  if (lang === 'en') {
    m = html.match(/(\d+)\s+results of property for sale/i);
  } else {
    m = html.match(/共有\s*(\d+)\s*個放售樓盤/);
  }
  return m ? Number(m[1]) : null;
}

/* ------------------------------------------------------------------ */
/* Derive list summary fields from detail data                         */
/* ------------------------------------------------------------------ */
function deriveListSummary(enObj, zhObj) {
  let district=null, estate=null;

  // Try from summaryText sections that include "Kowloon Cheung Sha Wan" etc.
  const trySummary = txt => {
    if (!txt) return;
    // pattern: District Estate (EN)
    const m1 = txt.match(/\b(Kowloon|New Territories|Hong Kong|HK|Island|[A-Z][A-Za-z ]{2,})\s+([A-Z][A-Za-z'().\s-]{2,})/);
    if (m1) {
      if (!district) district = m1[1].trim();
      if (!estate)   estate   = m1[2].trim();
    }
    // ZH pattern "九龍 長沙灣" etc.
    const m2 = txt.match(/(香港|九龍|新界|[一-龥]{2,4})\s+([一-龥A-Za-z0-9\s]{2,})/);
    if (m2) {
      if (!district) district = m2[1].trim();
      if (!estate)   estate   = m2[2].trim();
    }
  };
  trySummary(enObj?.summaryText);
  trySummary(zhObj?.summaryText);

  // Titles
  const candTitles = [];
  if (enObj?.detailTitle) candTitles.push(enObj.detailTitle);
  if (zhObj?.detailTitle) candTitles.push(zhObj.detailTitle);
  for (const t of candTitles) {
    if (!t) continue;
    if (!district) {
      for (const d of DISTRICT_TOKENS_EN) if (new RegExp(`\\b${d}\\b`, 'i').test(t)) { district = d; break; }
      for (const d of DISTRICT_TOKENS_ZH) if (!district && t.includes(d)) { district = d; break; }
    }
    if (!estate) {
      // remove district part, keep something before #
      let tt = t;
      if (district) tt = tt.replace(district,'');
      const m = tt.match(/^[^#|｜]+/);
      if (m) estate = cleanDetailTitle(m[0]).trim();
    }
  }

  const descStr = [enObj?.description, zhObj?.description].filter(Boolean).join(' ');
  const distFB = extractDistrictFallback(descStr);
  if (!district && distFB) district = distFB;

  return { district: district || null, estate: shortEstate(estate) || null };
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */
(async function main(){
  console.log(`[info] Scraping 28Hse Carpark listings (primary=${argv.lang}) …`);
  const outPath = path.resolve(argv.out);
  let data = [];

  if (argv.resume && await fs.pathExists(outPath)) {
    try {
      data = JSON.parse(await fs.readFile(outPath,'utf8'));
      console.log(`[info] resume: loaded ${data.length} from ${outPath}`);
    } catch(_) {
      console.warn('[warn] could not parse existing JSON; starting fresh.');
      data = [];
    }
  }

  const knownIds = new Set(data.map(d=>d.listingId));

  let page = 1;
  let totalCount = null;
  let stop = false;

  while (!stop) {
    const base = (argv.lang === 'en' ? ROOT_EN : ROOT_ZH);
    const url = page === 1 ? base : `${base}${PAGE_SUFFIX}${page}`;
    console.log(`[info] page ${page} ${url}`);
    const html = await fetchHtml(url);
    if (!html) break;

    if (argv['debug-html']) await debugWrite(`list-page-${page}.html`, html);

    if (totalCount == null) {
      totalCount = extractTotalCount(html, argv.lang) ?? Infinity;
      console.log(`[info] site reports total: ${totalCount}`);
    }

    const cards = parseListingCards(html, argv.lang);
    if (!cards.length) {
      console.log('[info] no cards found; stopping crawl.');
      break;
    }

    for (const c of cards) {
      if (knownIds.has(c.listingId)) continue;
      data.push(c);
      knownIds.add(c.listingId);
      if (knownIds.size >= argv.max) { stop = true; break; }
      if (knownIds.size >= totalCount) { stop = true; break; }
    }

    await sleep(argv.delay);
    page++;
    if (page > 100) { console.warn('[warn] page >100 safeguard triggered; stopping.'); break; }
  }

  console.log(`[info] collected ${knownIds.size} listing URLs; fetching detail…`);

  let debugDumpedPrimary = 0;
  let debugDumpedAlt     = 0;

  const detailTasks = data.map(d => async () => {
    if (d._detailFetched && d.i18n) return d; // resume case

    const htmlPrimary = await fetchHtml(d.detailUrl);
    if (argv['debug-html'] && debugDumpedPrimary < argv['debug-limit']) {
      await debugWrite(`detail-${d.listingId}-${argv.lang}.html`, htmlPrimary || '');
      debugDumpedPrimary++;
    }
    const primaryObj  = htmlPrimary ? parseDetail(htmlPrimary, argv.lang) : null;

    let altObj = null;
    if (argv['dual-lang']) {
      const altUrl = altDetailUrl(d.detailUrl, argv.lang);
      if (altUrl) {
        const altLang = (argv.lang === 'en' ? 'zh' : 'en');
        const htmlAlt = await fetchHtml(altUrl);
        if (argv['debug-html'] && debugDumpedAlt < argv['debug-limit']) {
          await debugWrite(`detail-${d.listingId}-${altLang}.html`, htmlAlt || '');
          debugDumpedAlt++;
        }
        if (htmlAlt) {
          altObj = parseDetail(htmlAlt, altLang);
        }
      }
    }

    const enObj = (argv.lang === 'en' ? primaryObj : altObj) || {};
    const zhObj = (argv.lang === 'zh' ? primaryObj : altObj) || {};
    const { district: dDist, estate: dEst } = deriveListSummary(enObj, zhObj);

    // merge types union
    const mergedTypes = [
      ...(d.types || []),
      ...(primaryObj?.carparkKinds || []),
      ...(altObj?.carparkKinds || [])
    ];
    const extraTypes = extractTypes(
      [primaryObj?.description, altObj?.description, enObj?.summaryText, zhObj?.summaryText]
        .filter(Boolean).join(' ')
    );
    const types = [...new Set([...mergedTypes, ...extraTypes])];

    // price
    const priceObj = primaryObj?.priceObj || altObj?.priceObj || null;
    const priceText = priceObj?.raw || d.priceText || null;
    const priceHkd  = priceObj?.hkd ?? null;

    // postedAgo
    const postedAgo = d.postedAgo ||
      primaryObj?.postedAgoDetail ||
      altObj?.postedAgoDetail ||
      null;

    // address & agency fallbacks
    const address = primaryObj?.address || enObj.address || zhObj.address || null;
    const agencyName = primaryObj?.agencyName || enObj.agencyName || zhObj.agencyName || null;
    const licenseNo  = primaryObj?.licenseNo  || enObj.licenseNo  || zhObj.licenseNo  || null;

    // title fallback
    const title = d.title || cleanDetailTitle(primaryObj?.detailTitle || altObj?.detailTitle) || dEst || `Carpark #${d.listingId}`;

    const allPhotos = new Set();
    const pushArr = arr => Array.isArray(arr) && arr.forEach(u=>allPhotos.add(u));
    if (primaryObj) pushArr(primaryObj.photos);
    if (altObj)     pushArr(altObj.photos);
    const merged = cleanPhotoSet([...allPhotos]);
    const cover = merged.cover ||
      (primaryObj ? primaryObj.coverImage : null) ||
      (altObj ? altObj.coverImage : null) || null;

    return {
      ...d,
      title,
      district : d.district || dDist || null,
      estate   : d.estate   || dEst  || null,
      priceText,
      priceHkd,
      types,
      postedAgo,
      detailTitle : primaryObj?.detailTitle || d.title,
      description : primaryObj?.description || null,
      createdDate : primaryObj?.createdDate || null,
      updatedDate : primaryObj?.updatedDate || null,
      buildingAge : primaryObj?.buildingAge || null,
      address,
      agencyName,
      licenseNo,
      carparkKinds: primaryObj?.carparkKinds || [],
      photos      : merged.photos,
      imageFull   : merged.large.length ? merged.large : merged.photos,
      imageThumbs : merged.thumb.length ? merged.thumb : merged.photos,
      coverImage  : cover,
      i18n: {
        en: {
          detailTitle : enObj.detailTitle || null,
          description : enObj.description || null,
          address     : enObj.address || null,
          agencyName  : enObj.agencyName || null,
          licenseNo   : enObj.licenseNo || null,
          createdDate : enObj.createdDate || null,
          updatedDate : enObj.updatedDate || null,
          carparkKinds: enObj.carparkKinds || [],
          price       : enObj.priceObj || null,
          postedAgo   : enObj.postedAgoDetail || null
        },
        zh: {
          detailTitle : zhObj.detailTitle || null,
          description : zhObj.description || null,
          address     : zhObj.address || null,
          agencyName  : zhObj.agencyName || null,
          licenseNo   : zhObj.licenseNo || null,
          createdDate : zhObj.createdDate || null,
          updatedDate : zhObj.updatedDate || null,
          carparkKinds: zhObj.carparkKinds || [],
          price       : zhObj.priceObj || null,
          postedAgo   : zhObj.postedAgoDetail || null
        }
      },
      _detailFetched:true
    };
  });

  const enrichedArr = await runWithLimit(detailTasks, argv.concurrency);

  if (argv['download-images']) {
    const imgDir = path.resolve('28hse-carpark-images');
    console.log(`[info] downloading images into ${imgDir} …`);
    for (const rec of enrichedArr) {
      if (!rec || rec.error) continue;
      const imgs = rec.photos?.length ? rec.photos : rec.imageFull?.length ? rec.imageFull : rec.imageThumbs || [];
      let idx = 0;
      for (const u of imgs) {
        try {
          const urlObj = new URL(u);
          const ext = path.extname(urlObj.pathname) || '.jpg';
          const dest = path.join(imgDir, `${rec.listingId}-${idx}${ext}`);
          const ok = await downloadImage(u, dest);
          if (!ok) console.warn(`[img-fail] ${rec.listingId} ${u}`);
          idx++;
        } catch (e) {
          console.warn(`[img-url-err] ${rec.listingId} ${u} :: ${e.message}`);
        }
      }
    }
  }

  const enriched = enrichedArr.map((r, idx) => {
    if (r && !r.error) return r;
    return { ...data[idx], _detailFetched:false, _error:String(r?.error || 'detail fetch error') };
  });

  await fs.writeFile(outPath, JSON.stringify(enriched, null, 2));
  console.log(`[done] wrote ${enriched.length} records to ${outPath}`);

  if (argv.csv) {
    const csvPath = path.resolve(argv.csv);
    const fields = [
      'listingId','title','district','estate','priceText','priceHkd','types','postedAgo','detailUrl',
      'createdDate','updatedDate','buildingAge','address','agencyName','licenseNo','carparkKinds','coverImage'
    ];
    const lines = [fields.join(',')];
    for (const r of enriched) {
      const row = fields.map(f=>{
        let v = r[f];
        if (Array.isArray(v)) v = v.join('|');
        if (v == null) v = '';
        v = String(v).replace(/"/g,'""');
        return `"${v}"`;
      }).join(',');
      lines.push(row);
    }
    await fs.writeFile(csvPath, lines.join('\n'));
    console.log(`[done] wrote CSV ${csvPath}`);
  }
})();