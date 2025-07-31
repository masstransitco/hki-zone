// Test HKFP image extraction to identify issues
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { scrapeHKFPWithContent } = require('./lib/scrapers/hkfp.js');

console.log('Testing HKFP image extraction...');

async function testHKFPImages() {
  try {
    const articles = await scrapeHKFPWithContent();
    
    console.log(`\n=== HKFP IMAGE EXTRACTION TEST (${articles.length} articles) ===`);
    
    // Analyze image URLs
    const imageAnalysis = {
      total: articles.length,
      withImages: 0,
      unsplashFallback: 0,
      validImages: 0,
      brokenImages: 0,
      imageTypes: {}
    };
    
    console.log('\n=== INDIVIDUAL ARTICLE ANALYSIS ===');
    
    for (let i = 0; i < Math.min(articles.length, 5); i++) {
      const article = articles[i];
      console.log(`\n${i + 1}. ${article.title.substring(0, 60)}...`);
      console.log(`   URL: ${article.url}`);
      console.log(`   Image: ${article.imageUrl}`);
      
      // Analyze image URL
      if (article.imageUrl) {
        imageAnalysis.withImages++;
        
        if (article.imageUrl.includes('unsplash.com')) {
          imageAnalysis.unsplashFallback++;
          console.log(`   Status: ⚠️  Using fallback Unsplash image`);
        } else if (article.imageUrl.includes('hongkongfp.com')) {
          imageAnalysis.validImages++;
          console.log(`   Status: ✅ Valid HKFP image`);
        } else {
          console.log(`   Status: ❓ Unknown image source`);
        }
        
        // Track image domain
        try {
          const domain = new URL(article.imageUrl).hostname;
          imageAnalysis.imageTypes[domain] = (imageAnalysis.imageTypes[domain] || 0) + 1;
        } catch (e) {
          console.log(`   Status: ❌ Invalid URL format`);
          imageAnalysis.brokenImages++;
        }
      } else {
        console.log(`   Status: ❌ No image URL`);
      }
      
      // Show content length
      console.log(`   Content: ${article.content ? article.content.length : 0} characters`);
    }
    
    console.log(`\n=== OVERALL IMAGE STATISTICS ===`);
    console.log(`Total articles: ${imageAnalysis.total}`);
    console.log(`Articles with images: ${imageAnalysis.withImages}/${imageAnalysis.total} (${Math.round(imageAnalysis.withImages/imageAnalysis.total*100)}%)`);
    console.log(`Valid HKFP images: ${imageAnalysis.validImages}/${imageAnalysis.total} (${Math.round(imageAnalysis.validImages/imageAnalysis.total*100)}%)`);
    console.log(`Unsplash fallbacks: ${imageAnalysis.unsplashFallback}/${imageAnalysis.total} (${Math.round(imageAnalysis.unsplashFallback/imageAnalysis.total*100)}%)`);
    console.log(`Broken/invalid images: ${imageAnalysis.brokenImages}/${imageAnalysis.total} (${Math.round(imageAnalysis.brokenImages/imageAnalysis.total*100)}%)`);
    
    console.log(`\n=== IMAGE DOMAINS ===`);
    Object.entries(imageAnalysis.imageTypes).forEach(([domain, count]) => {
      console.log(`${domain}: ${count} articles`);
    });
    
    // Success rate assessment
    const successRate = Math.round(imageAnalysis.validImages/imageAnalysis.total*100);
    if (successRate >= 80) {
      console.log(`\n🎯 Image extraction success rate: ${successRate}% - Good`);
    } else if (successRate >= 50) {
      console.log(`\n⚠️  Image extraction success rate: ${successRate}% - Needs improvement`);
    } else {
      console.log(`\n❌ Image extraction success rate: ${successRate}% - Significant issues`);
    }
    
  } catch (error) {
    console.error('Error testing HKFP images:', error.message);
  }
}

testHKFPImages();