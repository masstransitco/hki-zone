// am730Scraper.mjs
// Node 18+ ESM. Run: `node am730Scraper.mjs`
// Options:
//   node am730Scraper.mjs --cats 本地 財經
//   node am730Scraper.mjs --reset   # ignore state file once

import axios from 'axios';
import { load } from 'cheerio';
import pLimit from 'p-limit';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const BASE = 'https://www.am730.com.hk';
const DEFAULT_CATEGORIES = [
  '本地','國際','財經','中國','娛樂','生活','科技','地產','健康','體育'
];
const STATE_FILE = '.am730_state.json';        // stores lastSeenId + seenIds
const UA = 'HKIbot (+https://hki.ai)';
const limit = pLimit(4);

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

// ---------- STATE (last seen id) ----------
async function loadState(reset=false){
  if (reset) return { lastSeenId: 0, seen: {} };
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { lastSeenId: 0, seen: {} };
  }
}
async function saveState(state){
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

// ---------- SCRAPING ----------
async function fetchListing(cat){
  const url = `${BASE}/${encodeURIComponent(cat)}`;
  try{
    const { data: html } = await axios.get(url, {
      timeout: 10_000,
      headers: { 'User-Agent': UA, 'Accept-Language': 'zh-HK,zh;q=0.9' }
    });
    const $ = load(html);

    const links = $('a').map((_, el) => $(el).attr('href')).get()
      .filter(h => h && /\/\d+$/.test(h))
      .map(h => new URL(h, BASE).href);

    return Array.from(new Set(links)).slice(0, 25);
  }catch(e){
    console.warn(`[listing] ${cat} → ${e.message}`);
    return [];
  }
}

function extractPublished($){
  const og = $('meta[property="article:published_time"]').attr('content');
  if (og) return og;
  const ld = $('script[type="application/ld+json"]').map((_, el) => {
    try {
      const j = JSON.parse($(el).html());
      if (j?.datePublished) return j.datePublished;
    } catch {}
  }).get()[0];
  if (ld) return ld;
  const t = $('time').first();
  return t.attr('datetime') || t.text().trim() || '';
}

function extractBody($){
  // union of possible containers
  const containers = $(
    'div.article_content, div#articleContent, [itemprop="articleBody"], section.article_detail'
  );

  // If nothing, fall back to main
  const scope = containers.length ? containers : $('main, body');

  const texts = scope.find('p, h2, h3, li').map((i, el) => $(el).text().trim()).get();

  const cleaned = texts
    .filter(t =>
      t &&
      !/^(返回|分享：|ADVERTISEMENT|熱門搜尋|支持AM730)$/.test(t) &&
      t.length > 1
    )
    .join('\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned;
}

function isSponsored(headline, fullText){
  return /資料由客戶提供/.test(headline) || /資料由客戶提供/.test(fullText);
}

async function fetchArticle(url){
  try{
    const { data: html } = await axios.get(url, {
      timeout: 10_000,
      headers: { 'User-Agent': UA }
    });
    const $ = load(html);

    const headline = $('h1').first().text().trim()
      || $('meta[property="og:title"]').attr('content') || '';
    const date = extractPublished($);
    const body = extractBody($);

    const coverImg =
      $('div.article_content figure img').first().attr('src') ||
      $('meta[property="og:image"]').attr('content') || null;

    const sponsored = isSponsored(headline, body);

    return { source: 'am730', url, headline, date, body, coverImg, sponsored };
  }catch(e){
    console.warn(`[article] ${url} → ${e.message}`);
    return null;
  }
}

// Main export
export async function scrapeAm730(categories = DEFAULT_CATEGORIES, { reset=false } = {}){
  const state = await loadState(reset);
  const tasks = [];

  for (const cat of categories){
    const links = await fetchListing(cat);
    for (const link of links){
      const idMatch = link.match(/(\d+)$/);
      const id = idMatch ? Number(idMatch[1]) : 0;
      if (id && id <= state.lastSeenId) continue;     // already seen batch
      if (state.seen[link]) continue;
      tasks.push(limit(async () => {
        await sleep(180);
        const art = await fetchArticle(link);
        return art;
      }));
    }
  }

  const raw = (await Promise.all(tasks)).filter(Boolean);

  // dedupe
  const seenNow = new Set();
  const final = raw.filter(r => {
    if (seenNow.has(r.url)) return false;
    seenNow.add(r.url);
    return true;
  }).map(a => {
    const idMatch = a.url.match(/(\d+)$/);
    a.id = idMatch ? Number(idMatch[1]) : null;
    return a;
  });

  // Update state
  for (const a of final){
    if (a.id && a.id > state.lastSeenId) state.lastSeenId = a.id;
    state.seen[a.url] = true;
  }
  await saveState(state);

  return final;
}

// ---------- CLI ----------
if (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const catIndex = args.indexOf('--cats');
  const cats = catIndex !== -1 ? args.slice(catIndex + 1).filter(a => !a.startsWith('--')) : [];
  const useCats = cats.length ? cats : DEFAULT_CATEGORIES;

  scrapeAm730(useCats, { reset })
    .then(list => {
      const empties = list.filter(a => !a.body).length;
      const sponsored = list.filter(a => a.sponsored).length;
      console.log(`Fetched ${list.length} (empty bodies: ${empties}, sponsored: ${sponsored})`);
      console.log(JSON.stringify(list.slice(0, 3), null, 2));
    })
    .catch(err => {
      console.error('Fatal:', err);
      process.exitCode = 1;
    });
}