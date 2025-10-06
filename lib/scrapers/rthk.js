/**
 * RTHK (香港電台) scraper – 2025-07-02 refresh
 *
 *  Headline ladder:
 *    1. Official RSS feeds
 *    2. Front-page HTML scrape (rarely needed)
 *    3. jina.ai proxy
 *
 *  Article extractor:
 *    • Big-5/GB decoding with iconv-lite
 *    • Selectors: div.itemFullText, [itemprop=articleBody], .newscontent, article
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const iconv   = require('iconv-lite');
const Parser  = require('rss-parser');

const rss = new Parser();
const HDRS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Accept-Language': 'zh-HK,zh;q=0.9,en;q=0.8'
};

/* ──────────────────────────────── 1) RSS feeds ────────────────────────── */
const FEEDS = [
  'https://rthk.hk/rthk/news/rss/c_expressnews_clocal.xml',
  'https://rthk.hk/rthk/news/rss/c_expressnews_greaterchina.xml',
  'https://rthk.hk/rthk/news/rss/c_expressnews_cinternational.xml',
  'https://rthk.hk/rthk/news/rss/c_expressnews_cfinance.xml'
];

async function fromRss() {
  for (const url of FEEDS) {
    try {
      const f = await rss.parseURL(url);
      if (f?.items?.length) {
        return f.items.slice(0, 10).map(i => ({
          title: i.title.trim(),
          url:   i.link,
          publishDate: i.pubDate
        }));
      }
    } catch {/* keep trying */ }
  }
  return [];
}

/* ─────────────────────────────── 2) HTML scrape ───────────────────────── */
async function fromHtml() {
  try {
    const { data } = await axios.get('https://news.rthk.hk/', {
      headers: HDRS, timeout: 10_000
    });
    const $ = cheerio.load(data);
    const out = [];

    $('a[href*="/news/"]').each((_, a) => {
      const $a = $(a);
      const title = $a.text().trim();
      let url     = $a.attr('href');
      if (title && url && title.length > 15) {
        if (!url.startsWith('http')) url = `https://news.rthk.hk${url}`;
        out.push({ title, url });
      }
    });
    return out.slice(0, 10);
  } catch { return []; }
}

