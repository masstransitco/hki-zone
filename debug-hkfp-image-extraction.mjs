// Debug HKFP image extraction issues
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Let's test individual article extraction to see what's happening
const HDRS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
}

async function debugHKFPImageExtraction() {
  try {
    // Test a specific HKFP article
    const testUrl = 'https://hongkongfp.com/2025/07/23/wall-st-journal-set-to-plead-not-guilty-in-unlawful-termination-suit-filed-by-press-union-chief-selina-cheng/';
    
    console.log('Debugging HKFP image extraction...');
    console.log('Test URL:', testUrl);
    
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
    
    console.log('\n=== TESTING IMAGE EXTRACTION STRATEGIES ===');
    
    // Strategy 1: Featured image classes
    console.log('\n--- Strategy 1: Featured Image Classes ---');
    const featuredImagePatterns = [
      /<img[^>]*class="[^"]*wp-post-image[^"]*"[^>]*src="([^"]+)"/i,
      /<img[^>]*class="[^"]*featured[^"]*"[^>]*src="([^"]+)"/i,
      /<img[^>]*class="[^"]*attachment[^"]*"[^>]*src="([^"]+)"/i
    ];
    
    featuredImagePatterns.forEach((pattern, i) => {
      const match = cleanHtml.match(pattern);
      console.log(`Pattern ${i + 1}: ${match ? '✅ Found' : '❌ Not found'}`);
      if (match) console.log(`  URL: ${match[1]}`);
    });
    
    // Strategy 2: Open Graph
    console.log('\n--- Strategy 2: Open Graph Meta ---');
    const ogImageMatch = cleanHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    console.log(`OG Image: ${ogImageMatch ? '✅ Found' : '❌ Not found'}`);
    if (ogImageMatch) console.log(`  URL: ${ogImageMatch[1]}`);
    
    // Strategy 3: Content images
    console.log('\n--- Strategy 3: Content Images ---');
    const contentImageMatches = cleanHtml.match(/<img[^>]*src="([^"]+)"[^>]*>/gi) || [];
    console.log(`Found ${contentImageMatches.length} img tags total`);
    
    const validContentImages = [];
    contentImageMatches.forEach((imgTag, i) => {
      const srcMatch = imgTag.match(/src="([^"]+)"/);
      if (srcMatch) {
        const src = srcMatch[1];
        console.log(`  Img ${i + 1}: ${src}`);
        
        // Check if it meets criteria
        if (src.includes("hongkongfp.com") || src.includes("wp-content") || src.includes("uploads")) {
          validContentImages.push(src);
          console.log(`    ✅ Valid HKFP image`);
        } else {
          console.log(`    ❌ Not HKFP image`);
        }
      }
    });
    
    console.log(`\nValid content images found: ${validContentImages.length}`);
    
    // Test for lazy loading attributes
    console.log('\n--- Strategy 4: Lazy Loading Detection ---');
    const lazyImagePatterns = [
      /<img[^>]*data-src="([^"]+)"[^>]*>/gi,
      /<img[^>]*data-original="([^"]+)"[^>]*>/gi,
      /<img[^>]*data-lazy="([^"]+)"[^>]*>/gi
    ];
    
    lazyImagePatterns.forEach((pattern, i) => {
      const matches = [...cleanHtml.matchAll(pattern)];
      console.log(`Lazy pattern ${i + 1}: Found ${matches.length} matches`);
      matches.slice(0, 3).forEach((match, j) => {
        console.log(`  ${j + 1}: ${match[1]}`);
      });
    });
    
    // Test JSON-LD structured data
    console.log('\n--- Strategy 5: JSON-LD Structured Data ---');
    const jsonLdMatches = cleanHtml.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || [];
    console.log(`Found ${jsonLdMatches.length} JSON-LD scripts`);
    
    jsonLdMatches.forEach((script, i) => {
      try {
        const jsonText = script.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
        const json = JSON.parse(jsonText);
        console.log(`  Script ${i + 1}: Type = ${json['@type'] || 'unknown'}`);
        
        if (json.image) {
          console.log(`    Image found: ${Array.isArray(json.image) ? json.image[0] : json.image}`);
        }
      } catch (e) {
        console.log(`  Script ${i + 1}: Parse error`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugHKFPImageExtraction();