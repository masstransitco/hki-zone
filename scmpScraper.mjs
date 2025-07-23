// scmpScraper.mjs
// deps: axios fast-xml-parser cheerio p-limit crypto
import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import * as cheerio from "cheerio";
import pLimit from "p-limit";
import crypto from "crypto";
import http from "http";
import https from "https";

// ---------- Config ----------
const RSS_FEEDS = [
  ["https://www.scmp.com/rss/91/feed", "hongkong"],
  ["https://www.scmp.com/rss/2/feed",  "china"],
  ["https://www.scmp.com/rss/3/feed",  "asia"],
  ["https://www.scmp.com/rss/4/feed",  "world"],
];

const CONCURRENCY       = +process.env.SCRAPE_CONCURRENCY || 8;
const REQUEST_TIMEOUTMS = +process.env.REQUEST_TIMEOUT_MS || 15000;
const MIN_BODY_CHARS    = +process.env.MIN_BODY_CHARS || 200;
const MAX_ARTICLES      = process.env.MAX_ARTICLES ? +process.env.MAX_ARTICLES : Infinity;
const STREAM_JSON       = process.env.STREAM_JSON !== "false";
const POLITE_DELAY      = +process.env.SCRAPE_DELAY_MS || 0; // set 10000 in prod

// ---------- HTTP client ----------
const httpAgent  = new http.Agent({ keepAlive: true, maxSockets: 64 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 64 });

const axiosClient = axios.create({
  httpAgent,
  httpsAgent,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; HKI-FastScraper/1.0)",
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
  },
});

const parser = new XMLParser({ ignoreAttributes: false });
const hostNextAllowedAt = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function politeWait(url) {
  if (!POLITE_DELAY) return;
  const { host } = new URL(url);
  const next = hostNextAllowedAt.get(host) || 0;
  const wait = Math.max(0, next - Date.now());
  if (wait) await sleep(wait);
  hostNextAllowedAt.set(host, Date.now() + POLITE_DELAY);
}