/* ─────────────────────────────── 3) jina.ai ──────────────────────────── */
async function fromJina() {
  try {
    const { data } = await axios.get(
      'https://r.jina.ai/http://news.rthk.hk',
      { headers: HDRS, timeout: 10_000 }
    );
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

/* ────────────────────── 4)  Article-body extractor ───────────────────── */
async function extractArticleContent(url) {
  /* primary – local parsing */
  try {
    const res = await axios.get(url, {
      headers: HDRS,
      responseType: 'arraybuffer',
      timeout: 15_000
    });

    const charset =
      (res.headers['content-type'] || '')
        .match(/charset=([^;]+)/i)?.[1]?.toLowerCase() || 'utf-8';

    const html = iconv.decode(res.data, charset);
    const $    = cheerio.load(html, { decodeEntities: false });

    $('script, style, nav, header, footer, .share, .social, .related').remove();

    // Extract image with multiple strategies
    let imageUrl = '';

    // Strategy 1: Look for RTHK-specific featured images
    const featuredImageMatch =
      $('img.featured-image').attr('src') ||
      $('img[class*="article-image"]').attr('src') ||
      $('img[class*="main-image"]').attr('src') ||
      $('img[class*="news-image"]').attr('src') ||
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

    // Strategy 3: Look for content images from RTHK domains
    if (!imageUrl) {
      $('img').each((_, img) => {
        const src = $(img).attr('src');
        if (src) {
          // Prefer images from RTHK domains or news-related paths
          if (src.includes('rthk.hk') || src.includes('news.rthk') || 
              src.includes('upload') || src.includes('photo') || 
              src.includes('image') || src.includes('news') || 
              src.includes('content')) {
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
            !src.includes('banner') && src.length > 20) { // avoid tiny images
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
        imageUrl = 'https://news.rthk.hk' + imageUrl;
      }
      
      // Remove query parameters that might cause issues
      imageUrl = imageUrl.split('?')[0];
    }

    // Fallback image if none found
    if (!imageUrl) {
      imageUrl = 'https://images.unsplash.com/photo-1586339949916-3e9457bef6d3?w=800&h=400&fit=crop';
    }

    // Extract title - multiple strategies
    let title = $('h1').first().text().trim();
    if (!title || title.length < 5) {
      title = $('meta[property="og:title"]').attr('content') || '';
    }
    if (!title || title.length < 5) {
      const pageTitle = $('title').text().trim();
      // Remove " - RTHK" suffix if present
      title = pageTitle.replace(/\s*-\s*RTHK\s*$/i, '').trim();
    }

    const selectors = [
      'div.itemFullText',
      '[itemprop="articleBody"]',
      '.newscontent, .newsContent',
      'article'
    ];

    let body = '';
    for (const sel of selectors) {
      const element = $(sel);
      if (element.length) {
        // Clone the element and remove unwanted parts
        const clone = element.clone();
        clone.find('h1, h2, script, style, nav, .share, .social').remove();
        const txt = clone.text().trim();
        if (txt.length > 80) {
          body = txt;
          break;
        }
      }
    }

    if (!body) {
      body = $('p').map((_, p) => $(p).text().trim())
                   .get().filter(t => t.length > 10).join('\n\n');
    }

    // Only return if we have both valid title and content
    if (body.length > 80 && title && title.length > 5 &&
        !title.startsWith('URL Source:') &&
        !title.includes('news.rthk.hk')) {
      return {
        title,
        url,
        author: $('.author').first().text().trim(),
        publishDate:
          $('time').attr('datetime') ||
          $('.date, .time').first().text().trim(),
        content: body,
        summary: body.slice(0, 200) + '…',
        imageUrl,
        source: 'RTHK'
      };
    }
  } catch (err) {
    if (process.env.NODE_DEBUG?.includes('scraper')) {
      console.error('[RTHK] primary extract error:', err.message);
    }
  }

  /* fallback – jina.ai */
  try {
    const proxy = 'https://r.jina.ai/http://' + url.replace(/^https?:\/\//, '');
    const { data } = await axios.get(proxy, { headers: HDRS, timeout: 10_000 });

    const lines = data.split('\n').filter(l => l.length > 40 && !l.startsWith('#'));
    const body  = lines.join('\n\n');

    // Extract title from jina.ai response - look for actual content, not URLs
    let jinaTitle = '';
    for (const line of lines) {
      const cleaned = line.replace(/^[•\-\*]\s*/, '').trim();
      // Skip lines that are URLs, navigation, or very short
      if (cleaned.length > 10 &&
          !cleaned.startsWith('http') &&
          !cleaned.startsWith('URL Source:') &&
          !cleaned.includes('news.rthk.hk') &&
          !cleaned.match(/^[a-zA-Z\s]{2,15}$/) && // Skip nav items like "Apps", "即時新聞"
          cleaned.length < 100) { // Titles shouldn't be too long
        jinaTitle = cleaned;
        break;
      }
    }

    if (body.length > 80 && jinaTitle) {
      return {
        title: jinaTitle,
        url,
        author: '',
        publishDate: '',
        content: body,
        summary: body.slice(0, 200) + '…',
        imageUrl: 'https://images.unsplash.com/photo-1586339949916-3e9457bef6d3?w=800&h=400&fit=crop',
        source: 'RTHK'
      };
    }
  } catch (err) {
    if (process.env.NODE_DEBUG?.includes('scraper')) {
      console.error('[RTHK] jina.ai fallback error:', err.message);
    }
  }

  // If both methods fail, return null so the orchestrator can skip this article
  return null;
}

/* ───────────────────────────── 5) Orchestrators ──────────────────────── */
async function scrapeRTHK() {
  let items = await fromRss();  if (items.length) return items;
  items     = await fromHtml(); if (items.length) return items;
  return      await fromJina();
}

async function scrapeRTHKWithContent() {
  const heads = await scrapeRTHK();
  const out   = [];

  for (let i = 0; i < heads.length; i++) {
    const art = await extractArticleContent(heads[i].url);

    // Only include articles with valid content
    if (art) {
      out.push(art);
    } else {
      // Only use headline as fallback if it has a proper title
      const title = heads[i].title || '';
      if (title.length > 5 &&
          !title.startsWith('URL Source:') &&
          !title.startsWith('http') &&
          !title.includes('news.rthk.hk')) {
        out.push({
          ...heads[i],
          content: '',
          summary: title,
          author: '',
          imageUrl: 'https://images.unsplash.com/photo-1586339949916-3e9457bef6d3?w=800&h=400&fit=crop',
          source: 'RTHK'
        });
      }
      // Otherwise skip this article entirely
    }

    if (i < heads.length - 1) await new Promise(r => setTimeout(r, 1500));
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────────────── */
module.exports = scrapeRTHK;
module.exports.withContent = scrapeRTHKWithContent;