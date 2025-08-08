#!/usr/bin/env node
/**
 * Scrape Bastille Post (hongkong) for HKI.
 * Output: NDJSON lines { id, headline, image_url, content, url, [published_at] }
 *
 * Usage:
 *   node scrape-bastillepost.js --pages=1 --headless --concurrency=3
 * Notes:
 * - Seeds from /hongkong and any /hongkong/category/... links found there.
 * - Polite crawling: low concurrency + jitter; retries on timeouts.
 */

const { chromium } = require('playwright');
const { setTimeout: delay } = require('timers/promises');
const { createHash } = require('crypto');

const BASE = 'https://www.bastillepost.com';
const HK_HOME = `${BASE}/hongkong`;

const headless = (arg('headless', 'true') !== 'false');
const maxPagesPerCategory = parseInt(arg('pages', '1'), 10); // if categories paginate (rarely surfaced), we’ll honor ?currentPage=
const concurrency = parseInt(arg('concurrency', '3'), 10);
const USER_AGENT = 'HKI-NewsCrawler/1.0 (+https://hki.ai)';

function arg(name, def) {
  const a = process.argv.find(x => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : def;
}

function sha1_16(s) {
  return createHash('sha1').update(String(s)).digest('hex').slice(0, 16);
}

async function withRetry(fn, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      await delay(300 * (i + 1) + Math.random() * 250);
    }
  }
  throw lastErr;
}

function normalizeUrl(u) {
  if (!u) return null;
  if (typeof u === 'object' && u.url) u = u.url;
  try { return new URL(u, BASE).toString(); } catch { return null; }
}

