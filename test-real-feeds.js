#!/usr/bin/env node

/**
 * Updated Feed Testing Script with Real RSS URLs
 * Tests actual government RSS feeds and APIs for Hong Kong signals system
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

// Updated test feed configurations with real URLs
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
    name: 'CHP - Press Releases',
    slug: 'chp_press',
    url: 'https://www.chp.gov.hk/rss/pressreleases_en_RSS.xml',
    type: 'rss',
    category: 'health',
    priority: 'high',
    description: 'Health department press releases and alerts'
  },
  {
    name: 'CHP - Communicable Diseases Watch',
    slug: 'chp_disease',
    url: 'https://www.chp.gov.hk/rss/cdwatch_en_RSS.xml',
    type: 'rss',
    category: 'health',
    priority: 'high',
    description: 'Communicable disease surveillance and alerts'
  },
  {
    name: 'CHP - Non-Communicable Diseases',
    slug: 'chp_ncd',
    url: 'https://www.chp.gov.hk/rss/ncdaware_en_RSS.xml',
    type: 'rss',
    category: 'health',
    priority: 'medium',
    description: 'Non-communicable disease information and alerts'
  },
  {
    name: 'CHP - Health Guidelines',
    slug: 'chp_guidelines',
    url: 'https://www.chp.gov.hk/rss/guidelines_en_RSS.xml',
    type: 'rss',
    category: 'health',
    priority: 'medium',
    description: 'Health professional guidelines and recommendations'
  },
  
  // Financial - HKMA
  {
    name: 'HKMA - Press Releases',
    slug: 'hkma_press',
    url: 'https://www.hkma.gov.hk/eng/other-information/rss/rss_press-release.xml',
    type: 'rss',
    category: 'financial',
    priority: 'medium',
    description: 'Monetary authority press releases'
  },
  {
    name: 'HKMA - Speeches',
    slug: 'hkma_speeches',
    url: 'https://www.hkma.gov.hk/eng/other-information/rss/rss_speeches.xml',
    type: 'rss',
    category: 'financial',
    priority: 'low',
    description: 'HKMA official speeches and statements'
  },
  {
    name: 'HKMA - Guidelines & Circulars',
    slug: 'hkma_guidelines',
    url: 'https://www.hkma.gov.hk/eng/other-information/rss/rss_guidelines.xml',
    type: 'rss',
    category: 'financial',
    priority: 'medium',
    description: 'Banking and financial guidelines'
  },
  {
    name: 'HKMA - Circulars',
    slug: 'hkma_circulars',
    url: 'https://www.hkma.gov.hk/eng/other-information/rss/rss_circulars.xml',
    type: 'rss',
    category: 'financial',
    priority: 'medium',
    description: 'Financial regulatory circulars'
  },
  
  // Existing working feeds from current system
  {
    name: 'TD - Traffic Notices',
    slug: 'td_notices',
    url: 'https://www.td.gov.hk/filemanager/rss/en/traffic_notices.xml',
    type: 'rss',
    category: 'road',
    priority: 'high',
    description: 'Transport department traffic notices'
  },
  {
    name: 'TD - Press Releases',
    slug: 'td_press',
    url: 'https://www.td.gov.hk/filemanager/rss/en/press_release.xml',
    type: 'rss',
    category: 'road',
    priority: 'high',
    description: 'Transport department press releases'
  },
  {
    name: 'HKO - Weather Warnings',
    slug: 'hko_warn',
    url: 'https://rss.weather.gov.hk/rss/WeatherWarningSummaryv2.xml',
    type: 'rss',
    category: 'weather',
    priority: 'high',
    description: 'Weather warnings and alerts'
  },
  {
    name: 'HKO - Earthquake Messages',
    slug: 'hko_eq',
    url: 'https://rss.weather.gov.hk/rss/QuickEarthquakeMessage.xml',
    type: 'rss',
    category: 'weather',
    priority: 'medium',
    description: 'Earthquake alerts and information'
  },
  {
    name: 'HKO - Felt Earthquakes',
    slug: 'hko_felt_eq',
    url: 'https://rss.weather.gov.hk/rss/FeltEarthquake.xml',
    type: 'rss',
    category: 'weather',
    priority: 'medium',
    description: 'Felt earthquake reports'
  },
  
  // Additional data sources to test
  {
    name: 'NEWS.GOV.HK - Top Stories',
    slug: 'news_gov_top',
    url: 'https://www.news.gov.hk/rss/news/topstories_en.xml',
    type: 'rss',
    category: 'administrative',
    priority: 'medium',
    description: 'Government news top stories'
  },
  {
    name: 'NEWS.GOV.HK - All Stories',
    slug: 'news_gov_all',
    url: 'https://www.news.gov.hk/rss/news/allstories_en.xml',
    type: 'rss',
    category: 'administrative',
    priority: 'low',
    description: 'All government news stories'
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

// Generate SQL for database setup
function generateDatabaseSQL(results) {
  const successful = results.filter(r => r.status === 'success');
  const categories = [...new Set(successful.map(r => r.category))];
  
  console.log('\n🗄️  DATABASE SETUP SQL');
  console.log('======================');
  
  // Add new categories to enum
  const newCategories = categories.filter(cat => !['road', 'rail', 'weather', 'utility'].includes(cat));
  if (newCategories.length > 0) {
    console.log('\n-- Add new categories to incident_category enum:');
    newCategories.forEach(category => {
      console.log(`ALTER TYPE incident_category ADD VALUE '${category}';`);
    });
  }
  
  // Insert feed configurations
  console.log('\n-- Insert new feed configurations:');
  successful.forEach(feed => {
    console.log(`INSERT INTO gov_feeds (slug, url, active) VALUES ('${feed.slug}', '${feed.url}', true);`);
  });
  
  console.log('\n-- Update existing feed configurations:');
  console.log(`UPDATE gov_feeds SET active = true WHERE slug IN ('${successful.map(f => f.slug).join("', '")}');`);
}

// Main execution
async function main() {
  console.log('🚀 HONG KONG GOVERNMENT FEEDS TESTING SCRIPT (REAL URLS)');
  console.log('=========================================================');
  console.log(`Testing ${FEED_CONFIGS.length} government RSS feeds and APIs...`);
  
  const results = [];
  
  for (const config of FEED_CONFIGS) {
    const result = await testFeed(config);
    results.push(result);
    
    // Add delay between requests to be respectful
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Generate summary
  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'error');
  
  console.log('\n📊 TESTING SUMMARY');
  console.log('==================');
  console.log(`Total feeds tested: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Average response time: ${Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length)}ms`);
  console.log(`Total items found: ${results.reduce((sum, r) => sum + r.itemCount, 0)}`);
  
  // Group by priority and category
  console.log('\n📈 SUCCESSFUL FEEDS BY PRIORITY:');
  ['high', 'medium', 'low'].forEach(priority => {
    const feeds = successful.filter(f => f.priority === priority);
    if (feeds.length > 0) {
      console.log(`\n${priority.toUpperCase()} PRIORITY (${feeds.length} feeds):`);
      feeds.forEach(feed => {
        console.log(`   ✅ ${feed.name} (${feed.itemCount} items, ${feed.responseTime}ms)`);
        console.log(`      Category: ${feed.category} | Slug: ${feed.slug}`);
      });
    }
  });
  
  if (failed.length > 0) {
    console.log(`\n❌ FAILED FEEDS (${failed.length} feeds):`);
    failed.forEach(feed => {
      console.log(`   🚨 ${feed.name}: ${feed.error}`);
    });
  }
  
  // Generate database SQL
  generateDatabaseSQL(results);
  
  // Save detailed results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `real-feed-test-results-${timestamp}.json`;
  fs.writeFileSync(filename, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed results saved to: ${filename}`);
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testFeed, parseRSSFeed, parseJSONFeed };