/**
 * The Standard (thestandard.com.hk) scraper for HKI news aggregation.
 * Compatible with the orchestrator system.
 */

const { chromium } = require('playwright');
const { setTimeout: delay } = require('timers/promises');
const { createHash } = require('crypto');

const BASE = 'https://www.thestandard.com.hk';
const DEFAULT_SECTIONS = [
  'hong-kong-news',
  'breaking-news',
  'china-news',
  'world-news',
  'business-innovation',
];

const USER_AGENT = 'HKI-NewsCrawler/1.0 (+https://hki.ai)';
const SOURCE_NAME = 'TheStandard';

function normalizeUrl(u) {
  if (!u) return null;
  if (typeof u === 'object' && u.url) return u.url;
  try { return new URL(u, BASE).toString(); } catch { return null; }
}

function isContentImage(u) {
  if (!u) return false;
  if (!/^https?:\/\//i.test(u)) return false;
  try {
    const url = new URL(u);
    if (url.hostname !== 'image.hkstandard.com.hk') return false;
    return /\/f\/\d+p0\//.test(url.pathname) || /\b\/20\d{2}-\d{2}\//.test(url.pathname);
  } catch { return false; }
}

function pickLeadImage(candidates) {
  const byPreference = [...candidates].sort((a, b) => {
    const as = a.includes('/1200p0/') ? 2 : a.includes('/1024p0/') ? 1 : 0;
    const bs = b.includes('/1200p0/') ? 2 : b.includes('/1024p0/') ? 1 : 0;
    return bs - as;
  });
  return byPreference[0] || null;
}

function cleanupContent(raw) {
  if (!raw) return '';
  let txt = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if (txt.length && /^more$/i.test(txt[0])) txt.shift();
  txt = txt.filter(l => !/^https?:\/\/www\.thestandard\.com\.hk\/appdownload$/i.test(l));
  if (/^share\b/i.test(txt[0] || '')) txt.shift();
  txt = txt.filter(l => !/^share this:?$/i.test(l));
  const shareWords = new Set(['whatsapp','facebook','x','email','link']);
  txt = txt.filter(l => !shareWords.has(l.toLowerCase()));
  txt = txt.filter(l => l.replace(/[•·\-\s]/g, '').length > 2);
  return txt.join('\n\n');
}

async function withRetry(fn, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      await delay(300 * (i + 1) + Math.random() * 200);
    }
  }
  throw lastErr;
}

function makeId(u) {
  return createHash('sha1').update(String(u)).digest('hex').slice(0, 16);
}

async function collectListingLinks(page, section, pageNum) {
  const url = `${BASE}/${section}${pageNum > 1 ? `?p=${pageNum}` : ''}`;
  await withRetry(() => page.goto(url, { waitUntil: 'domcontentloaded' }));
  await page.waitForTimeout(800);

  const SECTION_RE = /^(?:\/(?:hong-kong-news|breaking-news|china-news|world-news|business-innovation|education|arts-lifestyle|entertainment|sports))\/article\/\d+\//;

  const links = await withRetry(() => page.$$eval(
    'a[href*="/article/"]',
    (as, ctx) => {
      const { base, reStr } = ctx;
      const re = new RegExp(reStr);
      return Array.from(new Set(
        as
          .map(a => a.getAttribute('href'))
          .filter(h => h && re.test(h))
          .map(h => new URL(h, base).toString())
      ));
    },
    { base: BASE, reStr: SECTION_RE.source }
  ));

  return links;
}

