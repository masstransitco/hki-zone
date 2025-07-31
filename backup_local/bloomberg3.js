// bloomberg_cron.js
// Fast sitemap → article scraper for Bloomberg Asia/HK using ScraperAPI.
// Designed to finish within ~5 minutes on Vercel scheduled functions.
// Outputs: bloomberg-asia-hk.json

const axios = require('axios');
const cheerio = require('cheerio');
const { parseStringPromise } = require('xml2js');
const fs = require('fs');
const path = require('path');

// ======= CONFIG (env-driven; sensible defaults for cron) =======
const API_KEY       = process.env.SCRAPERAPI_KEY || '8221533eb409be14a2576d78802b9dce';
const MAX_AGE_DAYS   = parseInt(process.env.MAX_AGE_DAYS   || '3', 10);   // only scrape slugs newer than this
const MAX_ARTICLES   = parseInt(process.env.MAX_ARTICLES   || '14', 10);  // keep small for <5 min
const CONCURRENCY    = parseInt(process.env.CONCURRENCY    || '6', 10);
const TIME_BUDGET_MS = parseInt(process.env.TIME_BUDGET_MS || (4.5 * 60 * 1000), 10); // ~4.5 min budget
const OUTFILE        = process.env.OUTFILE || 'bloomberg-asia-hk.json';
const DUMP_DIR       = path.resolve('./dumps');
if (!fs.existsSync(DUMP_DIR)) fs.mkdirSync(DUMP_DIR, { recursive: true });

// Sources
const SITEMAP_INDEX  = 'https://www.bloomberg.com/sitemaps/news/index.xml';
const LATEST_SITEMAP = 'https://www.bloomberg.com/sitemaps/news/latest.xml';
const MAX_SITEMAPS   = 4;

// Helpers
const uniq  = (arr) => Array.from(new Set(arr));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const now   = () => Date.now();

// Parse YYYY-MM-DD from Bloomberg article URLs
function dateFromSlug(u) {
  const m = u.match(/\/news\/articles\/(\d{4}-\d{2}-\d{2})\//);
  return m ? new Date(`${m[1]}T00:00:00Z`) : null;
}
function isFreshUrl(u, maxAgeDays) {
  const d = dateFromSlug(u);
  if (!d) return false;
  const ageMs = now() - d.getTime();
  return ageMs <= maxAgeDays * 24 * 60 * 60 * 1000;
}

// Minimal HTTP (for sitemaps)
async function httpGet(url, timeout = 20000) {
  try {
    const res = await axios.get(url, { timeout, responseType: 'text' });
    return res.data;
  } catch (e) {
    console.warn(`GET fail ${url} -> ${e.message}`);
    return null;
  }
}

// Sitemap parsing
async function parseSitemap(xml) {
  try {
    const parsed = await parseStringPromise(xml);
    return (parsed?.urlset?.url || [])
      .map(u => u.loc?.[0])
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function collectSitemapUrls() {
  const out = [];
  const latest = await httpGet(LATEST_SITEMAP);
  if (latest) out.push(...await parseSitemap(latest));

  const indexXml = await httpGet(SITEMAP_INDEX);
  if (indexXml) {
    try {
      const parsed = await parseStringPromise(indexXml);
      const monthly = (parsed?.sitemapindex?.sitemap || [])
        .map(s => s.loc?.[0])
        .filter(u => typeof u === 'string' && /\/sitemaps\/news\/\d{4}-\d+\.xml$/.test(u))
        .slice(-MAX_SITEMAPS);

      for (const sm of monthly) {
        const xml = await httpGet(sm);
        if (!xml) continue;
        out.push(...await parseSitemap(xml));
        await sleep(150);
      }
    } catch {}
  }
  return uniq(out);
}

// Filter for HK/China/Asia
function isHKAsiaUrl(u) {
  const L = u.toLowerCase();
  return /\/news\/articles\//.test(L) && (
    L.includes('/hong-kong') ||
    L.includes('-hong-kong-') ||
    L.includes('/asia') ||
    L.includes('-asia-') ||
    L.includes('/china') ||
    L.includes('/markets/asia')
  );
}

// Build ScraperAPI URL
function buildScraperApiUrl(url, {
  autoparse = false,
  render = false,
  country = 'hk',
  device = 'mobile',
  render_wait = 10000,
  ultra_premium = false,
  session_number = 1,
} = {}) {
  const base = 'https://api.scraperapi.com/';
  const sp = new URLSearchParams({
    api_key: API_KEY,
    url,
    country_code: country,
    device_type: device,
    session_number: String(session_number),
    keep_headers: 'false',
  });
  if (autoparse) sp.set('autoparse', 'true');
  if (render)    { sp.set('render', 'true'); sp.set('render_wait', String(render_wait)); }
  if (ultra_premium) sp.set('ultra_premium', 'true');
  return `${base}?${sp.toString()}`;
}

// Try ScraperAPI autoparse first (fast JSON), then AMP HTML (no render)
async function tryAutoparse(url, variants, timeout = 45000) {
  let lastErr;
  for (const v of variants) {
    const apiUrl = buildScraperApiUrl(url, { ...v, autoparse: true });
    try {
      const res = await axios.get(apiUrl, { timeout, responseType: 'text' });
      return { ok: true, variant: v, payload: res.data };
    } catch (e) {
      lastErr = e;
      await sleep(800);
    }
  }
  return { ok: false, error: lastErr?.message || 'autoparse failed' };
}

async function fetchHtml(url, variants, timeout = 45000) {
  let lastErr;
  for (const v of variants) {
    const apiUrl = buildScraperApiUrl(url, v);
    try {
      const res = await axios.get(apiUrl, { timeout, responseType: 'text' });
      return { ok: true, variant: v, html: res.data };
    } catch (e) {
      lastErr = e;
      await sleep(800);
    }
  }
  return { ok: false, error: lastErr?.message || 'html fetch failed' };
}

// Extract from HTML (AMP or full)
function extractFromHtml(html) {
  const $ = cheerio.load(html);

  let title =
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') || null;

  let date =
    $('time[datetime]').attr('datetime') ||
    $('meta[property="article:published_time"]').attr('content') || null;

  let image =
    $('meta[property="og:image"]').attr('content') ||
    $('article img[src]').first().attr('src') ||
    $('amp-img[src]').first().attr('src') ||
    null;

  const paras = $('article p, [data-component="paragraph"], [data-testid="article-body"] p')
    .map((_, p) => $(p).text().trim())
    .get()
    .filter(Boolean);

  const cleaned = paras.filter(p =>
    !/^Connecting decision makers/i.test(p) &&
    !/^(Americas|EMEA|Asia Pacific)\+/.test(p) &&
    p.length > 1
  );

  const content = cleaned.join('\n\n') || null;

  // JSON-LD fallback
  if (!title || !date) {
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const obj = JSON.parse($(el).text());
        const arr = Array.isArray(obj) ? obj : [obj];
        for (const x of arr) {
          if (x['@type'] === 'NewsArticle' || x['@type'] === 'Article') {
            if (!title && x.headline) title = x.headline;
            if (!date && (x.datePublished || x.dateModified)) date = x.datePublished || x.dateModified;
          }
        }
      } catch {}
    });
  }

  return { title, date, image, content };
}

// Extract from ScraperAPI autoparse JSON
function extractFromAutoparse(payload) {
  // payload is a JSON string
  try {
    const j = JSON.parse(payload);
    const title = j.title || j.headline || null;
    const date  = j.date || j.datePublished || j.publishedAt || null;

    let image = null;
    if (j.image) {
      if (typeof j.image === 'string') image = j.image;
      else if (j.image?.url) image = j.image.url;
    } else if (j.meta?.og?.image) {
      image = j.meta.og.image;
    }

    let content = null;
    if (Array.isArray(j.articles)) {
      // Some autoparse responses nest content in 'articles'
      const body = j.articles.map(a => a?.content).filter(Boolean).join('\n\n');
      content = body || null;
    }
    if (!content && typeof j.content === 'string') content = j.content;

    return { title, date, image, content };
  } catch {
    return { title: null, date: null, image: null, content: null };
  }
}

