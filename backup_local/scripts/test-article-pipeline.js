const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.cli' });

const BASE_URL = 'http://localhost:3001';
const CRON_SECRET = process.env.CRON_SECRET || 'test-secret';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testEndpoint(name, endpoint, method = 'POST') {
  console.log(`\n🧪 Testing ${name}...`);
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'User-Agent': 'vercel-cron/1.0',
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ ${name} Success:`, JSON.stringify(data, null, 2));
      return data;
    } else {
      console.error(`❌ ${name} Failed:`, response.status, data);
      return null;
    }
  } catch (error) {
    console.error(`❌ ${name} Error:`, error.message);
    return null;
  }
}

async function getStats() {
  console.log('\n📊 Getting current statistics...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/cron/select-article`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('Statistics:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error getting stats:', error.message);
  }
}

async function checkTopicsFeed(language = 'en') {
  console.log(`\n📰 Checking topics feed (${language})...`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/topics?language=${language}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log(`Found ${data.articles?.length || 0} articles in ${language}`);
    
    if (data.articles?.length > 0) {
      console.log('Latest 3 articles:');
      data.articles.slice(0, 3).forEach((article, i) => {
        console.log(`  ${i + 1}. ${article.title}`);
        console.log(`     Language: ${article.enhancement_metadata?.language || 'unknown'}`);
        console.log(`     Created: ${article.created_at}`);
      });
    }
  } catch (error) {
    console.error('Error checking topics feed:', error.message);
  }
}

async function main() {
  console.log('🚀 Testing Article Enhancement Pipeline');
  console.log(`📍 Server: ${BASE_URL}`);
  console.log(`🔑 Using CRON_SECRET: ${CRON_SECRET ? 'Yes' : 'No'}`);
  
  // Get initial stats
  await getStats();
  
  // Test article selection (selects 3 articles now)
  const selectionResult = await testEndpoint(
    'Article Selection',
    '/api/cron/select-article'
  );
  
  if (selectionResult && selectionResult.selectedCount > 0) {
    console.log(`\n⏳ Waiting 5 seconds before enhancement...`);
    await delay(5000);
    
    // Test article enhancement
    const enhancementResult = await testEndpoint(
      'Article Enhancement',
      '/api/cron/enhance-selected'
    );
    
    if (enhancementResult && enhancementResult.success) {
      console.log(`\n🎉 Pipeline Test Complete!`);
      console.log(`   • Selected: ${selectionResult.selectedCount} articles`);
      console.log(`   • Enhanced: ${enhancementResult.totalEnhanced} articles`);
      console.log(`   • Cost: $${enhancementResult.estimatedCost}`);
      console.log(`   • Cost per article: $${enhancementResult.costPerArticle}`);
      
      // Check the topics feed for all languages
      await delay(2000);
      await checkTopicsFeed('en');
      await checkTopicsFeed('zh-TW');
      await checkTopicsFeed('zh-CN');
    }
  } else {
    console.log('\n⚠️  No articles were selected. This could mean:');
    console.log('   1. No new scraped articles available');
    console.log('   2. All recent articles have already been enhanced');
    console.log('   3. Articles didn\'t meet the quality threshold (score >= 80)');
  }
  
  console.log('\n✅ Test complete!');
}

main().catch(console.error);