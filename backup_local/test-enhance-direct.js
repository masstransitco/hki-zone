// Load env vars first
require('dotenv').config({ path: '.env.cli' });

// Now we can access the API
async function testDirectEnhancement() {
  console.log('🧪 Testing direct one-shot enhancement...\n');
  
  // Dynamically import after env is loaded
  const { perplexityEnhancerV2 } = await import('./lib/perplexity-enhancer-v2.js');
  
  const testArticle = {
    title: "Hong Kong fintech startup raises $10M in Series A funding",
    content: "A Hong Kong-based fintech startup announced today it has raised $10 million in Series A funding. The company, which provides AI-powered payment solutions for small businesses, plans to expand across Southeast Asia. The funding round was led by prominent venture capital firms with participation from several angel investors. The startup has seen 300% growth in transaction volume over the past year.",
    summary: "HK fintech raises $10M for Southeast Asia expansion"
  };
  
  try {
    console.log('📝 Test article:');
    console.log(`   Title: "${testArticle.title}"`);
    console.log(`   Content length: ${testArticle.content.length} chars\n`);
    
    console.log('🚀 Calling enhanceTrilingual (ONE-SHOT method)...');
    console.log('   This makes only 1 API call for all 3 languages\n');
    
    const startTime = Date.now();
    
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
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Success! Enhancement completed in ${Math.round(duration/1000)} seconds\n`);
    
    console.log('📊 Results:');
    console.log('\n1. English version:');
    console.log(`   Title: ${result.en.title}`);
    console.log(`   Summary: ${result.en.summary.substring(0, 80)}...`);
    console.log(`   Key points: ${result.en.key_points.length}`);
    console.log(`   Citations: ${result.en.citations.length}`);
    
    console.log('\n2. Traditional Chinese version (zh-TW):');
    console.log(`   Title: ${result.zh_HK.title}`);
    console.log(`   Summary: ${result.zh_HK.summary.substring(0, 50)}...`);
    console.log(`   Key points: ${result.zh_HK.key_points.length}`);
    
    console.log('\n3. Simplified Chinese version (zh-CN):');
    console.log(`   Title: ${result.zh_CN.title}`);
    console.log(`   Summary: ${result.zh_CN.summary.substring(0, 50)}...`);
    console.log(`   Key points: ${result.zh_CN.key_points.length}`);
    
    console.log('\n💰 Cost Analysis:');
    console.log('   This one-shot call: ~$0.025');
    console.log('   Old method (3 calls): ~$0.075');
    console.log('   Savings: 66% reduction');
    
    console.log('\n🏷️  Enhancement metadata would include:');
    console.log('   one_shot_generation: true');
    console.log('   trilingual_batch_id: [batch_id]');
    console.log('   enhanced_at: [timestamp]');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  }
}

// Run the test
testDirectEnhancement().catch(console.error);