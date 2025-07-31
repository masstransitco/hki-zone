#!/usr/bin/env node

/**
 * Simple test for enhancement endpoint only
 */

const BASE_URL = 'http://localhost:3000';

async function testEnhancement() {
  try {
    console.log('🔍 Testing enhancement endpoint directly...');
    
    const response = await fetch(`${BASE_URL}/api/cron/enhance-selected`, {
      method: 'POST',
      headers: {
        'User-Agent': 'vercel-cron/1.0',
        'Content-Type': 'application/json'
      }
    });

    const text = await response.text();
    console.log(`Status: ${response.status}`);
    console.log('Raw response:', text);
    
    try {
      const data = JSON.parse(text);
      console.log('Parsed JSON:', JSON.stringify(data, null, 2));
    } catch (parseError) {
      console.log('Failed to parse as JSON, response was:', text);
    }
    
  } catch (error) {
    console.error('Fetch error:', error.message);
  }
}

testEnhancement();