function isContentImage(u) {
  if (!u) return false;
  if (!/^https?:\/\//i.test(u)) return false;
  try {
    const url = new URL(u);
    // Most photo assets are on image.bastillepost.com; allow others as fallback.
    if (url.hostname === 'image.bastillepost.com') return true;
    // Accept other absolute hosts if they’re not obvious sprites.
    return !/\/wp\-includes\/|\/wp\-content\/themes\/|\/sprite|\/icon/i.test(url.pathname);
  } catch { return false; }
}

function pickLeadImage(list) {
  if (!list.length) return null;
  // Prefer largest-looking variants (heuristic)
  const pref = [...list].sort((a, b) => {
    const score = s => (s.includes('/1200') ? 3 : s.includes('/1024') ? 2 : s.includes('large') ? 1 : 0);
    return score(b) - score(a);
  });
  return pref[0];
}

function cleanupContent(raw) {
  if (!raw) return '';
  let lines = raw.split('\n').map(s => s.trim()).filter(Boolean);

  // Remove common non-body labels
  const dropExact = new Set(['大視野', '點擊看圖輯']);
  lines = lines.filter(l => !dropExact.has(l));

  // Remove lines that are clearly image captions or gallery prompts
  lines = lines.filter(l => !/(?:圖片|相片|圖輯)$/.test(l));

  // Remove sharing/app lines and very short residue
  lines = lines.filter(l =>
    !/^分享|分享至|Share:?/i.test(l) &&
    !/^https?:\/\/.*bastillepost\.com\/app/i.test(l) &&
    l.replace(/[•·\-\s]/g, '').length > 2
  );

  // De-duplicate consecutive lines
  const dedup = [];
  for (const l of lines) {
    if (dedup.length === 0 || dedup[dedup.length - 1] !== l) dedup.push(l);
  }
  lines = dedup;

  return lines.join('\n\n');
}

function parseChineseDate(s) {
  // e.g. "2025年05月06日 20:16 最後更新：21:22"
  if (!s) return null;
  const m = s.match(/(\d{4})年(\d{2})月(\d{2})日\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m;
  return `${y}-${mo}-${d}T${hh}:${mm}:00+08:00`;
}

async function seedCategoryUrls(page) {
  // From the HK portal, collect category pages and also any hot sections
  await withRetry(() => page.goto(HK_HOME, { waitUntil: 'domcontentloaded' }));
  await delay(800);

  const cats = await withRetry(() => page.$$eval('a[href*="/hongkong/category/"]', as =>
    Array.from(new Set(
      as.map(a => a.getAttribute('href'))
        .filter(Boolean)
        .filter(h => /^\/hongkong\/category\//.test(h))
        .map(h => new URL(h, location.origin).toString())
    ))
  ));

  // Always include homepage as a seed to grab top stories too
  return Array.from(new Set([HK_HOME, ...cats])).slice(0, 20); // safety cap
}

async function collectListingLinks(page, listUrl) {
  await withRetry(() => page.goto(listUrl, { waitUntil: 'domcontentloaded' }));
  await delay(800);

  // Collect article links seen on listing/home pages
  const links = await withRetry(() => page.$$eval('a[href*="/hongkong/article/"]', as =>
    Array.from(new Set(
      as.map(a => a.getAttribute('href'))
        .filter(Boolean)
        .filter(h => /^\/hongkong\/article\/\d+/.test(h))
        .map(h => new URL(h, location.origin).toString())
    ))
  ));

  // If the listing shows pagination by ?currentPage=, pull a couple pages
  const more = [];
  for (let p = 2; p <= Math.max(1, maxPagesPerCategory); p++) {
    const u = new URL(listUrl);
    u.searchParams.set('currentPage', String(p));
    try {
      await withRetry(() => page.goto(u.toString(), { waitUntil: 'domcontentloaded' }));
      await delay(600);
      const extra = await page.$$eval('a[href*="/hongkong/article/"]', as =>
        Array.from(new Set(
          as.map(a => a.getAttribute('href'))
            .filter(Boolean)
            .filter(h => /^\/hongkong\/article\/\d+/.test(h))
            .map(h => new URL(h, location.origin).toString())
        ))
      );
      more.push(...extra);
    } catch { /* ignore */ }
  }

  return Array.from(new Set([...links, ...more]));
}

async function extractArticle(context, url) {
  const page = await context.newPage();
  try {
    await withRetry(() => page.goto(url, { waitUntil: 'domcontentloaded' }));
    await delay(900);

    // Title / section / date / og / paragraphs
    const dom = await page.evaluate(() => {
      const text = el => (el ? el.textContent.trim() : '');
      const title = text(document.querySelector('h1')) || '';

      // Date line often appears near title (繁中格式)
      let dateRaw = null;
      const dateNode = Array.from(document.querySelectorAll('time, [class*="date"], [class*="time"], .post-meta, .meta'))
        .find(el => /(\d{4})年(\d{2})月(\d{2})日\s+\d{2}:\d{2}/.test(el.textContent));
      if (dateNode) dateRaw = dateNode.textContent.trim();

      // Find a plausible body container
      const candidates = [
        'article',
        '.single-content',
        '.post-content',
        '.entry-content',
        'main',
        '#content'
      ];

      let bodyRoot = null;
      for (const sel of candidates) {
        const el = document.querySelector(sel);
        if (el && el.querySelectorAll('p').length >= 2) { bodyRoot = el; break; }
      }
      if (!bodyRoot) bodyRoot = document.body;

      // Remove share blocks / related / widgets / hot lists
      Array.from(bodyRoot.querySelectorAll(
        'section, aside, nav, [class*="related"], [class*="share"], [class*="widget"], [class*="hot"], [class*="popular"], [class*="ranking"], [id*="related"], [id*="hot"], [id*="popular"], [class*="post-list"], [class*="list-post"]'
      )).forEach(n => n.remove());

      // Paragraphs (avoid list items or nav-like containers)
      const paragraphs = Array.from(bodyRoot.querySelectorAll('p'))
        .filter(p => !p.closest('li, nav, aside, section, [class*="related"], [class*="post-list"], [class*="list-post"], [class*="widget"], [class*="popular"], [class*="hot"]'))
        .map(p => p.textContent.trim())
        .filter(t => t && t.length > 1);

      // Images
      const imgs = Array.from(bodyRoot.querySelectorAll('img'))
        .map(img => img.getAttribute('src') || img.getAttribute('data-src'))
        .filter(Boolean);

      // og:image
      const og = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null;

      // Date string seen in page outside of <time>
      const nearTitle = dateRaw || (document.body.textContent.match(/(\d{4})年(\d{2})月(\d{2})日\s+\d{2}:\d{2}/)?.[0] ?? null);

      // Canonical URL (if provided)
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null;

      return { title, paragraphs, imgs, og, nearTitle, canonical };
    });

    // Prefer canonical URL for ID and output when available
    let effectiveUrl = url;
    if (dom.canonical) {
      try { effectiveUrl = new URL(dom.canonical, BASE).toString(); } catch {}
    }

    // Build content
    let content = '';
    if (dom.paragraphs?.length) content = dom.paragraphs.join('\n\n');
    content = cleanupContent(content);

    // Images
    const allImgs = Array.from(new Set([...(dom.imgs || []), dom.og].map(normalizeUrl))).filter(Boolean);
    const contentImgs = allImgs.filter(isContentImage);
    let image_url = pickLeadImage(contentImgs);
    if (!image_url && allImgs.length) image_url = allImgs[0]; // last resort

    // Date
    const published_at = parseChineseDate(dom.nearTitle);

    const headline = (dom.title || '').trim();
    const id = sha1_16(effectiveUrl);

    // Validate + emit
    if (headline && content && content.length > 60) {
      return { id, headline, image_url: image_url || null, content, url: effectiveUrl, ...(published_at ? { published_at } : {}) };
    } else {
      throw new Error('weak_article');
    }
  } finally {
    await page.close();
  }
}

async function pLimit(n) {
  const queue = [];
  let active = 0;
  const run = async (fn) => {
    if (active >= n) {
      await new Promise(res => queue.push(res));
    }
    active++;
    try { return await fn(); }
    finally {
      active--;
      if (queue.length) queue.shift()();
    }
  };
  return (fn) => run(fn);
}

(async () => {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1366, height: 900 },
  });
  const page = await context.newPage();

  // 1) Discover categories from HK portal
  const seedLists = await seedCategoryUrls(page); // includes /hongkong
  const allArticleUrls = new Set();

  for (const listUrl of seedLists) {
    try {
      const links = await collectListingLinks(page, listUrl);
      links.forEach(u => allArticleUrls.add(u));
      await delay(250 + Math.random() * 300);
    } catch (e) {
      console.error(JSON.stringify({ level: 'warn', msg: 'listing_failed', listUrl, error: String(e) }));
    }
  }

  // 2) Scrape articles with small concurrency
  const limit = await pLimit(concurrency);
  const tasks = Array.from(allArticleUrls).map(u => limit(async () => {
    try {
      const art = await extractArticle(context, u);
      process.stdout.write(JSON.stringify(art) + '\n');
    } catch (e) {
      console.error(JSON.stringify({ level: 'warn', msg: 'article_failed', url: u, error: String(e) }));
    } finally {
      await delay(220 + Math.random() * 300);
    }
  }));

  await Promise.all(tasks);
  await browser.close();
})().catch(err => {
  console.error(JSON.stringify({ level: 'fatal', error: String(err) }));
  process.exit(1);
});