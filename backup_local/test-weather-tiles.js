#!/usr/bin/env node

/**
 * Test script to verify OpenWeatherMap tile URLs
 * This script tests the actual tile URLs used by the weather map to understand
 * why they might appear as solid color rectangles.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration from the codebase
const OWM_KEY = "0bbcaaa4b5edb666304a4c13a9aa6199"; // From WEATHER_MAP_IMPLEMENTATION.md
const HONG_KONG_CENTER = { lat: 22.296, lng: 114.1722 };

// Available layers from lib/openWeatherFields.ts
const LAYERS = {
  precipitation: 'precipitation_new',
  temperature: 'temp_new',
  wind: 'wind_new',
  pressure: 'pressure_new',
  clouds: 'clouds_new'
};

// Test coordinates around Hong Kong at different zoom levels
const TEST_COORDINATES = [
  { z: 6, x: 52, y: 30 },   // Low zoom - should cover Hong Kong area
  { z: 8, x: 210, y: 122 }, // Medium zoom - Hong Kong region
  { z: 10, x: 840, y: 490 }, // High zoom - Hong Kong city
  { z: 12, x: 3361, y: 1961 }, // Very high zoom - Central HK
];

/**
 * Test a single tile URL
 */
function testTileUrl(layer, layerName, z, x, y) {
  const url = `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${OWM_KEY}`;
  
  return new Promise((resolve) => {
    console.log(`Testing ${layerName} tile at z=${z}, x=${x}, y=${y}`);
    console.log(`URL: ${url}`);
    
    const req = https.get(url, (res) => {
      let data = [];
      
      res.on('data', (chunk) => {
        data.push(chunk);
      });
      
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        const contentType = res.headers['content-type'];
        
        const result = {
          layer: layerName,
          z, x, y,
          status: res.statusCode,
          contentType,
          size: buffer.length,
          url
        };
        
        // Save a sample tile for inspection
        if (res.statusCode === 200 && buffer.length > 0) {
          const filename = `sample-${layerName}-${z}-${x}-${y}.png`;
          fs.writeFileSync(filename, buffer);
          result.savedAs = filename;
        }
        
        console.log(`  Status: ${res.statusCode}`);
        console.log(`  Content-Type: ${contentType}`);
        console.log(`  Size: ${buffer.length} bytes`);
        if (result.savedAs) {
          console.log(`  Saved as: ${result.savedAs}`);
        }
        console.log('');
        
        resolve(result);
      });
    });
    
    req.on('error', (err) => {
      console.log(`  Error: ${err.message}`);
      console.log('');
      resolve({
        layer: layerName,
        z, x, y,
        error: err.message,
        url
      });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      console.log(`  Timeout`);
      console.log('');
      resolve({
        layer: layerName,
        z, x, y,
        error: 'timeout',
        url
      });
    });
  });
}

/**
 * Test all layers at all zoom levels
 */
async function testAllTiles() {
  console.log('='.repeat(60));
  console.log('OpenWeatherMap Tile URL Test');
  console.log('='.repeat(60));
  console.log(`API Key: ${OWM_KEY}`);
  console.log(`Test coordinates around Hong Kong (${HONG_KONG_CENTER.lat}, ${HONG_KONG_CENTER.lng})`);
  console.log('');
  
  const results = [];
  
  // Test each layer
  for (const [layerName, layerCode] of Object.entries(LAYERS)) {
    console.log(`\n${'='.repeat(40)}`);
    console.log(`Testing ${layerName.toUpperCase()} layer (${layerCode})`);
    console.log(`${'='.repeat(40)}`);
    
    // Test at different zoom levels
    for (const coord of TEST_COORDINATES) {
      const result = await testTileUrl(layerCode, layerName, coord.z, coord.x, coord.y);
      results.push(result);
      
      // Small delay to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.status === 200);
  const failed = results.filter(r => r.status !== 200 || r.error);
  
  console.log(`Total tests: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log('');
  
  if (successful.length > 0) {
    console.log('✅ Successful requests:');
    successful.forEach(r => {
      console.log(`  ${r.layer} z=${r.z}: ${r.size} bytes (${r.contentType})`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed requests:');
    failed.forEach(r => {
      console.log(`  ${r.layer} z=${r.z}: ${r.error || `HTTP ${r.status}`}`);
    });
  }
  
  // Analysis
  console.log('\n' + '='.repeat(60));
  console.log('ANALYSIS');
  console.log('='.repeat(60));
  
  if (successful.length > 0) {
    const avgSize = successful.reduce((sum, r) => sum + r.size, 0) / successful.length;
    console.log(`Average tile size: ${Math.round(avgSize)} bytes`);
    
    if (avgSize < 1000) {
      console.log('⚠️  WARNING: Tiles are very small, might be empty/transparent');
    }
    
    // Check for saved files
    const savedFiles = successful.filter(r => r.savedAs);
    if (savedFiles.length > 0) {
      console.log('\n📁 Sample tiles saved:');
      savedFiles.forEach(r => {
        console.log(`  ${r.savedAs}`);
      });
      console.log('\nYou can inspect these PNG files to see the actual tile content.');
    }
  }
  
  // Troubleshooting tips
  console.log('\n🔍 TROUBLESHOOTING TIPS:');
  console.log('1. Check if the API key is valid and active');
  console.log('2. Verify the tile coordinates are correct for Hong Kong');
  console.log('3. Some weather layers might be transparent if no weather data exists');
  console.log('4. Try different zoom levels - some data might only be available at certain scales');
  console.log('5. Check the OpenWeatherMap documentation for layer-specific requirements');
  
  // Additional test URLs for manual verification
  console.log('\n🌐 TEST URLS FOR MANUAL VERIFICATION:');
  console.log('Open these URLs in a browser to see the actual tiles:');
  console.log('');
  Object.entries(LAYERS).forEach(([name, code]) => {
    const url = `https://tile.openweathermap.org/map/${code}/10/840/490.png?appid=${OWM_KEY}`;
    console.log(`${name}: ${url}`);
  });
}

// Alternative API endpoints to test
async function testAlternativeEndpoints() {
  console.log('\n' + '='.repeat(60));
  console.log('TESTING ALTERNATIVE ENDPOINTS');
  console.log('='.repeat(60));
  
  // Test Weather Maps 2.0 API
  const v2Url = `https://maps.openweathermap.org/maps/2.0/weather/PR0/10/840/490?appid=${OWM_KEY}`;
  console.log(`Testing Weather Maps 2.0: ${v2Url}`);
  
  // Test current weather API
  const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${HONG_KONG_CENTER.lat}&lon=${HONG_KONG_CENTER.lng}&appid=${OWM_KEY}`;
  console.log(`Testing Current Weather API: ${currentWeatherUrl}`);
  
  return new Promise((resolve) => {
    https.get(currentWeatherUrl, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('Current Weather API Response:');
        console.log(data);
        resolve();
      });
    }).on('error', (err) => {
      console.log('Current Weather API Error:', err.message);
      resolve();
    });
  });
}

// Run the tests
async function main() {
  await testAllTiles();
  await testAlternativeEndpoints();
}

main().catch(console.error);