async function extractArticle(page, url) {
  await withRetry(() => page.goto(url, { waitUntil: 'domcontentloaded' }));
  await page.waitForTimeout(800);
  await page.waitForSelector('h1', { timeout: 5000 }).catch(() => {});

  // Try JSON-LD first
  const ld = await page.$$eval('script[type="application/ld+json"]', nodes => {
    const blocks = [];
    for (const n of nodes) {
      try {
        const json = JSON.parse(n.textContent || '{}');
        if (Array.isArray(json)) blocks.push(...json);
        else blocks.push(json);
      } catch {}
    }
    return blocks;
  });

  let ldArticle = null;
  for (const block of ld) {
    const type = block['@type'] || (Array.isArray(block['@type']) ? block['@type'][0] : null);
    if (type && String(type).toLowerCase().includes('newsarticle')) {
      ldArticle = block;
      break;
    }
  }

  // DOM extraction
  const dom = await page.evaluate(() => {
    const text = (el) => (el ? el.textContent.trim() : '');
    const title = text(document.querySelector('h1'));

    let author = null;
    const authorCandidates = Array.from(document.querySelectorAll('h1, h2, .author, [class*="author"], [class*="byline"], [class*="meta"]'))
      .map(el => el.textContent.trim())
      .filter(Boolean);
    for (const t of authorCandidates) {
      const m = t.match(/\bby\s+([A-Z][^\n,]+(?:\s[A-Z][^\n,]+)*)/i);
      if (m) { author = m[1].trim(); break; }
    }

    let publishedRaw = null;
    const dateNode = Array.from(document.querySelectorAll('time, [class*="date"], [class*="time"], [class*="meta"]'))
      .find(el => /HKT/.test(el.textContent));
    if (dateNode) publishedRaw = dateNode.textContent.trim();

    const containers = [
      'article',
      'main',
      '[class*="article"]',
      '[class*="content"]',
      '[class*="story"]',
    ];
    let bodyRoot = null;
    for (const sel of containers) {
      bodyRoot = document.querySelector(sel);
      if (bodyRoot && bodyRoot.querySelectorAll('p').length >= 2) break;
    }
    if (!bodyRoot) bodyRoot = document.body;

    Array.from(bodyRoot.querySelectorAll('section, aside, [class*="related"], [class*="read"], [class*="top"], nav'))
      .forEach(n => {
        if (/Top News|Read More|Related|Most Read/i.test(n.textContent)) n.remove();
      });

    const paragraphs = Array.from(bodyRoot.querySelectorAll('p'))
      .map(p => p.textContent.trim())
      .filter(t => t && t.length > 1 && !/^(Download The Standard app|Photo:|File Photo)/i.test(t));

    const imgs = Array.from(bodyRoot.querySelectorAll('img'))
      .map(img => img.getAttribute('src') || img.getAttribute('data-src'))
      .filter(Boolean);

    const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
    if (ogImg) imgs.unshift(ogImg);

    const crumb = document.querySelector('[href*="-news"]')?.textContent?.trim() || null;

    return { title, author, publishedRaw, paragraphs, imgs, crumb };
  });

  const title = dom.title || ldArticle?.headline || null;

  const rawImages = [
    ...(dom.imgs || []),
    ...(Array.isArray(ldArticle?.image) ? ldArticle.image : (ldArticle?.image ? [ldArticle.image] : []))
  ];
  const images = Array.from(new Set(rawImages.map(normalizeUrl))).filter(Boolean);
  const contentImages = images.filter(isContentImage);
  const image_url = pickLeadImage(contentImages);

  let final_image_url = image_url;
  if (!final_image_url) {
    const og = await page.evaluate(() => document.querySelector('meta[property="og:image"]')?.content || null);
    if (og) {
      try { final_image_url = new URL(og, BASE).toString(); } catch {}
    }
  }

  let content = '';
  if (dom.paragraphs && dom.paragraphs.length) {
    content = dom.paragraphs.join('\n\n');
  } else if (ldArticle?.articleBody && typeof ldArticle.articleBody === 'string') {
    content = ldArticle.articleBody.trim();
  }
  content = cleanupContent(content);

  const published_at = (ldArticle?.datePublished || ldArticle?.dateModified || null) || null;
  const id = makeId(url);

  return {
    id,
    headline: title || null,
    image_url: final_image_url || null,
    content,
    url,
    published_at
  };
}

async function pLimit(n) {
  const queue = [];
  let active = 0;
  const next = async (fn) => {
    if (active >= n) {
      await new Promise(res => queue.push(res));
    }
    active++;
    try { return await fn(); } finally {
      active--;
      if (queue.length) queue.shift()();
    }
  };
  return (fn) => next(fn);
}

// Main scraper function compatible with orchestrator
async function scrapeTheStandard() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1366, height: 900 },
  });
  const page = await context.newPage();

  const allArticleUrls = new Set();
  const maxPages = 2;
  const concurrency = 3;

  console.log(`[${SOURCE_NAME}] Starting scrape of ${DEFAULT_SECTIONS.length} sections`);

  // Collect article URLs from all sections
  for (const section of DEFAULT_SECTIONS) {
    for (let p = 1; p <= maxPages; p++) {
      try {
        const links = await collectListingLinks(page, section, p);
        links.forEach(u => allArticleUrls.add(u));
        await delay(300 + Math.random() * 400);
      } catch (err) {
        console.warn(`[${SOURCE_NAME} listing] ${section} page ${p} → ${err.message}`);
      }
    }
  }

  console.log(`[${SOURCE_NAME}] Found ${allArticleUrls.size} unique articles`);

  // Scrape articles with limited concurrency
  const limit = await pLimit(concurrency);
  const results = [];

  const tasks = Array.from(allArticleUrls).map(url =>
    limit(async () => {
      const p = await context.newPage();
      try {
        const art = await extractArticle(p, url);
        // Validate article has required fields
        if (art.headline && art.content && art.content.length > 60) {
          // Format for orchestrator
          const formattedArticle = {
            source: 'TheStandard',
            url: art.url,
            headline: art.headline,
            date: art.published_at || '',
            body: art.content,
            coverImg: art.image_url,
            sponsored: false,
            id: art.id
          };
          results.push(formattedArticle);
        } else {
          console.warn(`[${SOURCE_NAME}] Weak article: ${url}`);
        }
      } catch (e) {
        console.warn(`[${SOURCE_NAME} article] ${url} → ${e.message}`);
      } finally {
        await p.close();
        await delay(250 + Math.random() * 350);
      }
    })
  );

  await Promise.all(tasks);
  await browser.close();

  console.log(`[${SOURCE_NAME}] Completed scrape: ${results.length} articles`);
  return results;
}

// Export for use in orchestrator
module.exports = { scrapeTheStandard };