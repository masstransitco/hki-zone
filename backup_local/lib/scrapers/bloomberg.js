// Bloomberg scraper compatible with orchestrator system
// Adapted from bloomberg3.js to follow scraper integration patterns
// Scrapes Hong Kong/Asia focused articles from Bloomberg

import axios from 'axios';
import * as cheerio from 'cheerio';
import { parseString } from 'xml2js';
const parseStringPromise = (xml) => new Promise((resolve, reject) => {
  parseString(xml, (err, result) => {
    if (err) reject(err);
    else resolve(result);
  });
});

const SOURCE_NAME = 'Bloomberg';
const API_KEY = process.env.SCRAPERAPI_KEY || '8221533eb409be14a2576d78802b9dce';
const MAX_AGE_DAYS = 7; // Extended from 3 to 7 days
const MAX_ARTICLES = 50; // Increased from 30 to 50 articles
const CONCURRENCY = 8;   // Increased from 6 to 8
const UA = 'HKIbot (+https://hki.ai)';

// Sources
const SITEMAP_INDEX = 'https://www.bloomberg.com/sitemaps/news/index.xml';
const LATEST_SITEMAP = 'https://www.bloomberg.com/sitemaps/news/latest.xml';
const MAX_SITEMAPS = 8; // Increased from 4 to 8

// Additional RSS feeds for more content
const RSS_FEEDS = [
  'https://feeds.bloomberg.com/markets/news.rss',
  'https://feeds.bloomberg.com/politics/news.rss',
  'https://feeds.bloomberg.com/technology/news.rss'
];

// Helpers
const uniq = (arr) => Array.from(new Set(arr));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const now = () => Date.now();

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
    console.warn(`[${SOURCE_NAME} GET] ${url} → ${e.message}`);
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
  
  // Add RSS feed URLs
  for (const feedUrl of RSS_FEEDS) {
    try {
      const rssXml = await httpGet(feedUrl);
      if (rssXml) {
        const rssUrls = await parseRSSFeed(rssXml);
        out.push(...rssUrls);
        await sleep(150);
      }
    } catch (e) {
      console.warn(`[${SOURCE_NAME}] RSS feed error ${feedUrl}: ${e.message}`);
    }
  }
  
  return uniq(out);
}

async function parseRSSFeed(xml) {
  try {
    const parsed = await parseStringPromise(xml);
    return (parsed?.rss?.channel?.[0]?.item || [])
      .map(item => item.link?.[0])
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Expanded filter for HK/China/Asia content
function isHKAsiaUrl(u) {
  const L = u.toLowerCase();
  return /\/news\/articles\//.test(L) && (
    // Direct geographic mentions
    L.includes('/hong-kong') || L.includes('-hong-kong-') ||
    L.includes('/asia') || L.includes('-asia-') ||
    L.includes('/china') || L.includes('-china-') ||
    L.includes('/singapore') || L.includes('-singapore-') ||
    L.includes('/japan') || L.includes('-japan-') ||
    L.includes('/south-korea') || L.includes('-korea-') ||
    L.includes('/taiwan') || L.includes('-taiwan-') ||
    L.includes('/thailand') || L.includes('-thailand-') ||
    L.includes('/vietnam') || L.includes('-vietnam-') ||
    L.includes('/malaysia') || L.includes('-malaysia-') ||
    L.includes('/indonesia') || L.includes('-indonesia-') ||
    L.includes('/philippines') || L.includes('-philippines-') ||
    // Market sections
    L.includes('/markets/asia') ||
    // Business/economic terms related to Asia
    L.includes('southeast-asia') || L.includes('east-asia') ||
    L.includes('chinese-') || L.includes('asian-') ||
    // Companies/terms often Asia-related
    L.includes('yuan') || L.includes('rmb') ||
    L.includes('nikkei') || L.includes('hang-seng') ||
    L.includes('alibaba') || L.includes('tencent') ||
    L.includes('xiaomi') || L.includes('baidu')
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
  if (render) { sp.set('render', 'true'); sp.set('render_wait', String(render_wait)); }
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
    const date = j.date || j.datePublished || j.publishedAt || null;

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
async function scrapeOne(url, sessionNumber) {
  const canonical = url.split('?')[0];
  const amp = canonical.endsWith('/amp') ? canonical : `${canonical}/amp`;

  // Variants to try for both modes
  const geoVariants = [
    { country: 'hk', device: 'mobile' },
    { country: 'sg', device: 'mobile' },
    { country: 'us', device: 'mobile' }
  ];

  // A) Autoparse (canonical) — fast
  const a = await tryAutoparse(canonical, geoVariants, 45000);
  if (a.ok) {
    const fields = extractFromAutoparse(a.payload);
    if (fields.title && (fields.content?.length || 0) > 150) {
      return {
        source: 'bloomberg',
        url: canonical,
        headline: fields.title,
        title: fields.title,
        date: fields.date,
        body: fields.content,
        content: fields.content,
        coverImg: fields.image,
        sponsored: false
      };
    }
  }

  // B) AMP HTML (no render) — reliable/fast
  const b = await fetchHtml(amp, geoVariants, 45000);
  if (b.ok) {
    const fields = extractFromHtml(b.html);
    if (fields.title && (fields.content?.length || 0) > 150) {
      return {
        source: 'bloomberg',
        url: canonical,
        headline: fields.title,
        title: fields.title,
        date: fields.date,
        body: fields.content,
        content: fields.content,
        coverImg: fields.image,
        sponsored: false
      };
    }
    // Try canonical HTML if AMP thin
    const c = await fetchHtml(canonical, geoVariants, 45000);
    if (c.ok) {
      const fields2 = extractFromHtml(c.html);
      if (fields2.title && (fields2.content?.length || 0) > 150) {
        return {
          source: 'bloomberg',
          url: canonical,
          headline: fields2.title,
          title: fields2.title,
          date: fields2.date,
          body: fields2.content,
          content: fields2.content,
          coverImg: fields2.image,
          sponsored: false
        };
      }
    }
  }

  return null;
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

// Main scraper function compatible with orchestrator
export async function scrapeBloombergWithContent() {
  const sessionNumber = Math.floor(Math.random() * 900000) + 100000;

  console.log(`[${SOURCE_NAME}] Starting scrape...`);

  try {
    // Collect sitemap URLs
    const urls = uniq((await collectSitemapUrls()) || []);

    // Focus: Asia/HK + fresh by slug date
    const candidates = urls.filter(isHKAsiaUrl).filter(u => isFreshUrl(u, MAX_AGE_DAYS)).slice(0, MAX_ARTICLES);
    console.log(`[${SOURCE_NAME}] Found ${candidates.length} Asia/HK articles to scrape`);

    if (candidates.length === 0) {
      console.log(`[${SOURCE_NAME}] No articles found`);
      return [];
    }

    // Process articles with rate limiting
    const results = await mapPool(candidates, CONCURRENCY, async (u, idx) => {
      console.log(`[${SOURCE_NAME}] Processing ${idx + 1}/${candidates.length}: ${u}`);
      try {
        const result = await scrapeOne(u, sessionNumber);
        await sleep(120); // Reduced from 180ms to 120ms
        return result;
      } catch (e) {
        console.warn(`[${SOURCE_NAME}] Failed to scrape ${u}: ${e.message}`);
        return null;
      }
    });

    const final = results.filter(Boolean);
    console.log(`[${SOURCE_NAME}] Completed scrape: ${final.length} articles`);

    return final;
  } catch (error) {
    console.error(`[${SOURCE_NAME}] Error during scraping:`, error);
    return [];
  }
}