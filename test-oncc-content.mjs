// Test ONCC content extraction
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const scrapeOnccWithContent = require('./lib/scrapers/oncc.js').withContent;

console.log('Testing ONCC content extraction...');

async function testOnccContent() {
  try {
    const articles = await scrapeOnccWithContent();
    
    console.log(`\n=== ONCC CONTENT EXTRACTION TEST (${articles.length} articles) ===`);
    
    // Analyze the first few articles
    for (let i = 0; i < Math.min(articles.length, 3); i++) {
      const article = articles[i];
      console.log(`\n${i + 1}. ${article.title}`);
      console.log(`   URL: ${article.url}`);
      console.log(`   Content length: ${article.content ? article.content.length : 0} characters`);
      
      if (article.content) {
        // Show first 300 characters to see the formatting issue
        console.log(`   Content preview:`);
        console.log(`   "${article.content.substring(0, 300)}..."`);
        
        // Check for problematic patterns
        const hasExcessiveWhitespace = /\s{5,}/.test(article.content);
        const hasNavigationText = article.content.includes('Tweet') || article.content.includes('更多新聞短片');
        const hasTimestamp = /\d{4}年\d{2}月\d{2}日/.test(article.content);
        
        console.log(`   Issues detected:`);
        console.log(`     - Excessive whitespace: ${hasExcessiveWhitespace ? '✅ Yes' : '❌ No'}`);
        console.log(`     - Navigation text: ${hasNavigationText ? '✅ Yes' : '❌ No'}`);
        console.log(`     - Timestamp in content: ${hasTimestamp ? '✅ Yes' : '❌ No'}`);
      } else {
        console.log(`   ❌ No content extracted`);
      }
    }
    
  } catch (error) {
    console.error('Error testing ONCC content:', error.message);
  }
}

testOnccContent();