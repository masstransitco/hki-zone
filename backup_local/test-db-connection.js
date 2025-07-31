#!/usr/bin/env node

/**
 * Test database connection and basic queries
 */

const BASE_URL = 'http://localhost:3000';

async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing basic database connection...');
    
    // Test the GET endpoint which should have simpler logic
    const response = await fetch(`${BASE_URL}/api/cron/enhance-selected`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.ok && data.configured) {
      console.log('✅ Database connection working for GET endpoint');
    } else {
      console.log('❌ Issue with GET endpoint');
    }
    
  } catch (error) {
    console.error('Fetch error:', error.message);
  }
}

testDatabaseConnection();