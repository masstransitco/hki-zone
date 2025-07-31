// Debug specific HKFP article that's getting wrong image
const HDRS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
}

async function debugSpecificArticle() {
  try {
    // Test an article that should have a different image
    const testUrl = 'https://hongkongfp.com/2025/07/23/hong-kong-teen-arrested-for-allegedly-writing-seditious-words-in-commercial-building-toilet/';
    
    console.log('Debugging specific HKFP article...');
    console.log('URL:', testUrl);
    console.log('Expected: This should have sedition-toilet.jpg or similar, not selina-court.jpg');
    
    const response = await fetch(testUrl, {
      headers: HDRS,
      signal: AbortSignal.timeout(15000),
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const html = await response.text();
    
    const cleanHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
    
    console.log('\n=== STEP-BY-STEP IMAGE EXTRACTION ===');
    
    // Strategy 1: Featured image
    console.log('\n--- Strategy 1: Featured Images ---');
    const featuredPatterns = [
      /<img[^>]*class="[^"]*wp-post-image[^"]*"[^>]*src="([^"]+)"/i,
      /<img[^>]*class="[^"]*featured[^"]*"[^>]*src="([^"]+)"/i,
      /<img[^>]*class="[^"]*attachment[^"]*"[^>]*src="([^"]+)"/i
    ];
    
    let imageUrl = "";
    featuredPatterns.forEach((pattern, i) => {
      const match = cleanHtml.match(pattern);
      console.log(`Pattern ${i + 1}: ${match ? '✅ Found' : '❌ Not found'}`);
      if (match) {
        console.log(`  URL: ${match[1]}`);
        if (!imageUrl) imageUrl = match[1];
      }
    });
    
    // Strategy 2: Lazy featured
    if (!imageUrl) {
      console.log('\n--- Strategy 2: Lazy Featured Images ---');
      const lazyFeaturedPatterns = [
        /<img[^>]*class="[^"]*wp-post-image[^"]*"[^>]*data-src="([^"]+)"/i,
        /<img[^>]*class="[^"]*featured[^"]*"[^>]*data-src="([^"]+)"/i,
        /<img[^>]*class="[^"]*attachment[^"]*"[^>]*data-src="([^"]+)"/i
      ];
      
      lazyFeaturedPatterns.forEach((pattern, i) => {
        const match = cleanHtml.match(pattern);
        console.log(`Lazy Pattern ${i + 1}: ${match ? '✅ Found' : '❌ Not found'}`);
        if (match) {
          console.log(`  URL: ${match[1]}`);
          if (!imageUrl) imageUrl = match[1];
        }
      });
    }
    
    // Strategy 3: Content images
    console.log('\n--- Strategy 3: Content Images ---');
    const contentImageMatches = [...cleanHtml.matchAll(/<img[^>]*src="([^"]+)"[^>]*>/gi)];
    console.log(`Found ${contentImageMatches.length} total img tags`);
    
    const validImages = [];
    contentImageMatches.forEach((match, i) => {
      const src = match[1];
      console.log(`  Image ${i + 1}: ${src}`);
      
      const imgName = src.split('/').pop()?.toLowerCase() || '';
      const isGenericImage = imgName.includes('selina-court') || 
                            imgName.includes('prison') ||
                            imgName.includes('generic') ||
                            imgName.includes('default');
      
      const isValid = (src.includes("hongkongfp.com") || src.includes("wp-content") || src.includes("uploads")) &&
                     !src.includes("data:image/svg") &&
                     !src.includes("Trust-Logos") &&
                     !src.includes("App-Logo") &&
                     !src.includes("deer-sidebar") &&
                     !src.includes("TINY-FAVICON") &&
                     !src.includes("payment-hkfp");
      
      const isPreferred = src.includes("1200x675") || src.includes("1050x") || src.match(/\d{4}\/\d{2}\/[^\/]+\.(jpg|jpeg|png)$/);
      
      console.log(`    Generic: ${isGenericImage ? '✅ Yes' : '❌ No'}`);
      console.log(`    Valid: ${isValid ? '✅ Yes' : '❌ No'}`);
      console.log(`    Preferred: ${isPreferred ? '✅ Yes' : '❌ No'}`);
      
      if (!isGenericImage && isValid) {
        validImages.push(src);
        console.log(`    ✅ Added to valid images list`);
      }
    });
    
    console.log(`\nValid non-generic images found: ${validImages.length}`);
    if (validImages.length > 0 && !imageUrl) {
      imageUrl = validImages[0];
      console.log(`Selected first valid: ${imageUrl}`);
    }
    
    // Strategy 4: Lazy content images
    if (!imageUrl) {
      console.log('\n--- Strategy 4: Lazy Content Images ---');
      const lazyContentMatches = [...cleanHtml.matchAll(/<img[^>]*data-src="([^"]+)"[^>]*>/gi)];
      console.log(`Found ${lazyContentMatches.length} lazy images`);
      
      const validLazyImages = [];
      lazyContentMatches.forEach((match, i) => {
        const src = match[1];
        const isValid = (src.includes("hongkongfp.com") || src.includes("wp-content") || src.includes("uploads")) &&
                       !src.includes("Trust-Logos") &&
                       !src.includes("App-Logo") &&
                       !src.includes("deer-sidebar") &&
                       !src.includes("TINY-FAVICON") &&
                       !src.includes("payment-hkfp");
        
        const isPreferred = src.includes("1200x675") || src.includes("1050x") || src.match(/\d{4}\/\d{2}\/[^\/]+\.jpg$/);
        
        if (isValid && isPreferred) {
          validLazyImages.push(src);
          console.log(`✅ Valid lazy preferred image ${validLazyImages.length}: ${src}`);
        }
      });
      
      if (validLazyImages.length > 0 && !imageUrl) {
        imageUrl = validLazyImages[0];
        console.log(`Selected lazy: ${imageUrl}`);
      }
    }
    
    // Strategy 5: Open Graph
    if (!imageUrl) {
      console.log('\n--- Strategy 5: Open Graph ---');
      const ogImageMatch = cleanHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
      if (ogImageMatch) {
        const ogImage = ogImageMatch[1];
        console.log(`OG Image found: ${ogImage}`);
        
        const urlPath = testUrl.split('/').pop() || '';
        const imageName = ogImage.split('/').pop()?.replace(/\.[^.]+$/, '') || '';
        
        console.log(`URL path: ${urlPath}`);
        console.log(`Image name: ${imageName}`);
        
        const isValidOG = urlPath.includes(imageName.substring(0, 10)) || 
                         ogImage.includes('2025/07/') ||
                         ogImage.includes('wp-content/uploads');
        
        console.log(`OG validation: ${isValidOG ? '✅ Valid' : '❌ Invalid'}`);
        
        if (isValidOG && !imageUrl) {
          imageUrl = ogImage;
          console.log(`Selected OG: ${imageUrl}`);
        }
      } else {
        console.log('No OG image found');
      }
    }
    
    console.log(`\n=== FINAL RESULT ===`);
    console.log(`Selected image: ${imageUrl || 'None - would use fallback'}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugSpecificArticle();