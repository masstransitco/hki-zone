const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugJazzSearch() {
  console.log('🔍 Investigating Jazz search issue...\n');

  try {
    // 1. Check for Jazz cars in articles table
    console.log('1. Checking articles table for Jazz cars:');
    const { data: articlesJazz, error: articlesError } = await supabase
      .from('articles')
      .select('id, title, make, model, category, content')
      .eq('category', 'cars')
      .or('title.ilike.%jazz%,make.ilike.%jazz%,model.ilike.%jazz%,content.ilike.%jazz%');

    if (articlesError) {
      console.error('Error querying articles:', articlesError);
    } else {
      console.log(`Found ${articlesJazz.length} Jazz cars in articles table:`);
      articlesJazz.forEach(car => {
        console.log(`  - ${car.title} (Make: ${car.make}, Model: ${car.model})`);
      });
    }

    console.log('\n2. Checking articles_unified table for Jazz cars:');
    const { data: unifiedJazz, error: unifiedError } = await supabase
      .from('articles_unified')
      .select('id, title, contextual_data, category, content')
      .eq('category', 'cars')
      .or('title.ilike.%jazz%,content.ilike.%jazz%');

    if (unifiedError) {
      console.error('Error querying articles_unified:', unifiedError);
    } else {
      console.log(`Found ${unifiedJazz.length} Jazz cars in articles_unified table:`);
      unifiedJazz.forEach(car => {
        const make = car.contextual_data?.make;
        const model = car.contextual_data?.model;
        console.log(`  - ${car.title} (Make: ${make}, Model: ${model})`);
      });
    }

    // 3. Test the current search function
    console.log('\n3. Testing current search_car_listings function with "jazz":');
    const { data: searchResult, error: searchError } = await supabase
      .rpc('search_car_listings', {
        search_query: 'jazz',
        result_limit: 10,
        result_offset: 0
      });

    if (searchError) {
      console.error('Search function error:', searchError);
    } else {
      console.log(`Search function returned ${searchResult.length} results for "jazz"`);
      searchResult.forEach(car => {
        console.log(`  - ${car.title} (Make: ${car.make}, Model: ${car.model}, Rank: ${car.rank})`);
      });
    }

    // 4. Compare with Alphard search
    console.log('\n4. Testing search_car_listings function with "alphard":');
    const { data: alphardResult, error: alphardError } = await supabase
      .rpc('search_car_listings', {
        search_query: 'alphard',
        result_limit: 10,
        result_offset: 0
      });

    if (alphardError) {
      console.error('Alphard search error:', alphardError);
    } else {
      console.log(`Search function returned ${alphardResult.length} results for "alphard"`);
      alphardResult.forEach(car => {
        console.log(`  - ${car.title} (Make: ${car.make}, Model: ${car.model}, Rank: ${car.rank})`);
      });
    }

    // 5. Check table counts
    console.log('\n5. Table statistics:');
    
    const { count: articlesCount } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'cars');
    
    const { count: unifiedCount } = await supabase
      .from('articles_unified')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'cars');

    console.log(`  - articles table: ${articlesCount} cars`);
    console.log(`  - articles_unified table: ${unifiedCount} cars`);

    // 6. Check if search_text column exists and is populated
    console.log('\n6. Checking search_text column in articles table:');
    const { data: searchTextSample, error: searchTextError } = await supabase
      .from('articles')
      .select('id, title, make, model, search_text')
      .eq('category', 'cars')
      .not('search_text', 'is', null)
      .limit(3);

    if (searchTextError) {
      console.error('Error checking search_text:', searchTextError);
    } else {
      console.log(`Found ${searchTextSample.length} cars with search_text populated:`);
      searchTextSample.forEach(car => {
        console.log(`  - ${car.title}: search_text exists`);
      });
    }

  } catch (error) {
    console.error('Script error:', error);
  }
}

debugJazzSearch();