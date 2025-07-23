// Test single HKFP article extraction
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { scrapeHKFPWithContent } = require('./lib/scrapers/hkfp.js');

async function testSingleArticle() {
  try {
    // Import the extraction function directly
    const hkfpModule = require('./lib/scrapers/hkfp.js');
    
    // Test the sedition toilet article specifically
    const testUrl = 'https://hongkongfp.com/2025/07/23/hong-kong-teen-arrested-for-allegedly-writing-seditious-words-in-commercial-building-toilet/';
    
    console.log('Testing single HKFP article extraction...');
    console.log('URL:', testUrl);
    console.log('Expected: Should get DSC_5594-Copy.jpg, not selina-court.jpg');
    
    // Test using the internal extraction function
    const HDRS = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    };

    const response = await fetch(testUrl, {
      headers: HDRS,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();

    // Clean HTML
    const cleanHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");

    // Strategy 1: Featured image
    let imageUrl = "";
    const featuredImageMatch =
      cleanHtml.match(/<img[^>]*class="[^"]*wp-post-image[^"]*"[^>]*src="([^"]+)"/i) ||
      cleanHtml.match(/<img[^>]*class="[^"]*featured[^"]*"[^>]*src="([^"]+)"/i) ||
      cleanHtml.match(/<img[^>]*class="[^"]*attachment[^"]*"[^>]*src="([^"]+)"/i);

    let featuredImageUrl = "";
    if (featuredImageMatch) {
      const featuredImg = featuredImageMatch[1];
      const imgName = featuredImg.split('/').pop()?.toLowerCase() || '';
      
      console.log(`Found featured image: ${featuredImg}`);
      console.log(`Image name: ${imgName}`);
      
      const isGenericImage = imgName.includes('selina-court') || 
                            imgName.includes('prison') ||
                            imgName.includes('generic') ||
                            imgName.includes('default') ||
                            imgName.includes('placeholder') ||
                            imgName.includes('logo') ||
                            imgName.includes('avatar');
      
      console.log(`Is generic: ${isGenericImage}`);
      
      if (!isGenericImage) {
        imageUrl = featuredImg;
        console.log(`Using featured image: ${imageUrl}`);
      } else {
        featuredImageUrl = featuredImg;
        console.log(`Storing generic featured image for fallback: ${featuredImageUrl}`);
      }
    }

    // Strategy 3: Content images
    if (!imageUrl) {
      console.log('\nLooking for content images...');
      const contentImageMatches = [...cleanHtml.matchAll(/<img[^>]*src="([^"]+)"[^>]*>/gi)];
      const validImages = [];
      
      console.log(`Found ${contentImageMatches.length} total images`);
      
      for (const match of contentImageMatches) {
        const src = match[1];
        const imgName = src.split('/').pop()?.toLowerCase() || '';
        
        // Skip generic images
        const isGenericImage = imgName.includes('selina-court') || 
                              imgName.includes('prison') ||
                              imgName.includes('generic') ||
                              imgName.includes('default') ||
                              imgName.includes('placeholder') ||
                              imgName.includes('logo') ||
                              imgName.includes('avatar');
        
        const isHKFPImage = src.includes("hongkongfp.com") || src.includes("wp-content") || src.includes("uploads");
        const isNotExcluded = !src.includes("data:image/svg") &&
                             !src.includes("Trust-Logos") &&
                             !src.includes("App-Logo") &&
                             !src.includes("deer-sidebar") &&
                             !src.includes("TINY-FAVICON") &&
                             !src.includes("payment-hkfp") &&
                             !src.includes("hkfp-promo");
        
        const hasGoodSize = src.includes("1200x675") || src.includes("1050x") || src.match(/\d{4}\/\d{2}\/[^\/]+\.(jpg|jpeg|png)$/);
        
        if (src === 'https://hongkongfp.com/wp-content/uploads/2021/09/DSC_5594-Copy.jpg') {
          console.log(`\n🎯 Found target image: ${src}`);
          console.log(`  Generic: ${isGenericImage}`);
          console.log(`  HKFP Image: ${isHKFPImage}`);
          console.log(`  Not excluded: ${isNotExcluded}`);
          console.log(`  Good size: ${hasGoodSize}`);
          console.log(`  Overall valid: ${!isGenericImage && isHKFPImage && isNotExcluded && hasGoodSize}`);
        }
        
        if (!isGenericImage && isHKFPImage && isNotExcluded && hasGoodSize) {
          validImages.push(src);
          if (validImages.length <= 5) {
            console.log(`  ✅ Valid image ${validImages.length}: ${src}`);
          }
        }
      }
      
      console.log(`\nFound ${validImages.length} valid content images`);
      
      if (validImages.length > 0) {
        imageUrl = validImages[0];
        console.log(`Selected first valid image: ${imageUrl}`);
      }
    }

    // Fallback
    if (!imageUrl && featuredImageUrl) {
      imageUrl = featuredImageUrl;
      console.log(`Using fallback featured image: ${imageUrl}`);
    }

    console.log(`\n=== FINAL RESULT ===`);
    console.log(`Selected image: ${imageUrl}`);
    console.log(`Expected: DSC_5594-Copy.jpg`);
    console.log(`Success: ${imageUrl.includes('DSC_5594-Copy.jpg') ? '✅ YES' : '❌ NO'}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSingleArticle();