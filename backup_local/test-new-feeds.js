#!/usr/bin/env node

/**
 * Comprehensive Feed Testing Script
 * Tests all new government RSS feeds and APIs for Hong Kong signals system
 */

const fs = require('fs');
const https = require('https');
const http = require('http');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true
});

// Test feed configurations
const FEED_CONFIGS = [
  // High Priority - Health & Emergency
  {
    name: 'Hospital A&E Waiting Times',
    slug: 'ha_ae_waiting',
    url: 'https://www.ha.org.hk/opendata/aed/aedwtdata-en.json',
    type: 'json',
    category: 'health',
    priority: 'high',
    description: 'Real-time A&E waiting times for all public hospitals'
  },
  {
    name: 'Centre for Health Protection - Press Releases',
    slug: 'chp_press',
    url: 'https://www.chp.gov.hk/rss/press_releases.xml',
    type: 'rss',
    category: 'health',
    priority: 'high',
    description: 'Health department press releases and alerts'
  },
  {
    name: 'Centre for Health Protection - Disease Watch',
    slug: 'chp_disease',
    url: 'https://www.chp.gov.hk/rss/cd_watch.xml',
    type: 'rss',
    category: 'health',
    priority: 'high',
    description: 'Communicable disease surveillance and alerts'
  },
  
  // Medium Priority - Environmental
  {
    name: 'Environmental Protection Department',
    slug: 'epd_press',
    url: 'https://www.epd.gov.hk/epd/english/rss/rss.xml',
    type: 'rss',
    category: 'environment',
    priority: 'medium',
    description: 'Environmental protection alerts and updates'
  },
  {
    name: 'Air Quality Health Index',
    slug: 'epd_aqhi',
    url: 'https://www.aqhi.gov.hk/api_history/english/aqhi/aqhi.xml',
    type: 'xml',
    category: 'environment',
    priority: 'medium',
    description: 'Air quality health index data'
  },
  
  // Security & Law Enforcement
  {
    name: 'Hong Kong Police Press Releases',
    slug: 'police_press',
    url: 'https://www.police.gov.hk/ppp_en/03_police_message/pr/rss.xml',
    type: 'rss',
    category: 'security',
    priority: 'medium',
    description: 'Police press releases and public safety alerts'
  },
  {
    name: 'Fire Services Department',
    slug: 'fsd_press',
    url: 'https://www.hkfsd.gov.hk/eng/rss/press_releases.xml',
    type: 'rss',
    category: 'emergency',
    priority: 'medium',
    description: 'Fire services and emergency response updates'
  },
  
  // Administrative
  {
    name: 'Immigration Department',
    slug: 'immd_press',
    url: 'https://www.immd.gov.hk/eng/press/rss.xml',
    type: 'rss',
    category: 'administrative',
    priority: 'medium',
    description: 'Immigration and border control updates'
  },
  {
    name: 'Hong Kong Customs',
    slug: 'customs_press',
    url: 'https://www.customs.gov.hk/en/rss/press_releases.xml',
    type: 'rss',
    category: 'administrative',
    priority: 'medium',
    description: 'Customs and border control announcements'
  },
  {
    name: 'DATA.GOV.HK Updates',
    slug: 'datagov_updates',
    url: 'https://data.gov.hk/en/rss/datasets.xml',
    type: 'rss',
    category: 'administrative',
    priority: 'low',
    description: 'Government open data updates'
  },
  
  // Financial
  {
    name: 'Hong Kong Monetary Authority',
    slug: 'hkma_press',
    url: 'https://www.hkma.gov.hk/eng/other-information/rss/press_releases.xml',
    type: 'rss',
    category: 'financial',
    priority: 'low',
    description: 'Monetary authority press releases'
  },
  
  // Legislative
  {
    name: 'Legislative Council',
    slug: 'legco_press',
    url: 'https://www.legco.gov.hk/en/rss/press_releases.xml',
    type: 'rss',
    category: 'legislative',
    priority: 'low',
    description: 'Legislative council announcements'
  }
];

