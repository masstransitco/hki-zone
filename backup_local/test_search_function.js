const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function testSearchFunctions() {
  console.log('=== TESTING SEARCH FUNCTIONS ===\n');
  
  try {
    // Test if the unified function exists
    console.log('1. Testing search_car_listings_unified function:');
    const { data: unifiedResult, error: unifiedError } = await supabase
      .rpc('search_car_listings_unified', {
        search_query: 'JAZZ',
        result_limit: 5,
        result_offset: 0
      });
    
    if (unifiedError) {
      console.error('Error with unified function:', unifiedError);
    } else {
      console.log(`Found ${unifiedResult.length} JAZZ cars via unified function:`);
      unifiedResult.forEach(car => {
        console.log(`- ID: ${car.id}, Title: ${car.title}, Make: ${car.make}, Model: ${car.model}`);
      });
    }

    // Test the main function again to see if it uses unified
    console.log('\n2. Testing search_car_listings function again:');
    const { data: mainResult, error: mainError } = await supabase
      .rpc('search_car_listings', {
        search_query: 'JAZZ',
        result_limit: 5,
        result_offset: 0
      });
    
    if (mainError) {
      console.error('Error with main function:', mainError);
    } else {
      console.log(`Found ${mainResult.length} JAZZ cars via main function:`);
      mainResult.forEach(car => {
        console.log(`- ID: ${car.id}, Title: ${car.title}, Make: ${car.make}, Model: ${car.model}`);
      });
    }

    // Test with case variations
    console.log('\n3. Testing case variations:');
    const testCases = ['jazz', 'Jazz', 'JAZZ', '本田', 'HONDA'];
    
    for (const testCase of testCases) {
      const { data: result, error } = await supabase
        .rpc('search_car_listings', {
          search_query: testCase,
          result_limit: 3,
          result_offset: 0
        });
      
      if (error) {
        console.error(`Error searching for "${testCase}":`, error);
      } else {
        console.log(`"${testCase}": ${result.length} results`);
      }
    }

    // Check what search functions are available
    console.log('\n4. Checking available functions:');
    const { data: functions, error: functionsError } = await supabase
      .from('pg_proc')
      .select('proname')
      .like('proname', '%search%car%');
    
    if (functionsError) {
      console.error('Error checking functions:', functionsError);
    } else {
      console.log('Available search functions:');
      functions.forEach(func => console.log(`- ${func.proname}`));
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testSearchFunctions();