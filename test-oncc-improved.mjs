// Test improved ONCC content extraction
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Force module reload
delete require.cache[require.resolve('./lib/scrapers/oncc.js')];

const scrapeOnccWithContent = require('./lib/scrapers/oncc.js').withContent;

console.log('Testing improved ONCC content extraction...');

async function testImprovedOncc() {
  try {
    const articles = await scrapeOnccWithContent();
    
    console.log(`\n=== ONCC IMPROVED EXTRACTION TEST (${articles.length} articles) ===`);
    
    // Test first 2 articles
    for (let i = 0; i < Math.min(articles.length, 2); i++) {
      const article = articles[i];
      console.log(`\n${i + 1}. ${article.title}`);
      console.log(`   URL: ${article.url}`);
      console.log(`   Content length: ${article.content ? article.content.length : 0} characters`);
      
      if (article.content) {
        console.log(`   Content preview (first 300 chars):`);
        console.log(`   "${article.content.substring(0, 300)}..."`);
        
        // Check for improvements
        const hasExcessiveWhitespace = /\s{5,}/.test(article.content);
        const hasNavigationText = article.content.includes('Tweet') || article.content.includes('東網電視');
        const hasTimestamp = /\d{4}年\d{2}月\d{2}日/.test(article.content);
        const hasParagraphs = article.content.includes('\n\n');
        
        console.log(`   Quality assessment:`);
        console.log(`     - Clean whitespace: ${hasExcessiveWhitespace ? '❌ No' : '✅ Yes'}`);
        console.log(`     - No navigation text: ${hasNavigationText ? '❌ No' : '✅ Yes'}`);
        console.log(`     - No timestamps: ${hasTimestamp ? '❌ No' : '✅ Yes'}`);
        console.log(`     - Proper paragraphs: ${hasParagraphs ? '✅ Yes' : '❌ No'}`);
        
        const improvements = [!hasExcessiveWhitespace, !hasNavigationText, !hasTimestamp, hasParagraphs];
        const score = improvements.filter(Boolean).length;
        console.log(`   Overall quality: ${score}/4 improvements`);
        
      } else {
        console.log(`   ❌ No content extracted`);
      }
    }
    
  } catch (error) {
    console.error('Error testing improved ONCC:', error.message);
  }
}

testImprovedOncc();