// Helper function to fetch URL content
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HK-Signals-Bot/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/json, text/plain, */*'
      },
      timeout: 10000
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Parse RSS feed
function parseRSSFeed(xml) {
  try {
    const parsed = xmlParser.parse(xml);
    
    // Handle different RSS structures
    let items = [];
    
    if (parsed.rss && parsed.rss.channel && parsed.rss.channel.item) {
      items = Array.isArray(parsed.rss.channel.item) ? parsed.rss.channel.item : [parsed.rss.channel.item];
    } else if (parsed.feed && parsed.feed.entry) {
      // Atom feed
      items = Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry];
    } else if (parsed.channel && parsed.channel.item) {
      items = Array.isArray(parsed.channel.item) ? parsed.channel.item : [parsed.channel.item];
    }
    
    return items.map(item => ({
      title: item.title || item.summary || 'No title',
      description: item.description || item.content || item.summary || '',
      pubDate: item.pubDate || item.published || item.updated || new Date().toISOString(),
      link: item.link || item.id || '',
      guid: item.guid || item.id || ''
    }));
  } catch (error) {
    throw new Error(`RSS parsing error: ${error.message}`);
  }
}

// Parse JSON API response
function parseJSONFeed(json) {
  try {
    const data = JSON.parse(json);
    
    // Handle A&E waiting times structure
    if (data.waitTime && Array.isArray(data.waitTime)) {
      return data.waitTime.map(hospital => ({
        title: `A&E Waiting Time: ${hospital.hospName}`,
        description: `Current waiting time: ${hospital.waitTime}. Top wait: ${hospital.topWait}`,
        pubDate: new Date().toISOString(),
        link: `https://www.ha.org.hk/visitor/ha_visitor_index.asp?Content_ID=235504&Lang=ENG`,
        guid: `ae_${hospital.hospCode}_${Date.now()}`,
        metadata: {
          hospitalCode: hospital.hospCode,
          hospitalName: hospital.hospName,
          waitTime: hospital.waitTime,
          topWait: hospital.topWait,
          lastUpdateTime: hospital.lastUpdateTime
        }
      }));
    }
    
    // Handle generic JSON array
    if (Array.isArray(data)) {
      return data.map((item, index) => ({
        title: item.title || item.name || `Item ${index + 1}`,
        description: item.description || item.content || JSON.stringify(item),
        pubDate: item.date || item.timestamp || new Date().toISOString(),
        link: item.link || item.url || '',
        guid: item.id || `item_${index}_${Date.now()}`
      }));
    }
    
    return [];
  } catch (error) {
    throw new Error(`JSON parsing error: ${error.message}`);
  }
}

// Test individual feed
async function testFeed(config) {
  console.log(`\n🔍 Testing: ${config.name}`);
  console.log(`   URL: ${config.url}`);
  console.log(`   Type: ${config.type} | Category: ${config.category} | Priority: ${config.priority}`);
  
  const result = {
    name: config.name,
    slug: config.slug,
    url: config.url,
    type: config.type,
    category: config.category,
    priority: config.priority,
    description: config.description,
    status: 'unknown',
    error: null,
    responseTime: 0,
    itemCount: 0,
    sampleItems: [],
    contentType: null,
    lastModified: null
  };
  
  try {
    const startTime = Date.now();
    const content = await fetchUrl(config.url);
    result.responseTime = Date.now() - startTime;
    
    // Detect content type
    if (content.includes('<?xml') || content.includes('<rss') || content.includes('<feed')) {
      result.contentType = 'xml';
    } else if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      result.contentType = 'json';
    } else {
      result.contentType = 'text';
    }
    
    // Parse content
    let items = [];
    if (config.type === 'json' || result.contentType === 'json') {
      items = parseJSONFeed(content);
    } else if (config.type === 'rss' || config.type === 'xml') {
      items = parseRSSFeed(content);
    }
    
    result.itemCount = items.length;
    result.sampleItems = items.slice(0, 3); // Store first 3 items as samples
    result.status = 'success';
    
    console.log(`   ✅ Status: SUCCESS`);
    console.log(`   ⏱️  Response Time: ${result.responseTime}ms`);
    console.log(`   📊 Items Found: ${result.itemCount}`);
    console.log(`   📄 Content Type: ${result.contentType}`);
    
    if (items.length > 0) {
      console.log(`   📝 Sample Title: "${items[0].title}"`);
      console.log(`   📅 Sample Date: ${items[0].pubDate}`);
    }
    
  } catch (error) {
    result.status = 'error';
    result.error = error.message;
    console.log(`   ❌ Status: ERROR`);
    console.log(`   🚨 Error: ${error.message}`);
  }
  
  return result;
}

// Generate implementation recommendations
function generateImplementationRecommendations(results) {
  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'error');
  
  console.log('\n📋 IMPLEMENTATION RECOMMENDATIONS');
  console.log('=====================================');
  
  // Successful feeds by priority
  const highPriority = successful.filter(r => r.priority === 'high');
  const mediumPriority = successful.filter(r => r.priority === 'medium');
  const lowPriority = successful.filter(r => r.priority === 'low');
  
  console.log(`\n🚀 READY FOR IMPLEMENTATION (${successful.length} feeds)`);
  
  if (highPriority.length > 0) {
    console.log('\n🔴 HIGH PRIORITY:');
    highPriority.forEach(feed => {
      console.log(`   ✅ ${feed.name} (${feed.itemCount} items, ${feed.responseTime}ms)`);
      console.log(`      Category: ${feed.category} | Type: ${feed.type}`);
      console.log(`      URL: ${feed.url}`);
    });
  }
  
  if (mediumPriority.length > 0) {
    console.log('\n🟡 MEDIUM PRIORITY:');
    mediumPriority.forEach(feed => {
      console.log(`   ✅ ${feed.name} (${feed.itemCount} items, ${feed.responseTime}ms)`);
      console.log(`      Category: ${feed.category} | Type: ${feed.type}`);
    });
  }
  
  if (lowPriority.length > 0) {
    console.log('\n🟢 LOW PRIORITY:');
    lowPriority.forEach(feed => {
      console.log(`   ✅ ${feed.name} (${feed.itemCount} items, ${feed.responseTime}ms)`);
      console.log(`      Category: ${feed.category} | Type: ${feed.type}`);
    });
  }
  
  if (failed.length > 0) {
    console.log(`\n❌ FAILED FEEDS (${failed.length} feeds)`);
    failed.forEach(feed => {
      console.log(`   🚨 ${feed.name}: ${feed.error}`);
      console.log(`      URL: ${feed.url}`);
    });
  }
  
  // Database schema recommendations
  console.log('\n🗄️  DATABASE SCHEMA UPDATES NEEDED:');
  const categories = [...new Set(successful.map(r => r.category))];
  categories.forEach(category => {
    console.log(`   • Add '${category}' to incident_category enum`);
  });
  
  // Feed-specific recommendations
  console.log('\n🔧 IMPLEMENTATION NOTES:');
  successful.forEach(feed => {
    if (feed.type === 'json') {
      console.log(`   • ${feed.name}: Requires JSON parser (not RSS)`);
    }
    if (feed.responseTime > 5000) {
      console.log(`   • ${feed.name}: Slow response (${feed.responseTime}ms) - consider caching`);
    }
    if (feed.itemCount === 0) {
      console.log(`   • ${feed.name}: No items found - may need custom parsing`);
    }
    if (feed.itemCount > 50) {
      console.log(`   • ${feed.name}: Large feed (${feed.itemCount} items) - consider pagination`);
    }
  });
}

// Main execution
async function main() {
  console.log('🚀 HONG KONG GOVERNMENT FEEDS TESTING SCRIPT');
  console.log('=============================================');
  console.log(`Testing ${FEED_CONFIGS.length} government RSS feeds and APIs...`);
  
  const results = [];
  
  for (const config of FEED_CONFIGS) {
    const result = await testFeed(config);
    results.push(result);
    
    // Add delay between requests to be respectful
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Generate summary
  console.log('\n📊 TESTING SUMMARY');
  console.log('==================');
  console.log(`Total feeds tested: ${results.length}`);
  console.log(`Successful: ${results.filter(r => r.status === 'success').length}`);
  console.log(`Failed: ${results.filter(r => r.status === 'error').length}`);
  console.log(`Average response time: ${Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length)}ms`);
  console.log(`Total items found: ${results.reduce((sum, r) => sum + r.itemCount, 0)}`);
  
  // Generate recommendations
  generateImplementationRecommendations(results);
  
  // Save detailed results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `feed-test-results-${timestamp}.json`;
  fs.writeFileSync(filename, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed results saved to: ${filename}`);
  
  // Generate SQL for successful feeds
  const successfulFeeds = results.filter(r => r.status === 'success');
  if (successfulFeeds.length > 0) {
    console.log('\n🗄️  SQL TO ADD SUCCESSFUL FEEDS:');
    console.log('================================');
    successfulFeeds.forEach(feed => {
      console.log(`INSERT INTO gov_feeds (slug, url, active) VALUES ('${feed.slug}', '${feed.url}', true);`);
    });
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testFeed, parseRSSFeed, parseJSONFeed };