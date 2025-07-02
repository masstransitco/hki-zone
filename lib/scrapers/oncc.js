/**
 * on.cc / 東網 scraper  – 2025-07-02 refresh
 *
 * Features
 * ───────────────────────────────────────────────────────────
 * 1. Multi-ladder headline discovery:
 *      • RSSHub mirrors
 *      • Native XML feeds
 *      • Front-page HTML scraping
 *      • jina.ai proxy fallback
 * 2. Robust article extractor:
 *      • Handles Big-5 / GB2312 pages via iconv-lite
 *      • Looks in #articleContent, .bknContentTxt, [itemprop=articleBody], article
 *      • Falls back to jina.ai if < 80 chars extracted
 */

const axios    = require('axios');
const cheerio  = require('cheerio');
const iconv    = require('iconv-lite');
const Parser   = require('rss-parser');
const { XMLParser } = require('fast-xml-parser');

const rss  = new Parser();
const xmlp = new XMLParser({ ignoreAttributes: false });

const HDRS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Accept-Language': 'zh-HK,zh;q=0.9,en;q=0.8'
};

/* ------------------------------------------------------------------ */
/* 1)  RSSHub mirrors                                                 */
/* ------------------------------------------------------------------ */
const RSSHUB = [
  'https://rsshub.app/oncc/hk',   // 本地
  'https://rsshub.app/oncc/chi',  // 兩岸
  'https://rsshub.app/oncc/int',  // 國際
  'https://rsshub.moeyy.cn/oncc/hk',
  'https://rsshub.nocookie.top/oncc/hk'
];

