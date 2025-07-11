// Test script to call the cars cron endpoint
// This simulates what Vercel cron would do

const axios = require('axios');

async function testCarsEndpoint() {
  console.log('🚗 Testing cars cron endpoint...');
  console.log('⏰ Started at:', new Date().toISOString());
  
  try {
    console.log('📡 Making POST request to cars endpoint...');
    
    // Since we can't easily set the vercel-cron user agent, let's use POST 
    // which allows manual triggering
    const response = await axios.post('http://localhost:3000/api/cron/scrape-cars', {}, {
      timeout: 300000, // 5 minutes timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('\n📊 API Response:');
    console.log(`✅ Status: ${response.status}`);
    console.log(`📰 Success: ${response.data.success}`);
    console.log(`💬 Message: ${response.data.message}`);
    
    if (response.data.result) {
      const result = response.data.result;
      console.log(`📈 Articles found: ${result.articlesFound}`);
      console.log(`💾 Articles saved: ${result.articlesSaved}`);
    }
    
    console.log('\n✅ Endpoint test completed!');
    console.log('⏰ Finished at:', new Date().toISOString());
    
  } catch (error) {
    console.error('❌ Endpoint test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testCarsEndpoint();