// Scrape one URL with budget check
async function scrapeOne(url, sessionNumber, deadlineTs) {
  const canonical = url.split('?')[0];
  const amp = canonical.endsWith('/amp') ? canonical : `${canonical}/amp`;

  // Variants to try for both modes
  const geoVariants = [
    { country: 'hk', device: 'mobile' },
    { country: 'sg', device: 'mobile' },
    { country: 'us', device: 'mobile' }
  ];

  // A) Autoparse (canonical) — fast
  if (now() < deadlineTs) {
    const a = await tryAutoparse(canonical, geoVariants, 45000);
    if (a.ok) {
      const fields = extractFromAutoparse(a.payload);
      if (fields.title && (fields.content?.length || 0) > 150) {
        return { url: canonical, pass: 'autoparse', ...fields };
      }
    } else {
      // report the reason for observability
      return { url: canonical, error: `autoparse: ${a.error}` };
    }
  } else {
    return { url: canonical, error: 'time_budget_exceeded_before_autoparse' };
  }

  // B) AMP HTML (no render) — reliable/fast
  if (now() < deadlineTs) {
    const b = await fetchHtml(amp, geoVariants, 45000);
    if (b.ok) {
      const fields = extractFromHtml(b.html);
      if (fields.title && (fields.content?.length || 0) > 150) {
        return { url: canonical, pass: 'amp', ...fields };
      }
      // Try canonical HTML if AMP thin
      const c = await fetchHtml(canonical, geoVariants, 45000);
      if (c.ok) {
        const fields2 = extractFromHtml(c.html);
        if (fields2.title && (fields2.content?.length || 0) > 150) {
          return { url: canonical, pass: 'html', ...fields2 };
        }
        return { url: canonical, error: 'extracted_too_thin_from_html' };
      }
      return { url: canonical, error: `amp_ok_html_fetch_fail: ${c.error || 'unknown'}` };
    }
    return { url: canonical, error: `amp_fetch_fail: ${b.error || 'unknown'}` };
  } else {
    return { url: canonical, error: 'time_budget_exceeded_before_amp' };
  }
}

// Minimal promise pool
async function mapPool(items, limit, fn) {
  const ret = [];
  let i = 0;
  const run = async () => {
    while (i < items.length) {
      const idx = i++;
      ret[idx] = await fn(items[idx], idx);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, run);
  await Promise.all(workers);
  return ret;
}

// Main
(async () => {
  const started = now();
  const deadline = started + TIME_BUDGET_MS;
  const sessionNumber = Math.floor(Math.random() * 900000) + 100000;

  console.log('📥 Pulling Bloomberg news sitemaps…');
  const urls = uniq((await collectSitemapUrls()) || []);

  // Focus: Asia/HK + fresh by slug date
  const candidates = urls.filter(isHKAsiaUrl).filter(u => isFreshUrl(u, MAX_AGE_DAYS)).slice(0, MAX_ARTICLES);
  console.log(`🔗 ${candidates.length} Asia/HK articles to scrape.`);

  const results = await mapPool(candidates, CONCURRENCY, async (u, idx) => {
    if (now() >= deadline) return { url: u, error: 'time_budget_exceeded_before_start' };
    console.log(`\n[${idx + 1}/${candidates.length}] ${u}`);
    try {
      return await scrapeOne(u, sessionNumber, deadline);
    } catch (e) {
      return { url: u, error: e.message || 'unknown_error' };
    }
  });

  fs.writeFileSync(OUTFILE, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n✅ Wrote ${results.length} to ${OUTFILE} in ${Math.round((now() - started)/1000)}s`);
})();