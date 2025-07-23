// Test HK01 content extraction to identify truncation issues
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { scrapeHK01WithContent } = require('./lib/scrapers/hk01.js');

console.log('Testing HK01 content extraction...');

async function testHK01Content() {
  try {
    const articles = await scrapeHK01WithContent();
    
    console.log(`\n=== HK01 CONTENT EXTRACTION TEST (${articles.length} articles) ===`);
    
    // Analyze the first few articles
    for (let i = 0; i < Math.min(articles.length, 3); i++) {
      const article = articles[i];
      console.log(`\n${i + 1}. ${article.title}`);
      console.log(`   URL: ${article.url}`);
      console.log(`   Content length: ${article.content ? article.content.length : 0} characters`);
      
      if (article.content) {
        // Show the end of content to see if it's truncated
        const endContent = article.content.substring(Math.max(0, article.content.length - 100));
        console.log(`   Content ending (last 100 chars):`);
        console.log(`   "...${endContent}"`);
        
        // Check for truncation indicators
        const endsCleanly = /[。！？\.]$/.test(article.content.trim());
        const endsWithIncompleteWord = /[^\s。！？\.]$/.test(article.content.trim());
        const hasSuspiciousCutoff = /垃圾$|車$|司$|人$/.test(article.content.trim());
        
        console.log(`   Truncation analysis:`);
        console.log(`     - Ends cleanly: ${endsCleanly ? '✅ Yes' : '❌ No'}`);
        console.log(`     - Incomplete word ending: ${endsWithIncompleteWord ? '✅ Yes' : '❌ No'}`);
        console.log(`     - Suspicious cutoff: ${hasSuspiciousCutoff ? '✅ Yes' : '❌ No'}`);
        
      } else {
        console.log(`   ❌ No content extracted`);
      }
    }
    
  } catch (error) {
    console.error('Error testing HK01 content:', error.message);
  }
}

testHK01Content();