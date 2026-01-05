// Quick test script for HK01 and AM730 scrapers
import { scrapeHK01WithContent } from './lib/scrapers/hk01.js';
import { scrapeAM730 } from './lib/scrapers/am730.js';

async function testHK01() {
  console.log('\n=== Testing HK01 Scraper ===\n');
  try {
    const articles = await scrapeHK01WithContent();
    console.log(`Total articles: ${articles.length}`);

    // Check content lengths
    const withContent = articles.filter(a => a.body && a.body.length > 100);
    console.log(`Articles with >100 chars content: ${withContent.length}`);

    // Show sample
    if (articles.length > 0) {
      const sample = articles[0];
      console.log('\nSample article:');
      console.log(`  Headline: ${sample.headline?.substring(0, 60)}...`);
      console.log(`  Content length: ${sample.body?.length || 0} chars`);
      console.log(`  Content preview: ${sample.body?.substring(0, 200)}...`);
    }

    // Stats
    const avgLength = articles.reduce((sum, a) => sum + (a.body?.length || 0), 0) / articles.length;
    console.log(`\nAverage content length: ${Math.round(avgLength)} chars`);

    return { success: true, count: articles.length, avgLength: Math.round(avgLength) };
  } catch (e) {
    console.error('HK01 test failed:', e.message);
    return { success: false, error: e.message };
  }
}

async function testAM730() {
  console.log('\n=== Testing AM730 Scraper ===\n');
  try {
    const articles = await scrapeAM730();
    console.log(`Total articles: ${articles.length}`);

    // Check content lengths
    const withContent = articles.filter(a => a.body && a.body.length > 100);
    console.log(`Articles with >100 chars content: ${withContent.length}`);

    // Show sample
    if (articles.length > 0) {
      const sample = articles[0];
      console.log('\nSample article:');
      console.log(`  Headline: ${sample.headline?.substring(0, 60)}...`);
      console.log(`  Content length: ${sample.body?.length || 0} chars`);
      console.log(`  Content preview: ${sample.body?.substring(0, 200)}...`);
    }

    // Stats
    const avgLength = articles.reduce((sum, a) => sum + (a.body?.length || 0), 0) / articles.length;
    console.log(`\nAverage content length: ${Math.round(avgLength)} chars`);

    return { success: true, count: articles.length, avgLength: Math.round(avgLength) };
  } catch (e) {
    console.error('AM730 test failed:', e.message);
    return { success: false, error: e.message };
  }
}

// Run tests
console.log('Starting scraper tests...');
console.log('(This will take a few minutes as scrapers fetch real articles)\n');

const hk01Result = await testHK01();
const am730Result = await testAM730();

console.log('\n=== Summary ===');
console.log('HK01:', hk01Result);
console.log('AM730:', am730Result);
