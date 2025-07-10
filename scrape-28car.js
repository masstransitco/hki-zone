// scrape-28car.js
// Scrapes the first page of private-seller listings on 28car.com
// Requires: axios, cheerio, iconv-lite

const axios   = require('axios');
const cheerio = require('cheerio');
const iconv   = require('iconv-lite');

// ───────────────────────────────────────────────────────────
// Helper: fetch URL, auto-decode UTF-8 or Big5
async function fetchHtml(url, opts = {}) {
  const res  = await axios.get(url, { responseType: 'arraybuffer', ...opts });
  let html   = iconv.decode(res.data, 'utf8');
  if (/charset *= *big5/i.test(html)) {
    html = iconv.decode(res.data, 'big5');
  }
  return html;
}

// ───────────────────────────────────────────────────────────
(async () => {
  // 1) Visit the main page (frameset)
  const startUrl = 'https://www.28car.com';
  const startHtml = await fetchHtml(startUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
      'Accept-Language': 'zh-HK,zh;q=0.9,en;q=0.8'
    }
  });

  // 2) Find the frame that loads private-seller listings
  const $start  = cheerio.load(startHtml);
  let listSrc   = null;

  // look through <frame>, <iframe>, and <a> tags for sell_ico / sell_lst
  $start('frame, iframe, a').each((_, el) => {
    const src = $start(el).attr('src') || $start(el).attr('href');
    if (src && /sell_(ico|lst)\.php/i.test(src)) {
      listSrc = src;
      return false; // break loop
    }
  });

  if (!listSrc) {
    throw new Error('Could not locate listing frame/link on 28car.com');
  }

  // Resolve to absolute URL
  const listUrl = new URL(listSrc, startUrl).href;
  console.log(`➡  Listing page detected:\n    ${listUrl}`);

  // 3) Fetch the first page of listings
  const listHtml = await fetchHtml(listUrl, {
    headers: { Referer: startUrl } // some older sites like a Referer
  });
  const $ = cheerio.load(listHtml);

  // 4) Extract each listing row
  const listings = [];
  $('a[href*="sell_dsp.php"]').each((_, el) => {
    const $a    = $(el);
    const href  = $a.attr('href');
    if (!href) return;

    // full detail URL
    const detailUrl = new URL(href, listUrl).href;

    // listing ID
    const idMatch = href.match(/h_(?:vid|id)=(\d+)/i);
    const id      = idMatch ? idMatch[1] : 'N/A';

    // title text (cleaned)
    const title   = $a.text().trim().replace(/\s+/g, ' ');

    // attempt to capture price (e.g. $14.8萬 or $148,000)
    const parentText = $a.parent().text().replace(/\s+/g, ' ');
    const priceMatch = parentText.match(/[$\$]\s?[0-9\.]+(?:萬|千|百|,?[0-9]{3})*/);
    const price      = priceMatch ? priceMatch[0] : '—';

    listings.push({ id, title, price, url: detailUrl });
  });

  // 5) Output
  console.log(`\nFound ${listings.length} listings on page 1:\n`);
  listings.forEach((l, idx) => {
    console.log(
      `${idx + 1}. [${l.id}] ${l.title} | ${l.price}\n   ↳ ${l.url}`
    );
  });
})().catch(err => {
  console.error('❌ Error:', err.message);
});