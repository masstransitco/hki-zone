#!/usr/bin/env node

// Script to check the current structure of the articles table

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkTableStructure() {
  console.log('🔍 Checking articles table structure...\n');

  try {
    // Get table structure
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error querying articles table:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('📊 Articles table columns:');
      const sampleRow = data[0];
      Object.keys(sampleRow).forEach(column => {
        const value = sampleRow[column];
        const type = typeof value;
        console.log(`  - ${column}: ${type} ${Array.isArray(value) ? '(array)' : ''}`);
      });

      console.log('\n📋 Sample car data:');
      const carData = await supabase
        .from('articles')
        .select('*')
        .eq('category', 'cars')
        .limit(1);

      if (carData.data && carData.data.length > 0) {
        const carRow = carData.data[0];
        console.log('Car listing structure:');
        Object.entries(carRow).forEach(([key, value]) => {
          if (value !== null) {
            console.log(`  - ${key}: ${JSON.stringify(value).substring(0, 100)}${JSON.stringify(value).length > 100 ? '...' : ''}`);
          }
        });
      } else {
        console.log('No car data found in articles table');
      }

    } else {
      console.log('❌ No data found in articles table');
    }

    // Check if there are any cars at all
    const { count } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'cars');

    console.log(`\n🚗 Total cars in database: ${count || 0}`);

  } catch (error) {
    console.error('❌ Failed to check table structure:', error);
  }
}

// Run the check
if (require.main === module) {
  checkTableStructure();
}