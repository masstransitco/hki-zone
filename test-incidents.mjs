// Test script for government incidents workflow
// Run with: node test-incidents.js

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testIncidentWorkflow() {
  console.log('🧪 Testing Government Incident Workflow...\n');

  try {
    // 1. Test government feed fetching
    console.log('1. Testing government feed fetching...');
    const fetchResponse = await fetch(`${BASE_URL}/api/cron/fetch-gov-feeds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (fetchResponse.ok) {
      const fetchData = await fetchResponse.json();
      console.log('✅ Government feeds fetched successfully');
      console.log(`   - Total incidents: ${fetchData.result.totalIncidents}`);
      console.log(`   - Processed feeds: ${fetchData.result.processedFeeds}`);
      if (fetchData.result.errors.length > 0) {
        console.log(`   - Errors: ${fetchData.result.errors.length}`);
      }
    } else {
      console.log('❌ Failed to fetch government feeds');
      console.log(`   - Status: ${fetchResponse.status}`);
    }

    // 2. Test signals API
    console.log('\n2. Testing signals API...');
    const signalsResponse = await fetch(`${BASE_URL}/api/signals?limit=5`);
    
    if (signalsResponse.ok) {
      const signalsData = await signalsResponse.json();
      console.log('✅ Signals API working');
      console.log(`   - Total signals: ${signalsData.total}`);
      console.log(`   - Has more: ${signalsData.hasMore}`);
      
      if (signalsData.articles && signalsData.articles.length > 0) {
        const firstSignal = signalsData.articles[0];
        console.log(`   - Sample signal: ${firstSignal.title}`);
        console.log(`   - Category: ${firstSignal.category}`);
        console.log(`   - Severity: ${firstSignal.severity || 'N/A'}`);
        console.log(`   - Source: ${firstSignal.source_slug || firstSignal.source}`);
      }
    } else {
      console.log('❌ Signals API failed');
      console.log(`   - Status: ${signalsResponse.status}`);
    }

    // 3. Test category filtering
    console.log('\n3. Testing category filtering...');
    const categories = ['road', 'rail', 'weather', 'utility'];
    
    for (const category of categories) {
      const categoryResponse = await fetch(`${BASE_URL}/api/signals?category=${category}&limit=3`);
      
      if (categoryResponse.ok) {
        const categoryData = await categoryResponse.json();
        console.log(`   - ${category}: ${categoryData.total} incidents`);
      } else {
        console.log(`   - ${category}: Failed to fetch`);
      }
    }

    // 4. Test admin signals API
    console.log('\n4. Testing admin signals API...');
    const adminResponse = await fetch(`${BASE_URL}/api/admin/signals?limit=5`);
    
    if (adminResponse.ok) {
      const adminData = await adminResponse.json();
      console.log('✅ Admin signals API working');
      console.log(`   - Total incidents: ${adminData.total}`);
      
      if (adminData.incidents && adminData.incidents.length > 0) {
        const firstIncident = adminData.incidents[0];
        console.log(`   - Sample incident: ${firstIncident.title}`);
        console.log(`   - Enrichment status: ${firstIncident.enrichment_status}`);
        console.log(`   - AI Score: ${firstIncident.ai_score}`);
      }
    } else {
      console.log('❌ Admin signals API failed');
      console.log(`   - Status: ${adminResponse.status}`);
    }

    // 5. Test enrichment configuration
    console.log('\n5. Testing enrichment configuration...');
    const enrichmentResponse = await fetch(`${BASE_URL}/api/admin/signals/enrich-incident`);
    
    if (enrichmentResponse.ok) {
      const enrichmentData = await enrichmentResponse.json();
      console.log('✅ Enrichment API accessible');
      console.log(`   - Configured: ${enrichmentData.configured}`);
      console.log(`   - Status: ${enrichmentData.status}`);
      
      if (enrichmentData.enrichmentStats) {
        const stats = enrichmentData.enrichmentStats;
        console.log(`   - Total incidents: ${stats.total}`);
        console.log(`   - Pending: ${stats.pending}`);
        console.log(`   - Enriched: ${stats.enriched}`);
        console.log(`   - Ready: ${stats.ready}`);
        console.log(`   - Failed: ${stats.failed}`);
      }
    } else {
      console.log('❌ Enrichment API failed');
      console.log(`   - Status: ${enrichmentResponse.status}`);
    }

    console.log('\n🎉 Government Incident Workflow Test Complete!');
    console.log('\nNext steps:');
    console.log('1. Run database migration: `/Users/markau/panora830/supabase/migrations/20250715_government_incidents_schema.sql`');
    console.log('2. Set up PERPLEXITY_API_KEY environment variable for enrichment');
    console.log('3. Access admin interface at: http://localhost:3000/admin/signals');
    console.log('4. Access public signals at: http://localhost:3000/signals');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure the development server is running: npm run dev');
    console.log('2. Check if the database is properly configured');
    console.log('3. Verify API endpoints are accessible');
  }
}

// Run the test
testIncidentWorkflow();