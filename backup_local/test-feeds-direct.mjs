import fetch from 'node-fetch';

const feeds = [
  { name: 'TD Special Traffic', url: 'https://static.data.gov.hk/td/special-traffic-news/en/1.xml' },
  { name: 'TD Traffic Notices', url: 'https://www.td.gov.hk/filemanager/rss/en/traffic_notices.xml' },
  { name: 'TD Press Releases', url: 'https://www.td.gov.hk/filemanager/rss/en/press_release.xml' },
  { name: 'MTR Rail Alerts', url: 'https://alert.mtr.com.hk/rss/rail_en.xml' },
  { name: 'HKO Weather Warnings', url: 'https://rss.weather.gov.hk/rss/WeatherWarningSummaryv2.xml' },
  { name: 'HKO Earthquakes', url: 'https://rss.weather.gov.hk/rss/QuickEarthquake.xml' },
  { name: 'EMSD Utility', url: 'https://www.emsd.gov.hk/en/rss/electricity_incidents.xml' }
];

async function testFeeds() {
  console.log('🧪 Testing Government RSS Feeds...\n');
  
  for (const feed of feeds) {
    console.log(`Testing: ${feed.name}`);
    console.log(`URL: ${feed.url}`);
    
    try {
      const response = await fetch(feed.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Government-Incidents-Bot/1.0)'
        }
      });
      
      if (response.ok) {
        const content = await response.text();
        console.log(`✅ Status: ${response.status} - Content length: ${content.length}`);
        
        // Look for items/entries
        const itemCount = (content.match(/<item>/g) || []).length;
        const entryCount = (content.match(/<entry>/g) || []).length;
        console.log(`   Items: ${itemCount}, Entries: ${entryCount}`);
        
        // Show first item title if available
        const titleMatch = content.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
        if (titleMatch) {
          console.log(`   Sample title: ${titleMatch[1]}`);
        }
      } else {
        console.log(`❌ Status: ${response.status} - ${response.statusText}`);
        const errorText = await response.text();
        console.log(`   Error: ${errorText.substring(0, 200)}...`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    console.log('');
  }
}

testFeeds();