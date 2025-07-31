require('dotenv').config({ path: '.env.cli' });
const { perplexityEnhancerV2 } = require('./lib/perplexity-enhancer-v2');

async function testTrilingualEnhancement() {
  console.log('🧪 Testing one-shot trilingual enhancement...');
  
  const testArticle = {
    title: "Hong Kong's financial sector sees growth in Q2 2025",
    content: "The Hong Kong Monetary Authority reported strong growth in the financial sector during the second quarter of 2025. Banking assets increased by 5.2% compared to the previous quarter, driven by increased lending and investment activities. The authority noted that the implementation of new fintech regulations has attracted more digital banking services to the region.",
    summary: "HKMA reports 5.2% growth in banking assets for Q2 2025."
  };
  
  try {
    console.log('\n📝 Test article:', testArticle.title);
    console.log('\n🚀 Calling enhanceTrilingual...');
    
    const result = await perplexityEnhancerV2.enhanceTrilingual(
      testArticle.title,
      testArticle.content,
      testArticle.summary,
      {
        searchDepth: 'low',
        recencyFilter: 'day',
        maxTokens: 1800
      }
    );
    
    console.log('\n✅ Success! Received trilingual result:');
    console.log('\nEnglish version:');
    console.log('  Title:', result.en.title);
    console.log('  Summary:', result.en.summary.substring(0, 100) + '...');
    console.log('  Key points:', result.en.key_points.length);
    console.log('  Citations:', result.en.citations.length);
    
    console.log('\nTraditional Chinese version:');
    console.log('  Title:', result.zh_HK.title);
    console.log('  Key points:', result.zh_HK.key_points.length);
    
    console.log('\nSimplified Chinese version:');
    console.log('  Title:', result.zh_CN.title);
    console.log('  Key points:', result.zh_CN.key_points.length);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testTrilingualEnhancement();