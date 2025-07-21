// am730Scraper.mjs
import axios from 'axios';
import { load } from 'cheerio';      // ⬅️ fixed: named import
import pLimit from 'p-limit';

const BASE = 'https://www.am730.com.hk';
const CATEGORIES = [
  '本地', '國際', '財經', '中國',
  '娛樂', '生活', '科技', '地產', '健康', '體育'
];

// keep the host happy — 4 parallel requests max
const limit = pLimit(4);

/** Grab the newest article URLs from one category page */
async function fetchListing(cat) {
  const url = `${BASE}/${encodeURIComponent(cat)}`;
  const { data: html } = await axios.get(url, {
    timeout: 10_000,
    headers: {
      'User-Agent': 'HKIbot (+https://hki.ai)',
      'Accept-Language': 'zh-HK,zh;q=0.9'
    }
  });

  const $ = load(html);
  return $('a')
    .filter((i, el) => $(el).attr('href')?.match(/^\/[\w%\-]+\/[\w%\-]+\/\d+$/))
    .map((i, el) => new URL($(el).attr('href'), BASE).href)
    .get()
    .slice(0, 15);              // latest 15 items are enough for near-real-time
}

/** Scrape headline, date and body from an article page */
async function fetchArticle(url) {
  const { data: html } = await axios.get(url, { timeout: 10_000 });
  const $ = load(html);

  const headline = $('h1').first().text().trim();
  const dateTxt  = $('time').first().text().trim() ||
                   $('div:contains("年")').first().text().trim();
  const body = $('div.article_content p')
    .map((i, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .join('\n\n');

  return { url, headline, date: dateTxt, body };
}

/** Main entry – returns an array of clean article objects */
export async function scrapeAm730() {
  const tasks = [];

  for (const cat of CATEGORIES) {
    const links = await fetchListing(cat);
    for (const link of links) {
      tasks.push(limit(() => fetchArticle(link)));
    }
  }

  return Promise.all(tasks);
}

/* quick local test: `node am730Scraper.mjs` */
if (process.argv[1] === import.meta.url) {
  scrapeAm730()
    .then(arts => {
      console.log(`Fetched ${arts.length} articles`);
      console.log(JSON.stringify(arts.slice(0, 3), null, 2));
    })
    .catch(console.error);
}