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
    // Note: Vercel runs on x64 architecture
    const chromiumPackUrl = process.env.CHROMIUM_PACK_URL || 
      'https://github.com/Sparticuz/chromium/releases/download/v138.0.0/chromium-v138.0.0-pack.x64.tar';
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
const MAX_PHOTOS = 8;      // fetch ≤ N photos per car (increased for better coverage)
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
        
        // Extract specifications with enhanced field mapping
        const $spec = cheerio.load(await frame.content(), null, false);
        const spec = {};
        $spec('tr').each((_, tr) => {
          const td = $spec(tr).find('td');
          if (td.length < 2) return;
          const key = $spec(td[0]).text().replace(/[：:\s\u00A0]+$/g, '').trim();
          const val = $spec(td[1]).text().trim().replace(/\s+/g, ' ');
          if (key) spec[key] = val;
        });

        // Extract additional fields that might not be in the spec table
        const fullContent = await frame.content();
        const $full = cheerio.load(fullContent, null, false);
        
        // Try to extract listing ID from URL or page content
        if (!spec['編號']) {
          spec['編號'] = vid; // Use the VID as listing ID
        }
        
        // Extract contact information from page content
        if (!spec['聯絡人資料']) {
          const contactMatch = fullContent.match(/聯絡[^:：]*[：:]([^<\n]+)/i) ||
                              fullContent.match(/電話[：:]?([0-9\s-]+)/i) ||
                              fullContent.match(/([A-Za-z\u4e00-\u9fff]+\s*電話[：:]?[0-9\s-]+)/i);
          if (contactMatch) {
            spec['聯絡人資料'] = contactMatch[1].trim();
          }
        }
        
        // Extract update date from page content
        if (!spec['更新日期']) {
          const dateMatch = fullContent.match(/更新日期[：:]?\s*(\d{4}-\d{2}-\d{2}[\s\d:-]*)/i) ||
                           fullContent.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
          if (dateMatch) {
            spec['更新日期'] = dateMatch[1].trim();
          } else {
            // Fallback to current date if not found
            spec['更新日期'] = new Date().toISOString().slice(0, 19).replace('T', ' ');
          }
        }

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
        
        // Enhanced logging with image quality info including new high-res
        const bigImages = imgsFull.filter(img => img.includes('_b.jpg')).length;
        const mediumImages = imgsFull.filter(img => img.includes('_m.jpg')).length;
        const smallImages = imgsFull.filter(img => img.includes('_s.jpg')).length;
        
        let imageQuality = '';
        if (bigImages > 0) imageQuality += `${bigImages}B`;
        if (mediumImages > 0) imageQuality += (imageQuality ? '+' : '') + `${mediumImages}M`;
        if (smallImages > 0) imageQuality += (imageQuality ? '+' : '') + `${smallImages}S`;
        if (!imageQuality) imageQuality = `${imgsFull.length}?`;
        
        console.log(`✅ 28car: ${cars.length}/${seen.size} ${car.title} (+${imgsFull.length} photos: ${imageQuality})`);
        
      } catch (err) {
        console.warn(`❌ 28car: VID ${vid} failed - ${err.message}`);
      }
      
      await sleep(DELAY_MS);
    }

    console.log(`🚗 28car: Completed with ${cars.length} cars`);
    
    // Print image optimization summary with high-res stats
    if (cars.length > 0) {
      const totalImages = cars.reduce((sum, car) => sum + car.images.length, 0);
      const bigImages = cars.reduce((sum, car) => 
        sum + car.images.filter(img => img.includes('_b.jpg')).length, 0);
      const mediumImages = cars.reduce((sum, car) => 
        sum + car.images.filter(img => img.includes('_m.jpg')).length, 0);
      const smallImages = cars.reduce((sum, car) => 
        sum + car.images.filter(img => img.includes('_s.jpg')).length, 0);
      const avgImagesPerCar = totalImages / cars.length;
      const bigPercentage = totalImages > 0 ? ((bigImages / totalImages) * 100).toFixed(1) : 0;
      
      console.log(`📸 Image Summary: ${totalImages} total images, ${avgImagesPerCar.toFixed(1)} avg per car`);
      console.log(`📸 Quality Distribution: ${bigImages}B + ${mediumImages}M + ${smallImages}S`);
      if (bigImages > 0) {
        console.log(`🎉 High-res success: ${bigImages}/${totalImages} images are high-resolution (${bigPercentage}%)`);
      }
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

// Test if an image URL exists and get its size
async function testImageUrl(url, timeout = 2000) {
  try {
    const response = await axios.head(url, { 
      timeout,
      validateStatus: (status) => status < 400
    });
    
    if (response.status === 200) {
      return {
        url,
        size: parseInt(response.headers['content-length']) || 0,
        exists: true
      };
    }
  } catch (error) {
    // URL doesn't exist or error
  }
  
  return { url, exists: false, size: 0 };
}

// Extract high-resolution images by simulating modal gallery interaction
async function extractHighResImagesFromModal(page) {
  const highResImages = [];
  
  try {
    console.log('🖼️ Attempting to trigger modal gallery for high-res images...');
    
    // Find clickable images
    const clickableImages = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img'))
        .filter(img => img.src.includes('28car.com/data/image/sell/'))
        .map(img => img.src);
    });
    
    if (clickableImages.length === 0) {
      return highResImages;
    }
    
    // Monitor network requests for _b.jpg images
    const modalImageUrls = new Set();
    
    const responseHandler = (response) => {
      const url = response.url();
      if (url.includes('_b.jpg') && url.includes('28car.com/data/image/sell/')) {
        modalImageUrls.add(url);
        console.log(`📸 High-res image loaded: ${url.split('/').pop()}`);
      }
    };
    
    page.on('response', responseHandler);
    
    try {
      // Click on the first image to trigger modal gallery (using Puppeteer syntax)
      await page.click('img');
      
      // Wait for modal gallery to load
      await sleep(2000);
      
      // Extract any _b.jpg images that are now in the DOM
      const modalImages = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img'))
          .filter(img => img.src.includes('_b.jpg'))
          .map(img => ({
            src: img.src,
            width: img.naturalWidth || img.width || 0,
            height: img.naturalHeight || img.height || 0
          }));
      });
      
      // Add modal images to our collection
      for (const img of modalImages) {
        if (!modalImageUrls.has(img.src)) {
          modalImageUrls.add(img.src);
        }
      }
      
    } catch (clickError) {
      console.log(`⚠️ Could not trigger modal gallery: ${clickError.message}`);
    }
    
    // Remove response handler
    page.off('response', responseHandler);
    
    // Convert to array and deduplicate
    highResImages.push(...Array.from(modalImageUrls));
    
    if (highResImages.length > 0) {
      console.log(`🎉 Found ${highResImages.length} high-resolution (_b.jpg) images from modal gallery`);
    }
    
  } catch (error) {
    console.warn(`⚠️ Modal gallery extraction failed: ${error.message}`);
  }
  
  return highResImages;
}

async function extractPhotos(page) {
  const imgsFull = [];
  
  try {
    // Step 1: Try to extract high-resolution images from modal gallery
    const highResImages = await extractHighResImagesFromModal(page);
    
    // Step 2: Extract standard images from all frames with metadata
    const allImages = [];
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
      
      allImages.push(...frameImages);
    }
    
    // Step 3: Process and optimize images with priority: _b.jpg > _m.jpg > _s.jpg
    const seenBaseUrls = new Set();
    
    // First, add any high-res images we found from modal gallery
    for (const highResUrl of highResImages) {
      const baseKey = highResUrl.split('?')[0].replace(/_[a-z0-9]+\.jpg$/i, '');
      if (!seenBaseUrls.has(baseKey)) {
        seenBaseUrls.add(baseKey);
        imgsFull.push(highResUrl);
        console.log(`🎯 High-res from modal: ${highResUrl.split('/').pop()}`);
      }
      
      if (imgsFull.length >= MAX_PHOTOS) break;
    }
    
    // Then process standard images, trying to upgrade to higher quality
    for (const img of allImages) {
      if (imgsFull.length >= MAX_PHOTOS) break;
      
      // Remove timestamp from URL to identify base image
      const baseUrl = img.src.split('?')[0];
      const baseKey = baseUrl.replace(/_[a-z0-9]+\.jpg$/i, '');
      
      if (seenBaseUrls.has(baseKey)) continue;
      seenBaseUrls.add(baseKey);
      
      // Determine best available quality: _b.jpg > _m.jpg > _s.jpg
      let optimizedUrl = img.src;
      let qualityLevel = 'original';
      
      if (img.src.includes('_s.jpg')) {
        // Small quality - try to upgrade to big or medium
        const bigUrl = img.src.replace('_s.jpg', '_b.jpg');
        const mediumUrl = img.src.replace('_s.jpg', '_m.jpg');
        
        const bigTest = await testImageUrl(bigUrl.split('?')[0], 1500);
        if (bigTest.exists) {
          optimizedUrl = bigUrl;
          qualityLevel = 'big';
          console.log(`📸 Upgraded to BIG quality: ${baseKey}_b.jpg (${bigTest.size} bytes)`);
        } else {
          const mediumTest = await testImageUrl(mediumUrl.split('?')[0], 1500);
          if (mediumTest.exists) {
            optimizedUrl = mediumUrl;
            qualityLevel = 'medium';
            console.log(`📸 Upgraded to medium quality: ${baseKey}_m.jpg`);
          }
        }
      } else if (img.src.includes('_m.jpg')) {
        // Medium quality - try to upgrade to big
        const bigUrl = img.src.replace('_m.jpg', '_b.jpg');
        const bigTest = await testImageUrl(bigUrl.split('?')[0], 1500);
        
        if (bigTest.exists) {
          optimizedUrl = bigUrl;
          qualityLevel = 'big';
          console.log(`📸 Upgraded to BIG quality: ${baseKey}_b.jpg (${bigTest.size} bytes)`);
        } else {
          qualityLevel = 'medium';
        }
      }
      
      imgsFull.push(optimizedUrl);
    }
    
  } catch (error) {
    console.warn(`Advanced image extraction failed: ${error.message}`);
    
    // Fallback to original method
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
      
      if (imgsFull.length >= MAX_PHOTOS) break;
    }
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

// Original headline scraper (for compatibility)
async function scrape28Car() {
  const cars = await scrape28CarWithContent();
  return cars.map(car => ({
    title: car.title,
    url: car.url
  }));
}

module.exports = { scrape28Car, scrape28CarWithContent };