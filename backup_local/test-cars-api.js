// Test script to manually run the cars API pipeline
// This will scrape cars and save them to Supabase

const { runSingleScraper } = require('./lib/scraper-orchestrator');

async function testCarsAPI() {
  console.log('🚗 Testing cars API pipeline...');
  console.log('⏰ Started at:', new Date().toISOString());
  
  try {
    console.log('📡 Running 28car scraper through orchestrator...');
    const result = await runSingleScraper('28car', true);
    
    console.log('\n📊 API Results:');
    console.log(`✅ Outlet: ${result.outlet}`);
    console.log(`📰 Articles found: ${result.articlesFound}`);
    console.log(`💾 Articles saved: ${result.articlesSaved}`);
    console.log(`📈 Success rate: ${result.articlesSaved}/${result.articlesFound}`);
    
    if (result.articles && result.articles.length > 0) {
      console.log('\n🔍 Sample saved car:');
      console.log('─'.repeat(50));
      const sampleCar = result.articles[0];
      console.log(`Title: ${sampleCar.title}`);
      console.log(`Price: ${sampleCar.price}`);
      console.log(`Source: ${sampleCar.source}`);
      console.log(`Category: ${sampleCar.category}`);
      console.log(`Images: ${sampleCar.images?.length || 0} photos`);
    }
    
    console.log('\n✅ API pipeline test completed!');
    console.log('⏰ Finished at:', new Date().toISOString());
    
  } catch (error) {
    console.error('❌ API test failed:', error);
    console.error('Stack:', error.stack);
  }
}

testCarsAPI();