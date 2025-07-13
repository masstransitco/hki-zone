// Improved 28car scraper with optimized image extraction
// Based on analysis - 28car only provides _m.jpg (medium) and _s.jpg (small) variants
// This version prioritizes _m.jpg images and extracts maximum available photos

const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

// Conditional imports based on environment
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;

let puppeteer;
if (isProduction) {
  puppeteer = require('puppeteer-core');
} else {
  puppeteer = require('puppeteer');
}

// Configuration
const LIST_URL = 'http://m.28car.com/sell_lst.php';
const LIST_QUERY = { h_f_ty: 1, h_page: 1, qs_b: 'y', qs_e: 'y' };
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const DELAY_MS = 1300;
const MAX_PHOTOS = 8; // Increased to get more photos per car

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Get browser configuration based on environment
async function getBrowserConfig() {
  if (!isProduction) {
    console.log('🚀 Using local Chrome for development');
    return {
      headless: true,
      ignoreHTTPSErrors: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    };
  }
  
  try {
    const chromiumModule = require('@sparticuz/chromium');
    const chromium = chromiumModule.default || chromiumModule;
    
    console.log('🚀 Using @sparticuz/chromium for serverless environment');
    
    const chromiumPackUrl = process.env.CHROMIUM_PACK_URL || 
      'https://github.com/Sparticuz/chromium/releases/download/v138.0.0/chromium-v138.0.0-pack.x64.tar';
    const execPath = await chromium.executablePath(chromiumPackUrl);
    
    return {
      args: [...chromium.args, '--disable-blink-features=AutomationControlled'],
      defaultViewport: chromium.defaultViewport || { width: 1280, height: 720 },
      executablePath: execPath,
      headless: chromium.headless !== undefined ? chromium.headless : true,
      ignoreHTTPSErrors: true,
    };
  } catch (err) {
    throw new Error(`Failed to load @sparticuz/chromium: ${err.message}. This is required for serverless environments.`);
  }
}

// Optimized image extraction focusing on best available quality
async function extractOptimizedImages(page) {
  const images = [];
  
  try {
    // Extract all images from all frames
    for (const frame of page.frames()) {
      const frameImages = await frame.evaluate(() => {
        return Array.from(document.querySelectorAll('img'))
          .map(img => ({
            src: img.src,
            width: img.naturalWidth || img.width || 0,
            height: img.naturalHeight || img.height || 0
          }))
          .filter(img => 
            img.src.includes('28car.com/data/image/sell/') && 
            !img.src.includes('openp.gif') && 
            !img.src.includes('sold.gif') &&
            !img.src.includes('fr_id_bn.gif')
          );
      });
      
      images.push(...frameImages);
    }
    
    // Process and optimize images
    const processedImages = [];
    const seenBaseUrls = new Set();
    
    for (const img of images) {
      // Remove timestamp from URL to identify base image
      const baseUrl = img.src.split('?')[0];
      const baseKey = baseUrl.replace(/_[a-z0-9]+\.jpg$/i, '');
      
      if (seenBaseUrls.has(baseKey)) continue;
      seenBaseUrls.add(baseKey);
      
      // Determine image quality priority
      let optimizedUrl = img.src;
      let quality = 'medium';
      
      if (img.src.includes('_m.jpg')) {
        // Medium quality - this is the best available on 28car
        optimizedUrl = img.src;
        quality = 'medium';
      } else if (img.src.includes('_s.jpg')) {
        // Small quality - try to find medium version
        const mediumUrl = img.src.replace('_s.jpg', '_m.jpg');
        // Test if medium version exists
        try {
          const response = await axios.head(mediumUrl.split('?')[0], { timeout: 2000 });
          if (response.status === 200) {
            optimizedUrl = mediumUrl;
            quality = 'medium';
          }
        } catch {
          // Medium version doesn't exist, use small
          optimizedUrl = img.src;
          quality = 'small';
        }
      }
      
      processedImages.push({
        url: optimizedUrl,
        quality,
        width: img.width,
        height: img.height,
        resolution: img.width && img.height ? `${img.width}x${img.height}` : 'unknown'
      });
      
      // Limit to MAX_PHOTOS
      if (processedImages.length >= MAX_PHOTOS) break;
    }
    
    return processedImages;
    
  } catch (error) {
    console.warn(`Image extraction failed: ${error.message}`);
    return [];
  }
}

