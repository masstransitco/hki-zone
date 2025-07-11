// Test script to check car images in the database
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Make sure to set environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCarImages() {
  console.log('🚗 Checking car images in database...\n');
  
  try {
    // First check if images column exists
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_columns', { table_name: 'articles_unified' });
    
    if (tableError) {
      console.log('Could not get table info, proceeding anyway...');
    } else if (tableInfo) {
      const hasImagesColumn = tableInfo.some(col => col.column_name === 'images');
      console.log(`✅ Images column exists: ${hasImagesColumn}\n`);
    }
    
    // Get recent cars from articles_unified
    console.log('📊 Fetching recent cars from articles_unified...');
    const { data: unifiedCars, error: unifiedError } = await supabase
      .from('articles_unified')
      .select('id, title, image_url, images, source, created_at')
      .eq('category', 'cars')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (unifiedError) {
      console.error('Error fetching from articles_unified:', unifiedError.message);
    } else if (unifiedCars && unifiedCars.length > 0) {
      console.log(`\nFound ${unifiedCars.length} cars in articles_unified:\n`);
      
      unifiedCars.forEach((car, index) => {
        console.log(`${index + 1}. ${car.title}`);
        console.log(`   ID: ${car.id}`);
        console.log(`   Source: ${car.source}`);
        console.log(`   Created: ${new Date(car.created_at).toLocaleString()}`);
        console.log(`   Image URL: ${car.image_url ? '✅ Yes' : '❌ No'}`);
        console.log(`   Images array: ${car.images ? `✅ ${Array.isArray(car.images) ? car.images.length : 'Invalid'} images` : '❌ No array'}`);
        
        if (car.images && Array.isArray(car.images)) {
          console.log(`   Image URLs:`);
          car.images.forEach((img, i) => {
            console.log(`     ${i + 1}. ${img.substring(0, 60)}...`);
          });
        }
        console.log('');
      });
    } else {
      console.log('❌ No cars found in articles_unified table');
    }
    
    // Also check old articles table
    console.log('\n📊 Checking old articles table...');
    const { data: oldCars, error: oldError } = await supabase
      .from('articles')
      .select('id, title, image_url, source, created_at')
      .eq('category', 'cars')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (oldError) {
      console.error('Error fetching from articles table:', oldError.message);
    } else if (oldCars && oldCars.length > 0) {
      console.log(`\nFound ${oldCars.length} cars in articles table:\n`);
      
      oldCars.forEach((car, index) => {
        console.log(`${index + 1}. ${car.title}`);
        console.log(`   ID: ${car.id}`);
        console.log(`   Image URL: ${car.image_url ? '✅ Yes' : '❌ No'}`);
        console.log('');
      });
    }
    
    // Test the API endpoint
    console.log('\n🌐 Testing /api/cars endpoint...');
    const response = await fetch('http://localhost:3000/api/cars?page=0');
    if (response.ok) {
      const data = await response.json();
      console.log(`\nAPI returned ${data.articles.length} cars`);
      console.log(`Source: ${data.debug?.source || 'unknown'}`);
      
      if (data.articles.length > 0) {
        console.log('\nFirst car from API:');
        const firstCar = data.articles[0];
        console.log(`Title: ${firstCar.title}`);
        console.log(`Images array: ${firstCar.images ? `✅ ${firstCar.images.length} images` : '❌ No images'}`);
        if (firstCar.images && firstCar.images.length > 0) {
          console.log('Image URLs:');
          firstCar.images.forEach((img, i) => {
            console.log(`  ${i + 1}. ${img.substring(0, 60)}...`);
          });
        }
      }
    } else {
      console.error('API request failed:', response.status);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Also create a function to check table structure
async function checkTableStructure() {
  console.log('\n📋 Checking table structure...');
  
  try {
    // Try to get a car and see all its fields
    const { data: sampleCar, error } = await supabase
      .from('articles_unified')
      .select('*')
      .eq('category', 'cars')
      .limit(1)
      .single();
    
    if (error) {
      console.error('Error getting sample car:', error.message);
    } else if (sampleCar) {
      console.log('\nSample car fields:');
      Object.keys(sampleCar).forEach(key => {
        const value = sampleCar[key];
        if (key === 'images') {
          console.log(`- ${key}: ${value ? `[${Array.isArray(value) ? value.length : 'Invalid'} items]` : 'null'}`);
        } else if (typeof value === 'string' && value.length > 50) {
          console.log(`- ${key}: "${value.substring(0, 50)}..."`);
        } else {
          console.log(`- ${key}: ${JSON.stringify(value)}`);
        }
      });
    }
  } catch (error) {
    console.error('Error checking table structure:', error.message);
  }
}

// Run the checks
checkCarImages().then(() => checkTableStructure());