async function withTimeout(promise, ms, label) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await promise(ctl.signal);
  } catch (e) {
    throw new Error(`Timeout/Abort for ${label}: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHTML(url) {
  await politeWait(url);
  return withTimeout(
    (signal) => axiosClient.get(url, { signal }).then((r) => r.data),
    REQUEST_TIMEOUTMS,
    url
  );
}
async function fetchXML(url) {
  await politeWait(url);
  const xml = await withTimeout(
    (signal) => axiosClient.get(url, { responseType: "text", signal }).then((r) => r.data),
    REQUEST_TIMEOUTMS,
    url
  );
  return parser.parse(xml);
}

// ---------- Utils ----------
function normalizeUrl(raw) {
  try {
    const u = new URL(raw);
    ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"].forEach((p)=>u.searchParams.delete(p));
    return u.toString();
  } catch { return raw; }
}

function normalizeImageUrl(raw) {
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    ["itok","v"].forEach((p)=>u.searchParams.delete(p));
    return u.toString();
  } catch { return raw; }
}

function decodeEntities(str="") {
  // quick decode with cheerio
  return cheerio.load(`<span>${str}</span>`)("span").text();
}

function cleanBody(text="") {
  return decodeEntities(text)
    .replace(/^\s*\d{2}:\d{2}\s*$/gm, "")                    // drop timestamp-only lines
    .replace(/^\s*SCMP\+?.*$/gim, "")                        // promo lines
    .replace(/.*background-color:#[^;]+;.*$/gm, "")          // CSS styling lines
    .replace(/.*cursor:pointer.*$/gm, "")                    // CSS cursor lines
    .replace(/.*box-shadow:.*$/gm, "")                       // CSS box-shadow lines
    .replace(/.*no-repeat center.*$/gm, "")                  // CSS background lines
    .replace(/.*rgba\([^)]+\).*$/gm, "")                     // CSS rgba color lines
    .replace(/.*webkit-appearance.*$/gm, "")                 // CSS webkit lines
    .replace(/^\s*\}.*$/gm, "")                              // CSS closing braces
    .replace(/^\s*\{.*$/gm, "")                              // CSS opening braces and JSON fragments
    .replace(/^Why you can trust SCMP.*$/gm, "")             // Trust banner
    .replace(/^@\w+.*$/gm, "")                               // Schema.org type declarations
    .replace(/\n{3,}/g, "\n\n")                              // normalize line breaks
    .replace(/^\s*[\)\(]+\s*$/gm, "")                        // lines with only parentheses
    .trim();
}

function sha256(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

function splitTags(str) {
  if (!str) return [];
  return str
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// ---------- Extraction ----------
function extractFromLDJSON($) {
  const blocks = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).contents().text());
      if (Array.isArray(json)) blocks.push(...json);
      else blocks.push(json);
    } catch {}
  });
  // Enhanced type checking to handle complex types like "NewsArticle,ReportageNewsArticle"
  const article = blocks.find((b) => b && b["@type"] && (
    b["@type"] === "NewsArticle" || 
    b["@type"] === "Article" ||
    (typeof b["@type"] === "string" && b["@type"].includes("NewsArticle")) ||
    (Array.isArray(b["@type"]) && b["@type"].some(type => type === "NewsArticle" || type === "Article"))
  ));
  if (!article) return null;

  const img = Array.isArray(article.image)
    ? article.image[0]
    : article.image?.url || article.image;

  const author = Array.isArray(article.author)
    ? article.author.map((a) => a.name).join(", ")
    : article.author?.name;

  return {
    headline: article.headline,
    image: img,
    body: article.articleBody,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    author,
    articleSection: article.articleSection,
    keywords: Array.isArray(article.keywords) ? article.keywords.join(", ") : article.keywords,
  };
}

function extractBodyFallback($) {
  // Enhanced selectors for current SCMP structure
  const selectors = [
    "article .article-body",
    ".article-body", 
    ".basic-article__body",
    "[data-testid='article-body']",
    ".story-body",
    ".content-body",
    "section.article"
  ];
  
  for (const sel of selectors) {
    const element = $(sel);
    if (element.length > 0 && element.html() && element.html().length > 300) {
      // Extract paragraphs with enhanced filtering
      const paragraphs = element.find('p').map((_, el) => $(el).text().trim()).get();
      const cleanParagraphs = paragraphs.filter(text => 
        text.length > 20 && 
        !text.includes('background-color') &&
        !text.includes('Why you can trust SCMP') &&
        !text.includes('cursor:pointer') &&
        !text.includes('box-shadow') &&
        !text.includes('no-repeat center') &&
        !text.includes('rgba(') &&
        !text.includes('webkit-appearance') &&
        !text.match(/^@\w+/) &&
        !text.match(/^\{.*\}$/) &&
        !text.match(/^[\s\)\(\;]+$/) &&
        !text.match(/^(Subscribe|Follow|Share|Comment|Related|More)/i) &&
        !text.match(/^[\d\s\-\.\,]+$/) &&
        text.split(' ').length > 5
      );
      
      if (cleanParagraphs.length > 0) {
        return cleanParagraphs.join("\n\n");
      }
    }
  }
  
  // Enhanced final fallback with better filtering
  const allParagraphs = $("p").map((_, el) => $(el).text().trim()).get();
  const cleanAllParagraphs = allParagraphs.filter(text => 
    text.length > 30 && 
    !text.includes('background-color') &&
    !text.includes('Why you can trust SCMP') &&
    !text.includes('cursor:pointer') &&
    !text.includes('box-shadow') &&
    !text.includes('no-repeat center') &&
    !text.includes('rgba(') &&
    !text.includes('webkit-appearance') &&
    !text.match(/^@\w+/) &&
    !text.match(/^\{.*\}$/) &&
    !text.match(/^[\s\)\(\;]+$/) &&
    !text.match(/^(Subscribe|Follow|Share|Comment|Related|More)/i) &&
    !text.match(/^[\d\s\-\.\,]+$/) &&
    text.split(' ').length > 5
  );
  
  return cleanAllParagraphs.join("\n\n");
}

function extractCanonicalAndId($, url) {
  let canonical = $('link[rel="canonical"]').attr("href");
  canonical = canonical ? normalizeUrl(canonical) : normalizeUrl(url);
  const m = canonical.match(/\/article\/(\d+)\//);
  return { canonical, articleId: m ? m[1] : sha256(canonical).slice(0, 16) };
}

// ---------- Scrape one ----------
async function scrapeArticle(url) {
  const normalized = normalizeUrl(url);
  const html = await fetchHTML(normalized);
  const $ = cheerio.load(html);

  let extracted = extractFromLDJSON($);
  let body = extracted?.body || "";

  if (!body || body.length < MIN_BODY_CHARS) {
    body = extractBodyFallback($) || body;
  }

  const { canonical, articleId } = extractCanonicalAndId($, normalized);

  const headline =
    extracted?.headline ||
    $("meta[property='og:title']").attr("content") ||
    $("title").text().trim();

  const image = normalizeImageUrl(
    extracted?.image || $("meta[property='og:image']").attr("content")
  );

  const section =
    extracted?.articleSection ||
    $('meta[property="article:section"]').attr("content");

  const keywords =
    extracted?.keywords ||
    $('meta[name="news_keywords"]').attr("content") ||
    $('meta[name="keywords"]').attr("content");

  return {
    canonical,
    raw: normalized,
    id: articleId,
    headline,
    image,
    body: cleanBody(body),
    section,
    keywords,
    datePublished: extracted?.datePublished,
    dateModified: extracted?.dateModified,
    author: extracted?.author,
    bodyHtml: null, // keep if you decide to preserve HTML
  };
}

// ---------- Shape final object ----------
function shape(rec, feed) {
  const tags = splitTags(rec.keywords);
  const word_count = rec.body ? rec.body.split(/\s+/).filter(Boolean).length : 0;
  const hash = sha256(`${rec.headline}\n${rec.body}`);
  return {
    id: rec.id,
    url: rec.canonical,
    source_url: rec.raw,
    feed,
    headline: rec.headline,
    summary: null, // fill in with RSS description outside or here
    body_text: rec.body,
    body_html: rec.bodyHtml,
    image_main: rec.image || null,
    images: rec.image ? [rec.image] : [],
    author: rec.author || null,
    section: rec.section || null,
    tags,
    date_published: rec.datePublished || null,
    date_modified: rec.dateModified || null,
    scraped_at: new Date().toISOString(),
    word_count,
    hash,
    lang: null,
  };
}

// ---------- Run ----------
async function run() {
  // fetch RSS
  const rssResults = await Promise.all(RSS_FEEDS.map(([url]) => fetchXML(url)));

  // flatten items, annotate feed name
  const rawItems = rssResults.flatMap((r, idx) =>
    (r?.rss?.channel?.item || []).map((i) => ({
      rss_title: i.title,
      link: i.link,
      pubDate: i.pubDate,
      description: i.description,
      media: i["media:content"]?.["@_url"] || i.enclosure?.["@_url"],
      feed: RSS_FEEDS[idx][1],
    }))
  );

  // dedupe
  const map = new Map();
  for (const it of rawItems) {
    const key = normalizeUrl(it.link);
    if (!map.has(key)) map.set(key, it);
  }
  const toScrape = Array.from(map.values()).slice(0, MAX_ARTICLES);

  const limit = pLimit(CONCURRENCY);

  if (STREAM_JSON) process.stdout.write("[\n");
  let first = true;

  const results = await Promise.allSettled(
    toScrape.map((it) =>
      limit(async () => {
        try {
          const a = await scrapeArticle(it.link);
          const shaped = shape(a, it.feed);
          // attach summary + media (fallback) if needed
          if (!shaped.summary && it.description) shaped.summary = decodeEntities(it.description).trim();
          if (!shaped.image_main && it.media) {
            shaped.image_main = normalizeImageUrl(it.media);
            shaped.images.push(shaped.image_main);
          }
          if (STREAM_JSON) {
            if (!first) process.stdout.write(",\n");
            first = false;
            process.stdout.write(JSON.stringify(shaped));
          }
          return shaped;
        } catch (err) {
          const out = { error: err.message, link: it.link, feed: it.feed };
          if (STREAM_JSON) {
            if (!first) process.stdout.write(",\n");
            first = false;
            process.stdout.write(JSON.stringify(out));
          }
          return out;
        }
      })
    )
  );

  if (STREAM_JSON) process.stdout.write("\n]\n");

  // If you don't stream:
  // console.log(JSON.stringify(results.map(r=>r.value), null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}