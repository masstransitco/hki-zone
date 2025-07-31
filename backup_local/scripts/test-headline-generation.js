require('dotenv').config({ path: '.env.local' });

async function testHeadlineGeneration() {
  console.log('🔍 Testing Headline Generation\n');

  // Import the perplexity service
  const { perplexityHKNews } = require('../lib/perplexity-hk-news');

  try {
    console.log('📰 Calling processHeadlines...');
    const result = await perplexityHKNews.processHeadlines();
    
    console.log('\n✅ Process completed:');
    console.log(`   Method: ${result.method || 'unknown'}`);
    console.log(`   Headlines generated: ${result.generated || 0}`);
    console.log(`   Headlines saved: ${result.saved || 0}`);
    console.log(`   Total cost: $${result.totalCost || 0}`);
    
    if (result.headlines && result.headlines.length > 0) {
      console.log('\n📋 Generated headlines:');
      result.headlines.forEach((h, i) => {
        console.log(`   ${i + 1}. [${h.category}] ${h.title}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error generating headlines:', error.message);
    console.error(error.stack);
  }
}

testHeadlineGeneration();