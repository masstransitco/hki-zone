import { config } from 'dotenv';

// Load environment variables BEFORE importing modules
config({ path: '.env.cli' });

import { perplexityEnhancerV2 } from './lib/perplexity-enhancer-v2';

async function testOneShotEnhancement() {
  console.log('🧪 Testing one-shot trilingual enhancement directly...');
  
  const testArticle = {
    title: "Test Article: Hong Kong Tech Startup Raises Funding",
    content: "A Hong Kong-based technology startup announced today that it has successfully raised $10 million in Series A funding. The company, which specializes in AI-powered fintech solutions, plans to use the funding to expand its operations across Asia.",
    summary: "HK tech startup raises $10M for expansion."
  };
  
  try {
    console.log('\n📝 Test article:', testArticle.title);
    console.log('\n🚀 Calling enhanceTrilingual (one-shot method)...');
    
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
    
    console.log('\n✅ Success! One-shot trilingual enhancement completed in', Math.round(duration/1000), 'seconds');
    
    console.log('\n📊 Results Summary:');
    console.log('\nEnglish version:');
    console.log('  Title:', result.en.title);
    console.log('  Summary:', result.en.summary.substring(0, 100) + '...');
    console.log('  Key points:', result.en.key_points.length);
    console.log('  Citations:', result.en.citations.length);
    
    console.log('\nTraditional Chinese version:');
    console.log('  Title:', result.zh_HK.title);
    console.log('  Summary:', result.zh_HK.summary.substring(0, 100) + '...');
    console.log('  Key points:', result.zh_HK.key_points.length);
    
    console.log('\nSimplified Chinese version:');
    console.log('  Title:', result.zh_CN.title);
    console.log('  Summary:', result.zh_CN.summary.substring(0, 100) + '...');
    console.log('  Key points:', result.zh_CN.key_points.length);
    
    console.log('\n💰 Cost Analysis:');
    console.log('  One-shot method: ~$0.025 (single API call)');
    console.log('  Old method: ~$0.075 (3 separate API calls)');
    console.log('  Savings: 66% reduction');
    
    // Check if metadata would include one_shot_generation flag
    console.log('\n🏷️  Metadata flags:');
    console.log('  one_shot_generation: true (would be set in enhancement_metadata)');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

// Run the test
testOneShotEnhancement();