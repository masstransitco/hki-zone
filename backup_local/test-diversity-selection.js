#!/usr/bin/env node

/**
 * Test the new diversity-focused AI selection
 */

const BASE_URL = 'http://localhost:3000';

async function testDiversitySelection() {
  try {
    console.log('🎯 Testing Diversity-Focused AI Selection...');
    console.log('==========================================');
    
    // Test AI selection with the new diversity prompt
    console.log('Calling AI selection with diversity analysis...');
    const selectResponse = await fetch(`${BASE_URL}/api/admin/articles/select-article`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ count: 1 })
    });

    const selectData = await selectResponse.json();
    
    console.log(`\n✅ Selection Status: ${selectResponse.status}`);
    console.log(`📝 Selection Message: ${selectData.message}`);
    
    if (selectData.success && selectData.article) {
      console.log(`\n🎯 SELECTED ARTICLE:`);
      console.log(`   Title: "${selectData.article.title}"`);
      console.log(`   Source: ${selectData.article.source}`);
      console.log(`   Score: ${selectData.article.priority_score}`);
      console.log(`   Method: ${selectData.method}`);
      console.log(`\n💭 SELECTION REASONING:`);
      console.log(`   "${selectData.article.selection_reason}"`);
      
      // Analyze if selection shows diversity consideration
      const reasoning = selectData.article.selection_reason.toLowerCase();
      const title = selectData.article.title.toLowerCase();
      
      console.log(`\n🔍 DIVERSITY ANALYSIS:`);
      
      // Check if it's weather/typhoon related
      const weatherKeywords = ['typhoon', 'wipha', '風球', '颱風', 'weather', 'storm', '橙色預警', '深圳'];
      const isWeatherRelated = weatherKeywords.some(keyword => 
        title.includes(keyword.toLowerCase()) || reasoning.includes(keyword.toLowerCase())
      );
      
      if (isWeatherRelated) {
        console.log(`   ⚠️ WEATHER/TYPHOON selected - may indicate diversity guidance not working`);
        console.log(`   🔍 Check server logs for topic analysis output`);
      } else {
        console.log(`   ✅ NON-WEATHER topic selected - diversity guidance appears to be working!`);
        
        // Try to categorize the selected article
        const categories = {
          technology: ['創科', 'tech', 'ai', '科技', 'innovation'],
          health: ['健康', 'health', '醫療', 'medical', '癌症', 'cancer'],
          business: ['經濟', 'economy', 'business', '股票', 'market', '銀行'],
          lifestyle: ['生活', 'lifestyle', '飲食', 'food', '旅遊'],
          entertainment: ['娛樂', 'entertainment', '電影', 'movie', '明星'],
          sports: ['足球', 'football', '運動', 'sport', '比賽'],
          politics: ['政府', 'government', '政策', 'policy'],
          international: ['國際', 'international', '美國', '中國', '世界']
        };
        
        for (const [category, keywords] of Object.entries(categories)) {
          if (keywords.some(keyword => title.includes(keyword) || reasoning.includes(keyword))) {
            console.log(`   📂 Categorized as: ${category.toUpperCase()}`);
            break;
          }
        }
      }
      
      console.log(`\n🎯 RECOMMENDATION:`);
      if (isWeatherRelated) {
        console.log(`   Consider checking server logs to see if topic analysis flagged weather oversaturation`);
        console.log(`   If weather was recommended to avoid, there may be an issue with prompt adherence`);
      } else {
        console.log(`   Selection appears to show topic diversity consideration! 🎉`);
        console.log(`   Check server logs for detailed topic analysis that guided this selection`);
      }
      
    } else {
      console.log(`❌ Selection failed: ${selectData.error}`);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log('🚀 Testing Diversity-Focused AI Selection');
  console.log('==========================================');
  
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log('❌ Server not running. Please start with: npm run dev');
    process.exit(1);
  }
  
  await testDiversitySelection();
  
  console.log('\n📊 TO ANALYZE RESULTS:');
  console.log('1. Check server logs for "Topic Diversity Analysis" output');
  console.log('2. Look for recommendations like "AVOID WEATHER" or "PRIORITIZE X"');
  console.log('3. Verify if selected article follows the diversity guidance');
  console.log('4. Run multiple times to see if variety improves over time');
}

main();