// Main improved scraper function
async function scrape28CarImproved() {
  console.log('🚗 Starting Improved 28car Scraper with Optimized Images...');
  
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

        // Extract additional fields from page content
        const fullContent = await frame.content();
        
        if (!spec['編號']) {
          spec['編號'] = vid;
        }
        
        if (!spec['聯絡人資料']) {
          const contactMatch = fullContent.match(/聯絡[^:：]*[：:]([^<\n]+)/i) ||
                              fullContent.match(/電話[：:]?([0-9\s-]+)/i);
          if (contactMatch) {
            spec['聯絡人資料'] = contactMatch[1].trim();
          }
        }
        
        if (!spec['更新日期']) {
          const dateMatch = fullContent.match(/更新日期[：:]?\s*(\d{4}-\d{2}-\d{2}[\s\d:-]*)/i) ||
                           fullContent.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
          if (dateMatch) {
            spec['更新日期'] = dateMatch[1].trim();
          } else {
            spec['更新日期'] = new Date().toISOString().slice(0, 19).replace('T', ' ');
          }
        }

        if (!spec['售價']) {
          console.warn(`⚠️ 28car: VID ${vid} has no price – skipped`);
          continue;
        }

        // Extract optimized images
        const optimizedImages = await extractOptimizedImages(page);

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
          imageUrl: optimizedImages.length > 0 ? optimizedImages[0].url : img,
          images: optimizedImages.map(img => img.url), // Array of optimized image URLs
          category: 'cars',
          specs: spec,
          // Additional metadata for image optimization tracking
          imageMetadata: {
            totalImages: optimizedImages.length,
            qualityDistribution: optimizedImages.reduce((acc, img) => {
              acc[img.quality] = (acc[img.quality] || 0) + 1;
              return acc;
            }, {}),
            bestResolution: optimizedImages.length > 0 ? optimizedImages[0].resolution : 'unknown'
          }
        };

        cars.push(car);
        
        const imageInfo = optimizedImages.length > 0 
          ? `+${optimizedImages.length} optimized images (best: ${optimizedImages[0].quality})`
          : 'no images';
        
        console.log(`✅ 28car: ${cars.length}/${seen.size} ${car.title} (${imageInfo})`);
        
      } catch (err) {
        console.warn(`❌ 28car: VID ${vid} failed - ${err.message}`);
      }
      
      await sleep(DELAY_MS);
    }

    console.log(`🚗 28car: Completed with ${cars.length} cars`);
    
    // Print image optimization summary
    if (cars.length > 0) {
      const totalImages = cars.reduce((sum, car) => sum + car.images.length, 0);
      const avgImagesPerCar = totalImages / cars.length;
      
      console.log(`📸 Image Summary: ${totalImages} total images, ${avgImagesPerCar.toFixed(1)} avg per car`);
      
      // Count quality distribution
      const qualityCount = { medium: 0, small: 0 };
      cars.forEach(car => {
        if (car.imageMetadata?.qualityDistribution) {
          Object.entries(car.imageMetadata.qualityDistribution).forEach(([quality, count]) => {
            qualityCount[quality] = (qualityCount[quality] || 0) + count;
          });
        }
      });
      
      console.log(`📸 Quality Distribution: ${qualityCount.medium || 0} medium, ${qualityCount.small || 0} small`);
    }
    
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

function parseCarTitle(raw) {
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
  
  // Core vehicle information
  if (spec['編號']) description.push(`Listing ID: ${spec['編號']}`);
  if (spec['車類']) description.push(`Vehicle Type: ${spec['車類']}`);
  if (spec['車廠']) description.push(`Make: ${spec['車廠']}`);
  if (spec['型號']) description.push(`Model: ${spec['型號']}`);
  if (spec['年份']) description.push(`Year: ${spec['年份']}`);
  if (spec['售價']) description.push(`Price: ${spec['售價']}`);
  
  // Engine and transmission details
  if (spec['引擎']) description.push(`Engine: ${spec['引擎']}`);
  if (spec['容積']) description.push(`Displacement: ${spec['容積']}`);
  if (spec['燃料'] || spec['燃炓']) description.push(`Fuel: ${spec['燃料'] || spec['燃炓']}`);
  if (spec['波箱'] || spec['傳動']) description.push(`Transmission: ${spec['波箱'] || spec['傳動']}`);
  
  // Physical details
  if (spec['座位']) description.push(`Seats: ${spec['座位']}`);
  if (spec['車門']) description.push(`Doors: ${spec['車門']}`);
  if (spec['顏色']) description.push(`Color: ${spec['顏色']}`);
  if (spec['里程']) description.push(`Mileage: ${spec['里程']}`);
  
  // Contact and update information
  if (spec['聯絡人資料']) description.push(`Contact: ${spec['聯絡人資料']}`);
  if (spec['更新日期']) description.push(`Updated: ${spec['更新日期']}`);
  if (spec['簡評']) description.push(`Description: ${spec['簡評']}`);
  
  return description.join(', ');
}

// Export both functions for compatibility
async function scrape28Car() {
  const cars = await scrape28CarImproved();
  return cars.map(car => ({
    title: car.title,
    url: car.url
  }));
}

async function scrape28CarWithContent() {
  return await scrape28CarImproved();
}

module.exports = { 
  scrape28Car, 
  scrape28CarWithContent,
  scrape28CarImproved 
};