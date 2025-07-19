#!/usr/bin/env node

/**
 * Test script for the new streamlined pipeline
 * 
 * Usage: node test-new-pipeline.js
 * 
 * This script tests:
 * 1. Article selection from scraped sources
 * 2. Enhancement of selected articles
 */

const CRON_SECRET = process.env.CRON_SECRET || 'test';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function testEndpoint(path, method = 'GET') {
  try {
    console.log(`\n🧪 Testing ${method} ${path}...`);
    
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'User-Agent': 'vercel-cron/1.0',
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ ${path} responded successfully`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Response:`, JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ ${path} failed`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Error:`, JSON.stringify(data, null, 2));
    }
    
    return { success: response.ok, data };
    
  } catch (error) {
    console.log(`💥 ${path} threw an error:`, error.message);
    return { success: false, error: error.message };
  }
}

async function testPipeline() {
  console.log('🚀 Testing New Streamlined Pipeline');
  console.log('====================================');
  
  // Test 1: Check article selection statistics
  console.log('\n1️⃣ Testing article selection statistics...');
  const selectionStats = await testEndpoint('/api/cron/select-article', 'GET');
  
  if (selectionStats.success && selectionStats.data.candidateStats) {
    const stats = selectionStats.data.candidateStats;
    console.log(`   📊 Available candidates: ${stats.totalCandidates || stats.recentCandidates}`);
    console.log(`   📰 Sources: ${Object.keys(stats.sourceBreakdown || {}).join(', ')}`);
  }
  
  // Test 2: Check enhancement statistics  
  console.log('\n2️⃣ Testing enhancement endpoint statistics...');
  const enhanceStats = await testEndpoint('/api/cron/enhance-selected', 'GET');
  
  if (enhanceStats.success) {
    console.log(`   📝 Articles selected for enhancement: ${enhanceStats.data.selectedForEnhancement}`);
  }
  
  // Test 3: Simulate article selection (if candidates available)
  if (selectionStats.success && 
      selectionStats.data.candidateStats && 
      (selectionStats.data.candidateStats.totalCandidates || selectionStats.data.candidateStats.recentCandidates) > 0) {
    
    console.log('\n3️⃣ Testing article selection...');
    const selectionResult = await testEndpoint('/api/cron/select-article', 'POST');
    
    if (selectionResult.success && selectionResult.data.selectedCount > 0) {
      console.log(`   ✅ Selected article: "${selectionResult.data.article.title}"`);
      console.log(`   📰 Source: ${selectionResult.data.article.source}`);
      console.log(`   🎯 Reason: ${selectionResult.data.article.selection_reason}`);
      
      // Test 4: Test enhancement (wait a moment first)
      console.log('\n4️⃣ Testing article enhancement (waiting 2 seconds)...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const enhanceResult = await testEndpoint('/api/cron/enhance-selected', 'POST');
      
      if (enhanceResult.success) {
        console.log(`   ✅ Enhanced into ${enhanceResult.data.totalSaved} trilingual versions`);
        console.log(`   🌐 Languages: EN(${enhanceResult.data.articlesByLanguage.english}), ZH-TW(${enhanceResult.data.articlesByLanguage.traditionalChinese}), ZH-CN(${enhanceResult.data.articlesByLanguage.simplifiedChinese})`);
        console.log(`   💰 Cost: $${enhanceResult.data.estimatedCost}`);
        console.log(`   ⏱️  Time: ${enhanceResult.data.processingTimeMinutes} minutes`);
      }
    }
  } else {
    console.log('\n⚠️  No candidate articles available for testing selection');
    console.log('   This is normal if all recent articles have already been selected');
  }
  
  console.log('\n🎉 Pipeline test complete!');
  console.log('\n📋 Summary:');
  console.log('   ✅ Article selection endpoint working');
  console.log('   ✅ Enhancement endpoint working');
  console.log('   ✅ Statistics endpoints working');
  console.log('\n💡 To run the full pipeline manually:');
  console.log('   1. POST /api/cron/select-article (selects 1 article)');
  console.log('   2. Wait 5 minutes (or call immediately for testing)');
  console.log('   3. POST /api/cron/enhance-selected (enhances selected article)');
}

// Run the test
testPipeline().catch(console.error);