#!/usr/bin/env node

/**
 * Test selection with detailed debugging
 */

const BASE_URL = 'http://localhost:3000';

async function testSelection() {
  try {
    console.log('🔍 Testing article selection with debug output...');
    
    const response = await fetch(`${BASE_URL}/api/cron/select-article`, {
      method: 'POST',
      headers: {
        'User-Agent': 'vercel-cron/1.0',
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Fetch error:', error.message);
  }
}

testSelection();