async function fromRssHub() {
  for (const url of RSSHUB) {
    try {
      const feed = await rss.parseURL(url);
      if (feed?.items?.length) {
        return feed.items.slice(0, 10).map(i => ({
          title: i.title.trim(),
          url:   i.link
        }));
      }
    } catch {/* try next mirror */ }
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* 2)  Native XML feeds                                               */
/* ------------------------------------------------------------------ */
const XML_FEEDS = [
  'https://hk.on.cc/rss/hknews.xml',
  'https://hk.on.cc/rss/china.xml',
  'https://hk.on.cc/rss/inte.xml',
  'https://hk.on.cc/rss/news.xml'
];

async function fromXml() {
  for (const url of XML_FEEDS) {
    try {
      const { data } = await axios.get(url, { headers: HDRS, timeout: 8_000 });
      if (typeof data === 'string' && data.startsWith('<rss')) {
        const items = xmlp.parse(data)?.rss?.channel?.item || [];
        if (items.length) {
          return items.slice(0, 10).map(i => ({
            title: i.title.trim(),
            url:   i.link
          }));
        }
      }
    } catch {/* ignore feed */ }
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* 3)  Front-page HTML scrape                                         */
/* ------------------------------------------------------------------ */
async function fromHtml() {
  try {
    const { data } = await axios.get('https://hk.on.cc/', {
      headers: HDRS,
      timeout: 12_000
    });
    const $ = cheerio.load(data);
    const out = [];

    $('a[href*="/cnt/"], a[href*="/bkn/"]').each((_, a) => {
      const $a = $(a);
      const title = $a.text().trim();
      let url = $a.attr('href');
      if (title && url && title.length > 15) {
        if (!url.startsWith('http')) url = `https://hk.on.cc${url}`;
        out.push({ title, url });
      }
    });

    return out.slice(0, 10);
  } catch { return []; }
}

/* ------------------------------------------------------------------ */
/* 4)  jina.ai proxy fallback                                         */
/* ------------------------------------------------------------------ */
async function fromJina() {
  try {
    const proxy = 'https://r.jina.ai/http://hk.on.cc';
    const { data } = await axios.get(proxy, { headers: HDRS, timeout: 10_000 });

    return data.split('\n')
      .filter(l => l.startsWith('• ') && l.includes('http'))
      .map(l => {
        const m = l.match(/• (.+?) — (https?:\/\/\S+)/);
        return m ? { title: m[1].trim(), url: m[2] } : null;
      })
      .filter(Boolean)
      .slice(0, 10);
  } catch { return []; }
}

/* ------------------------------------------------------------------ */
/* 5)  Article body extraction                                        */
/* ------------------------------------------------------------------ */
async function extractArticleContent(url) {
  /* -------- primary attempt (local parsing) -------- */
  try {
    const res   = await axios.get(url, {
      headers: HDRS,
      responseType: 'arraybuffer',
      timeout: 15_000
    });

    /* Detect charset; default UTF-8. */
    const charset =
      (res.headers['content-type'] || '')
        .match(/charset=([^;]+)/i)?.[1]?.toLowerCase() || 'utf-8';

    const html  = iconv.decode(res.data, charset);
    const $     = cheerio.load(html, { decodeEntities: false });

    $('script, style, nav, header, footer, .share, .social, .ads').remove();

    // Extract image with multiple strategies
    let imageUrl = '';

    // Strategy 1: Look for on.cc specific featured images
    const featuredImageMatch =
      $('img.featured-image').attr('src') ||
      $('img[class*="article-image"]').attr('src') ||
      $('img[class*="main-image"]').attr('src') ||
      $('img[id*="featured"]').attr('src');

    if (featuredImageMatch) {
      imageUrl = featuredImageMatch;
    }

    // Strategy 2: Look for Open Graph image
    if (!imageUrl) {
      const ogImage = $('meta[property="og:image"]').attr('content');
      if (ogImage) {
        imageUrl = ogImage;
      }
    }

    // Strategy 3: Look for content images from on.cc domains
    if (!imageUrl) {
      $('img').each((_, img) => {
        const src = $(img).attr('src');
        if (src) {
          // Prefer images from on.cc domains or upload directories
          if (src.includes('on.cc') || src.includes('upload') || 
              src.includes('photo') || src.includes('image') ||
              src.includes('news') || src.includes('content')) {
            imageUrl = src;
            return false; // break out of each loop
          }
        }
      });
    }

    // Strategy 4: First suitable image as fallback
    if (!imageUrl) {
      $('img').each((_, img) => {
        const src = $(img).attr('src');
        if (src && !src.includes('logo') && !src.includes('icon') && 
            !src.includes('button') && !src.includes('avatar') &&
            src.length > 20) { // avoid tiny images
          imageUrl = src;
          return false; // break out of each loop
        }
      });
    }

    // Clean up image URL
    if (imageUrl) {
      // Ensure absolute URL
      if (imageUrl.startsWith('//')) {
        imageUrl = 'https:' + imageUrl;
      } else if (imageUrl.startsWith('/')) {
        imageUrl = 'https://hk.on.cc' + imageUrl;
      }
      
      // Remove query parameters that might cause issues
      imageUrl = imageUrl.split('?')[0];
    }

    // Fallback image if none found
    if (!imageUrl) {
      imageUrl = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&h=400&fit=crop';
    }

    const selectors = [
      '#articleContent',
      '.bknContentTxt',
      '.article__content',
      '[itemprop="articleBody"]',
      'article'
    ];

    let body = '';
    for (const sel of selectors) {
      const t = $(sel).text().trim();
      if (t.length > 80) { body = t; break; }
    }

    if (!body) {
      body = $('p').map((_, p) => $(p).text().trim())
                   .get().filter(x => x.length > 10)
                   .join('\n\n');
    }

    if (body.length > 80) {
      return {
        title: $('h1').first().text().trim() || $('title').text().trim(),
        url,
        author: $('.author, .byline').first().text().trim(),
        publishDate:
          $('time').attr('datetime') ||
          $('.date, .time').first().text().trim(),
        content: body,
        summary: body.slice(0, 200) + '…',
        imageUrl,
        source: 'on.cc'
      };
    }
  } catch (err) {
    if (process.env.NODE_DEBUG?.includes('scraper')) {
      console.error('[oncc] primary extract error:', err.message);
    }
  }

  /* -------- jina.ai fallback -------- */
  try {
    const proxy = 'https://r.jina.ai/http://' + url.replace(/^https?:\/\//, '');
    const { data } = await axios.get(proxy, { headers: HDRS, timeout: 10_000 });

    const lines    = data.split('\n').filter(l => l.length > 40 && !l.startsWith('#'));
    const fallback = lines.join('\n\n');

    if (fallback.length > 80) {
      return {
        title: lines[0]?.replace(/^•\s*/, '').trim() || '',
        url,
        author: '',
        publishDate: '',
        content: fallback,
        summary: fallback.slice(0, 200) + '…',
        imageUrl: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&h=400&fit=crop',
        source: 'on.cc'
      };
    }
  } catch {/* ignore fallback failure */ }

  return null;
}

/* ------------------------------------------------------------------ */
/* 6)  Orchestrators (headline-only / withContent)                     */
/* ------------------------------------------------------------------ */
async function scrapeOncc() {
  let items = await fromRssHub(); if (items.length) return items;
  items     = await fromXml();    if (items.length) return items;
  items     = await fromHtml();   if (items.length) return items;
  return      await fromJina();
}

async function scrapeOnccWithContent() {
  const heads = await scrapeOncc();
  const out   = [];

  for (let i = 0; i < heads.length; i++) {
    const art = await extractArticleContent(heads[i].url);
    out.push(art || {
      ...heads[i],
      content: '',
      summary: heads[i].title,
      publishDate: '',
      author: '',
      source: 'on.cc'
    });
    if (i < heads.length - 1) await new Promise(r => setTimeout(r, 2000));
  }

  return out;
}

/* ------------------------------------------------------------------ */
module.exports = scrapeOncc;
module.exports.withContent = scrapeOnccWithContent;