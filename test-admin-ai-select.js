#!/usr/bin/env node

/**
 * Test admin AI selection to verify our fixes
 */

const BASE_URL = 'http://localhost:3000';

async function testAdminAISelection() {
  try {
    console.log('🤖 Testing Admin AI Select & Enhance flow...');
    console.log('');
    
    // Step 1: Test AI selection
    console.log('Step 1: Calling AI article selection...');
    const selectResponse = await fetch(`${BASE_URL}/api/admin/articles/select-article`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ count: 1 })
    });

    const selectData = await selectResponse.json();
    
    console.log(`✅ Selection Status: ${selectResponse.status}`);
    console.log(`📝 Selection Message: ${selectData.message}`);
    
    if (selectData.success && selectData.article) {
      console.log(`🎯 Selected Article: "${selectData.article.title.substring(0, 60)}..."`);
      console.log(`📊 Selection Score: ${selectData.article.priority_score}`);
      console.log(`🎨 Selection Method: ${selectData.method}`);
      console.log(`💭 Selection Reason: "${selectData.article.selection_reason.substring(0, 100)}..."`);
      console.log('');
      
      // Step 2: Test enhancement of selected article
      console.log('Step 2: Calling article enhancement...');
      const enhanceResponse = await fetch(`${BASE_URL}/api/admin/articles/enhance-selected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const enhanceData = await enhanceResponse.json();
      
      console.log(`✅ Enhancement Status: ${enhanceResponse.status}`);
      console.log(`📝 Enhancement Message: ${enhanceData.message || 'No message'}`);
      
      if (enhanceData.success) {
        console.log(`🌐 Enhanced Articles: ${enhanceData.totalEnhanced}`);
        console.log(`💾 Saved Articles: ${enhanceData.totalSaved}`);
        console.log(`⏱️ Processing Time: ${enhanceData.processingTimeMinutes} minutes`);
      } else {
        console.log(`❌ Enhancement Error: ${enhanceData.error}`);
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
  console.log('🚀 Testing AI Select & Enhance Flow');
  console.log('=====================================');
  
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log('❌ Server not running. Please start with: npm run dev');
    process.exit(1);
  }
  
  await testAdminAISelection();
}

main();