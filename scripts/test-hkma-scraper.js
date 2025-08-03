const { getSignalsScraper } = require('../lib/government-signals-scraper.ts');

async function testHKMAScraper() {
  console.log('🧪 Testing HKMA scraper...');
  
  try {
    const scraper = getSignalsScraper();
    
    // Test with a specific HKMA signal
    const result = await scraper.processSingleSignalById('hkma_press_08_202408285_');
    
    console.log('\n📊 Scraper Test Result:');
    console.log('Success:', result.success);
    console.log('Details:', JSON.stringify(result.details, null, 2));
    
    if (result.error) {
      console.log('Error:', result.error);
    }
    
    // Also run a batch test
    console.log('\n🔄 Running batch scraper test...');
    const batchResult = await scraper.processIncompleteSignals(3);
    
    console.log('\n📈 Batch Test Results:');
    console.log('Processed:', batchResult.processed);
    console.log('Updated:', batchResult.updated);
    console.log('Failed:', batchResult.failed);
    
    console.log('\n📝 Individual Results:');
    batchResult.results.forEach(result => {
      console.log(`${result.source_identifier}: ${result.success ? '✅' : '❌'} ${result.languages_processed.join(', ')}`);
      if (result.error) console.log(`  Error: ${result.error}`);
    });
    
  } catch (error) {
    console.error('❌ Error testing HKMA scraper:', error);
  }
}

// Run the test
testHKMAScraper().catch(console.error);