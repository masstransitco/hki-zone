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

async function investigateJazzCars() {
  console.log('=== INVESTIGATING JAZZ CARS IN DATABASE ===\n');
  
  try {
    // 1. Check for Jazz cars in articles table
    console.log('1. Searching for Jazz cars in articles table:');
    const { data: articlesJazz, error: articlesError } = await supabase
      .from('articles')
      .select('id, title, make, model, category, content, specs')
      .eq('category', 'cars')
      .or('title.ilike.%jazz%,make.ilike.%jazz%,model.ilike.%jazz%,content.ilike.%jazz%');
    
    if (articlesError) {
      console.error('Error searching articles:', articlesError);
    } else {
      console.log(`Found ${articlesJazz.length} Jazz cars in articles table:`);
      articlesJazz.forEach(car => {
        console.log(`- ID: ${car.id}, Title: ${car.title}, Make: ${car.make}, Model: ${car.model}`);
      });
    }

    // 2. Check for Jazz cars in articles_unified table
    console.log('\n2. Searching for Jazz cars in articles_unified table:');
    const { data: unifiedJazz, error: unifiedError } = await supabase
      .from('articles_unified')
      .select('id, title, category, contextual_data, content')
      .eq('category', 'cars')
      .or('title.ilike.%jazz%,content.ilike.%jazz%');
    
    if (unifiedError) {
      console.error('Error searching articles_unified:', unifiedError);
    } else {
      console.log(`Found ${unifiedJazz.length} Jazz cars in articles_unified table:`);
      unifiedJazz.forEach(car => {
        const make = car.contextual_data?.make || 'N/A';
        const model = car.contextual_data?.model || 'N/A';
        console.log(`- ID: ${car.id}, Title: ${car.title}, Make: ${make}, Model: ${model}`);
      });
    }

    // 3. Check for cars with "jazz" in contextual_data
    console.log('\n3. Searching for Jazz in contextual_data field:');
    const { data: contextualJazz, error: contextualError } = await supabase
      .from('articles_unified')
      .select('id, title, contextual_data')
      .eq('category', 'cars')
      .or('contextual_data->>make.ilike.%jazz%,contextual_data->>model.ilike.%jazz%');
    
    if (contextualError) {
      console.error('Error searching contextual data:', contextualError);
    } else {
      console.log(`Found ${contextualJazz.length} Jazz cars in contextual_data:`);
      contextualJazz.forEach(car => {
        const make = car.contextual_data?.make || 'N/A';
        const model = car.contextual_data?.model || 'N/A';
        console.log(`- ID: ${car.id}, Title: ${car.title}, Make: ${make}, Model: ${model}`);
      });
    }

    // 4. Compare with working examples - ALPHARD
    console.log('\n4. Searching for ALPHARD cars for comparison:');
    const { data: alphardCars, error: alphardError } = await supabase
      .rpc('search_car_listings', {
        search_query: 'ALPHARD',
        result_limit: 5,
        result_offset: 0
      });
    
    if (alphardError) {
      console.error('Error searching ALPHARD:', alphardError);
    } else {
      console.log(`Found ${alphardCars.length} ALPHARD cars via search function:`);
      alphardCars.forEach(car => {
        console.log(`- ID: ${car.id}, Title: ${car.title}, Make: ${car.make}, Model: ${car.model}`);
      });
    }

    // 5. Test the search function with JAZZ
    console.log('\n5. Testing search function with "JAZZ":');
    const { data: jazzSearchResult, error: jazzSearchError } = await supabase
      .rpc('search_car_listings', {
        search_query: 'JAZZ',
        result_limit: 10,
        result_offset: 0
      });
    
    if (jazzSearchError) {
      console.error('Error searching JAZZ via function:', jazzSearchError);
    } else {
      console.log(`Found ${jazzSearchResult.length} JAZZ cars via search function:`);
      jazzSearchResult.forEach(car => {
        console.log(`- ID: ${car.id}, Title: ${car.title}, Make: ${car.make}, Model: ${car.model}`);
      });
    }

    // 6. Check total car counts
    console.log('\n6. Total car counts:');
    const { count: articlesCount } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'cars');
    
    const { count: unifiedCount } = await supabase
      .from('articles_unified')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'cars');
    
    console.log(`- Articles table: ${articlesCount} cars`);
    console.log(`- Articles_unified table: ${unifiedCount} cars`);

    // 7. Sample some cars from each table to see data structure
    console.log('\n7. Sample cars from each table:');
    
    const { data: sampleArticles } = await supabase
      .from('articles')
      .select('id, title, make, model, specs')
      .eq('category', 'cars')
      .limit(3);
    
    console.log('Sample from articles table:');
    sampleArticles?.forEach(car => {
      console.log(`- Title: ${car.title}, Make: ${car.make}, Model: ${car.model}`);
    });

    const { data: sampleUnified } = await supabase
      .from('articles_unified')
      .select('id, title, contextual_data')
      .eq('category', 'cars')
      .limit(3);
    
    console.log('\nSample from articles_unified table:');
    sampleUnified?.forEach(car => {
      const make = car.contextual_data?.make || 'N/A';
      const model = car.contextual_data?.model || 'N/A';
      console.log(`- Title: ${car.title}, Make: ${make}, Model: ${model}`);
    });

  } catch (error) {
    console.error('Investigation failed:', error);
  }
}

investigateJazzCars();