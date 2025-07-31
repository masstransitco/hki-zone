// Test single HKFP article using the actual scraper
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Force module reload by deleting from cache
delete require.cache[require.resolve('./lib/scrapers/hkfp.js')];
const { scrapeHKFPWithContent } = require('./lib/scrapers/hkfp.js');

console.log('Testing specific HKFP article with updated scraper...');

async function testSpecificArticle() {
  try {
    // Get all articles first
    const articles = await scrapeHKFPWithContent();
    
    // Find the sedition toilet article specifically
    const targetArticle = articles.find(article => 
      article.url.includes('seditious-words-in-commercial-building-toilet')
    );
    
    if (targetArticle) {
      console.log('\n=== SEDITION TOILET ARTICLE ===');
      console.log(`Title: ${targetArticle.title}`);
      console.log(`URL: ${targetArticle.url}`);
      console.log(`Image: ${targetArticle.imageUrl}`);
      console.log(`Expected: Should contain DSC_5594-Copy.jpg`);
      console.log(`Success: ${targetArticle.imageUrl.includes('DSC_5594-Copy.jpg') ? '✅ YES' : '❌ NO'}`);
      
      if (targetArticle.imageUrl.includes('selina-court.jpg')) {
        console.log('⚠️  Still getting generic selina-court.jpg image');
      }
    } else {
      console.log('❌ Could not find sedition toilet article');
      console.log('Available articles:');
      articles.forEach((article, i) => {
        console.log(`${i + 1}. ${article.title.substring(0, 60)}...`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSpecificArticle();