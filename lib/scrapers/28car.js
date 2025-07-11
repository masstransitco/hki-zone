// Enhanced 28car scraper based on working scrape-28car.js
// Follows existing scraper patterns for consistency

const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
// Conditional imports based on environment
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;

let puppeteer;
if (isProduction) {
  // Use puppeteer-core in production with @sparticuz/chromium
  puppeteer = require('puppeteer-core');
} else {
  // Use regular puppeteer in development (avoid webpack issues with puppeteer-extra)
  puppeteer = require('puppeteer');
}

// Function to get browser configuration based on environment
async function getBrowserConfig() {
  if (!isProduction) {
    // Use local Chrome for development
    console.log('🚀 Using local Chrome for development');
    return {
      headless: true,
      ignoreHTTPSErrors: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    };
  }
  
  try {
    // Try loading @sparticuz/chromium
    const chromiumModule = require('@sparticuz/chromium');
    const chromium = chromiumModule.default || chromiumModule;
    
    console.log('🚀 Using @sparticuz/chromium for serverless environment');
    
    // Get executable path - provide URL for Vercel serverless
    // Using v138 to match our @sparticuz/chromium version 138.0.1
    const chromiumPackUrl = process.env.CHROMIUM_PACK_URL || 
      'https://github.com/Sparticuz/chromium/releases/download/v138.0.0/chromium-v138.0.0-pack.tar';
    const execPath = await chromium.executablePath(chromiumPackUrl);
    console.log('📍 Executable path:', execPath);
    
    return {
      args: [...chromium.args, '--disable-blink-features=AutomationControlled'],
      defaultViewport: chromium.defaultViewport || { width: 1280, height: 720 },
      executablePath: execPath,
      headless: chromium.headless !== undefined ? chromium.headless : true,
      ignoreHTTPSErrors: true,
    };
  } catch (err) {
    console.error('⚠️ @sparticuz/chromium failed with error:', err);
    
    // For Vercel/serverless, we must have a valid executable path
    // If @sparticuz/chromium fails, we cannot proceed
    throw new Error(`Failed to load @sparticuz/chromium: ${err.message}. This is required for serverless environments.`);
  }
}

// Config
const LIST_URL = 'http://m.28car.com/sell_lst.php';
const LIST_QUERY = { h_f_ty: 1, h_page: 1, qs_b: 'y', qs_e: 'y' }; // private listings p-1
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

const DELAY_MS = 1300;   // polite pause between detail pages
const MAX_PHOTOS = 5;      // fetch ≤ N photos per car
const PLACEHOLDER_RE = /(openp|sold|fr_id_bn)\.gif$/i;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scrape28CarWithContent() {
  console.log('🚗 Starting 28car scraper...');
  
  // Get browser configuration for the current environment
  const browserConfig = await getBrowserConfig();
  
  const browser = await puppeteer.launch(browserConfig);
  
  const page = await browser.newPage();
  
  // Set mobile user agent and locale
  await page.setUserAgent(MOBILE_UA);
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'zh-HK,zh;q=0.9,en;q=0.8'
  });
  
  try {
    // 1. Get listing page
    const res = await axios.get(LIST_URL, {
      params: LIST_QUERY,
      headers: { 'User-Agent': MOBILE_UA },
      responseType: 'arraybuffer'
    });
    
    const html = iconv.decode(res.data, 'big5');
    const $l = cheerio.load(html);

    // 2. Collect VIDs + thumb + raw title
    const list = [];
    $l('td[onclick^="go"]').each((_, td) => {
      const vid = ($l(td).attr('onclick') || '').match(/\w+\([^,]+,\s*(\d+)/)?.[1];
      if (!vid) return;
      const tr = $l(td).closest('tr');
      const img = tr.find('img').first().attr('src') || '';
      const raw = tr.find('td').eq(1).text().trim().replace(/\s+/g, ' ');
      list.push({ vid, img, raw });
    });

    if (!list.length) {
      console.error('❌ 28car: list parse failed – layout changed.');
      return [];
    }

    console.log(`🚗 28car: Found ${list.length} listings`);
    
    const seen = new Set();
    const cars = [];

    // 3. Extract car details
    for (const { vid, img, raw } of list) {
      if (seen.has(vid)) continue;
      seen.add(vid);

      const url = `http://m.28car.com/sell_dsp.php?h_vid=${vid}&h_vw=y`;
      
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

        // Locate spec frame
        const frame = await findSpecFrame(page);
        
        // Extract specifications
        const $spec = cheerio.load(await frame.content(), null, false);
        const spec = {};
        $spec('tr').each((_, tr) => {
          const td = $spec(tr).find('td');
          if (td.length < 2) return;
          const key = $spec(td[0]).text().replace(/[：:\s\u00A0]+$/g, '').trim();
          const val = $spec(td[1]).text().trim().replace(/\s+/g, ' ');
          if (key) spec[key] = val;
        });

        if (!spec['售價']) {
          console.warn(`⚠️ 28car: VID ${vid} has no price – skipped`);
          continue;
        }

        // Extract photos
        const imgsFull = await extractPhotos(page);

        // Parse make/model from title
        const { make, model } = parseCarTitle(raw);

        const car = {
          title: `${make} ${model}`,
          make: make || '—',
          model: model || raw,
          year: spec['年份'] || '—',
          price: spec['售價'],
          content: buildCarDescription(spec),
          summary: `${make} ${model} - ${spec['售價']}`,
          url,
          source: '28car',
          author: '28car',
          publishDate: new Date().toISOString(),
          imageUrl: imgsFull.length > 0 ? imgsFull[0] : img,
          images: imgsFull,
          category: 'cars',
          specs: spec
        };

        cars.push(car);
        console.log(`✅ 28car: ${cars.length}/${seen.size} ${car.title} (+${imgsFull.length} photos)`);
        
      } catch (err) {
        console.warn(`❌ 28car: VID ${vid} failed - ${err.message}`);
      }
      
      await sleep(DELAY_MS);
    }

    console.log(`🚗 28car: Completed with ${cars.length} cars`);
    return cars;
    
  } catch (error) {
    console.error('❌ 28car scraping failed:', error);
    return [];
  } finally {
    await browser.close();
  }
}

