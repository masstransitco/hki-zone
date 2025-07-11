// Test script to manually run the cars scraper
// Run this with: node test-cars-scraper.js

const { scrape28CarWithContent } = require('./lib/scrapers/28car');

async function testCarsScraper() {
  console.log('🚗 Testing 28car scraper...');
  console.log('⏰ Started at:', new Date().toISOString());
  
  try {
    const cars = await scrape28CarWithContent();
    
    console.log('\n📊 Results:');
    console.log(`✅ Found ${cars.length} cars`);
    
    if (cars.length > 0) {
      console.log('\n🔍 Sample car data:');
      console.log('─'.repeat(50));
      
      const sampleCar = cars[0];
      console.log(`Title: ${sampleCar.title}`);
      console.log(`Make: ${sampleCar.make}`);
      console.log(`Model: ${sampleCar.model}`);
      console.log(`Year: ${sampleCar.year}`);
      console.log(`Price: ${sampleCar.price}`);
      console.log(`Images: ${sampleCar.images?.length || 0} photos`);
      console.log(`URL: ${sampleCar.url}`);
      console.log(`Content: ${sampleCar.content?.slice(0, 100)}...`);
      
      console.log('\n📸 All cars with photo counts:');
      cars.forEach((car, index) => {
        console.log(`${index + 1}. ${car.title} - ${car.images?.length || 0} photos`);
      });
    }
    
    console.log('\n✅ Test completed successfully!');
    console.log('⏰ Finished at:', new Date().toISOString());
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

testCarsScraper();