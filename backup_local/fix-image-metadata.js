const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables from .env.local
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  const envVars = {};
  envFile.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  Object.assign(process.env, envVars);
} catch (error) {
  console.error('Could not load .env.local:', error.message);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAndFixImageMetadata() {
  console.log('=== Testing image_metadata Column ===\n');
  
  // Test 1: Try to select the column
  console.log('Test 1: Selecting image_metadata column...');
  const { data: test1, error: error1 } = await supabase
    .from('articles')
    .select('id, image_metadata')
    .limit(1);
  
  if (error1) {
    console.log('❌ Error:', error1.message);
  } else {
    console.log('✅ Success! Data:', test1);
  }
  
  // Test 2: Try to update with image_metadata
  console.log('\nTest 2: Trying to update image_metadata...');
  
  // First get an article
  const { data: articles } = await supabase
    .from('articles')
    .select('id')
    .limit(1);
  
  if (articles && articles.length > 0) {
    const testData = {
      test: true,
      timestamp: new Date().toISOString()
    };
    
    const { error: updateError } = await supabase
      .from('articles')
      .update({ image_metadata: testData })
      .eq('id', articles[0].id);
    
    if (updateError) {
      console.log('❌ Update error:', updateError.message);
      
      if (updateError.message.includes('schema cache')) {
        console.log('\n=== Schema Cache Issue Detected ===');
        console.log('This is a known Supabase issue. Here are your options:\n');
        
        console.log('QUICK FIX - Force Schema Refresh:');
        console.log('1. Make any small change to your table in Supabase Dashboard');
        console.log('2. For example, add a temporary column and then delete it');
        console.log('3. This forces Supabase to refresh its schema cache\n');
        
        console.log('ALTERNATIVE - Wait for Automatic Refresh:');
        console.log('- Supabase usually refreshes schema cache within 60 seconds');
        console.log('- Try again in a minute\n');
        
        console.log('WORKAROUND - Direct Table Editor:');
        console.log(`1. Go to: https://app.supabase.com/project/${supabaseUrl.split('.')[0].replace('https://', '')}/editor`);
        console.log('2. Select an article and manually add test data to image_metadata column');
        console.log('3. This often triggers a cache refresh');
      }
    } else {
      console.log('✅ Update successful!');
      
      // Read it back
      const { data: updated } = await supabase
        .from('articles')
        .select('id, image_metadata')
        .eq('id', articles[0].id)
        .single();
      
      console.log('Updated data:', updated);
    }
  }
  
  // Test 3: Check table structure via SQL
  console.log('\n=== Checking Table Structure ===');
  console.log('To verify the column exists in the database, run this SQL in Supabase:');
  console.log(`
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM 
    information_schema.columns 
WHERE 
    table_schema = 'public' 
    AND table_name = 'articles' 
    AND column_name = 'image_metadata';
  `);
  
  console.log('\nIf the column shows up in the SQL query but not in the API:');
  console.log('- It\'s definitely a schema cache issue');
  console.log('- Try restarting your Supabase project or wait for cache refresh');
}

// Run the tests
testAndFixImageMetadata().catch(console.error);