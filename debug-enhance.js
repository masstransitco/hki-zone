#!/usr/bin/env node

/**
 * Debug script for enhancement endpoint
 */

const BASE_URL = 'http://localhost:3000';

async function debugEnhancement() {
  try {
    console.log('🔍 Debugging enhancement endpoint...');
    
    const response = await fetch(`${BASE_URL}/api/cron/enhance-selected`, {
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

debugEnhancement();