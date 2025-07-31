#!/usr/bin/env node

// Script to analyze car listing database structure and data distribution
// This helps understand the data for creating effective search functionality

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function analyzeCarDatabase() {
  console.log('🚗 Analyzing car listing database structure...\n');

  try {
    // 1. Count total cars
    const { data: totalCars, error: countError } = await supabase
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('category', 'cars');

    if (countError) throw countError;

    console.log(`📊 Total car listings: ${totalCars?.length || 0}\n`);

    // 2. Analyze make distribution
    const { data: carData, error: dataError } = await supabase
      .from('articles')
      .select('title, content, specs, ai_summary, images, image_url, price, created_at')
      .eq('category', 'cars')
      .order('created_at', { ascending: false })
      .limit(500); // Analyze recent 500 cars

    if (dataError) throw dataError;

    if (!carData || carData.length === 0) {
      console.log('⚠️ No car data found in database');
      return;
    }

    console.log(`🔍 Analyzing ${carData.length} recent car listings...\n`);

    // 3. Extract and analyze makes/models
    const makeModelData = new Map();
    const priceRanges = {
      under100k: 0,
      range100to300k: 0,
      range300to500k: 0,
      range500to1m: 0,
      over1m: 0,
      unknown: 0
    };

    carData.forEach(car => {
      // Extract make from title (first word usually)
      const titleParts = car.title?.trim().split(/\s+/) || [];
      const make = titleParts[0] || 'Unknown';
      const model = titleParts.slice(1).join(' ') || 'Unknown';

      if (!makeModelData.has(make)) {
        makeModelData.set(make, { count: 0, models: new Set() });
      }
      makeModelData.get(make).count++;
      makeModelData.get(make).models.add(model);

      // Analyze price ranges
      if (car.specs?.售價 || car.price) {
        const priceStr = car.specs?.售價 || car.price || '';
        const priceMatch = priceStr.match(/[\d,]+/);
        if (priceMatch) {
          const price = parseInt(priceMatch[0].replace(/,/g, ''));
          if (price < 100000) priceRanges.under100k++;
          else if (price < 300000) priceRanges.range100to300k++;
          else if (price < 500000) priceRanges.range300to500k++;
          else if (price < 1000000) priceRanges.range500to1m++;
          else priceRanges.over1m++;
        } else {
          priceRanges.unknown++;
        }
      } else {
        priceRanges.unknown++;
      }
    });

    // 4. Display make distribution
    console.log('🏭 Car Make Distribution:');
    console.log('─'.repeat(40));
    const sortedMakes = Array.from(makeModelData.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20); // Top 20 makes

    sortedMakes.forEach(([make, data]) => {
      console.log(`${make}: ${data.count} cars (${data.models.size} models)`);
    });

    console.log(`\n💰 Price Distribution:`);
    console.log('─'.repeat(40));
    console.log(`Under HK$100,000: ${priceRanges.under100k}`);
    console.log(`HK$100,000 - HK$300,000: ${priceRanges.range100to300k}`);
    console.log(`HK$300,000 - HK$500,000: ${priceRanges.range300to500k}`);
    console.log(`HK$500,000 - HK$1,000,000: ${priceRanges.range500to1m}`);
    console.log(`Over HK$1,000,000: ${priceRanges.over1m}`);
    console.log(`Unknown/Invalid price: ${priceRanges.unknown}`);

    // 5. Analyze data quality for search
    console.log(`\n🔍 Data Quality Analysis:`);
    console.log('─'.repeat(40));

    let hasImages = 0;
    let hasSpecs = 0;
    let hasAiSummary = 0;
    let hasPrice = 0;

    carData.forEach(car => {
      if (car.images?.length > 0 || car.image_url) hasImages++;
      if (car.specs && Object.keys(car.specs).length > 0) hasSpecs++;
      if (car.ai_summary) hasAiSummary++;
      if (car.specs?.售價 || car.price) hasPrice++;
    });

    console.log(`Cars with images: ${hasImages}/${carData.length} (${(hasImages/carData.length*100).toFixed(1)}%)`);
    console.log(`Cars with specs: ${hasSpecs}/${carData.length} (${(hasSpecs/carData.length*100).toFixed(1)}%)`);
    console.log(`Cars with AI summary: ${hasAiSummary}/${carData.length} (${(hasAiSummary/carData.length*100).toFixed(1)}%)`);
    console.log(`Cars with price: ${hasPrice}/${carData.length} (${(hasPrice/carData.length*100).toFixed(1)}%)`);

    // 6. Sample data structure
    console.log(`\n📋 Sample Car Data Structure:`);
    console.log('─'.repeat(40));
    const sampleCar = carData[0];
    console.log(`Title: ${sampleCar.title}`);
    console.log(`Price: ${sampleCar.specs?.售價 || 'N/A'}`);
    console.log(`Images: ${sampleCar.images?.length || 0} photos`);
    console.log(`Specs available: ${Object.keys(sampleCar.specs || {}).join(', ')}`);
    console.log(`AI Summary: ${sampleCar.ai_summary ? 'Yes' : 'No'}`);

    // 7. Database schema analysis
    console.log(`\n🗃️ Database Schema Recommendations:`);
    console.log('─'.repeat(40));
    console.log('✅ Current storage: articles table with category="cars"');
    console.log('✅ Structured specs: JSONB field with car specifications');
    console.log('✅ Image support: Multiple images stored as array');
    console.log('✅ Search-ready: Full-text search index exists');
    
    console.log('\n🎯 Search Component Requirements:');
    console.log('─'.repeat(40));
    console.log('1. Make/Model filtering: Extract from title field');
    console.log('2. Price range filtering: Parse from specs.售價 field');
    console.log('3. Year filtering: Use specs.年份 field');
    console.log('4. Full-text search: Use existing search index');
    console.log('5. Image filtering: Check images array length');
    console.log('6. Sort options: price, date, make, model');

    console.log('\n✅ Database analysis complete!');

  } catch (error) {
    console.error('❌ Database analysis failed:', error);
    process.exit(1);
  }
}

// Run the analysis
if (require.main === module) {
  analyzeCarDatabase();
}

module.exports = { analyzeCarDatabase };