async function findSpecFrame(page) {
  for (let t = 0; t < 15; t++) {
    const tgt = await (async function rec(fr) {
      for (const f of fr) {
        if ((await f.content()).includes('售價')) return f;
        const deep = await rec(f.childFrames());
        if (deep) return deep;
      }
    })(page.frames());
    if (tgt) return tgt;
    await sleep(400);
  }
  return page.mainFrame();
}

async function extractPhotos(page) {
  const imgsFull = [];
  
  // Extract images directly from the page
  for (const f of page.frames()) {
    const images = await f.evaluate(() => {
      return Array.from(document.querySelectorAll('img'))
        .map(img => img.src)
        .filter(src => 
          src.includes('djlfajk23a.28car.com/data/image/sell/') ||
          src.includes('28car.com/data/image/sell/')
        );
    });
    
    for (const imgSrc of images) {
      if (!imgsFull.includes(imgSrc)) {
        imgsFull.push(imgSrc);
      }
    }
    
    // Limit to MAX_PHOTOS
    if (imgsFull.length >= MAX_PHOTOS) break;
  }
  
  return imgsFull;
}

function parseCarTitle(raw) {
  // Extract make and model from raw title
  const parts = raw.trim().split(/\s+/);
  if (parts.length >= 2) {
    return {
      make: parts[0],
      model: parts.slice(1).join(' ')
    };
  }
  return {
    make: parts[0] || '—',
    model: raw
  };
}

function buildCarDescription(spec) {
  const description = [];
  
  if (spec['車廠']) description.push(`Make: ${spec['車廠']}`);
  if (spec['型號']) description.push(`Model: ${spec['型號']}`);
  if (spec['年份']) description.push(`Year: ${spec['年份']}`);
  if (spec['售價']) description.push(`Price: ${spec['售價']}`);
  if (spec['引擎']) description.push(`Engine: ${spec['引擎']}`);
  if (spec['波箱']) description.push(`Transmission: ${spec['波箱']}`);
  if (spec['燃料']) description.push(`Fuel: ${spec['燃料']}`);
  if (spec['車門']) description.push(`Doors: ${spec['車門']}`);
  if (spec['顏色']) description.push(`Color: ${spec['顏色']}`);
  if (spec['里程']) description.push(`Mileage: ${spec['里程']}`);
  
  return description.join(', ');
}

// Original headline scraper (for compatibility)
async function scrape28Car() {
  const cars = await scrape28CarWithContent();
  return cars.map(car => ({
    title: car.title,
    url: car.url
  }));
}

module.exports = { scrape28Car, scrape28CarWithContent };