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

// Unfortunately, Supabase client doesn't support DDL operations directly
// We need to use their SQL editor or PostgreSQL connection

async function checkAndAddImageMetadata() {
  console.log('=== Adding image_metadata Column ===\n');
  
  // First, check if the column exists
  console.log('Checking if image_metadata column exists...');
  const { error: checkError } = await supabase
    .from('articles')
    .select('image_metadata')
    .limit(1);
  
  if (!checkError || !checkError.message.includes('column "image_metadata"')) {
    console.log('✅ Column image_metadata already exists!');
    
    // Test it
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, image_metadata')
      .limit(5);
    
    if (!error) {
      console.log('\nSample data:');
      data.forEach(article => {
        console.log(`- ${article.title.substring(0, 50)}...`);
        console.log(`  Metadata: ${JSON.stringify(article.image_metadata) || 'null'}`);
      });
    }
    return;
  }
  
  console.log('❌ Column image_metadata does not exist.');
  console.log('\n=== Manual Steps Required ===\n');
  
  // Since we can't run ALTER TABLE through Supabase client, provide instructions
  console.log('The Supabase JavaScript client cannot execute DDL statements like ALTER TABLE.');
  console.log('You need to add the column using one of these methods:\n');
  
  console.log('METHOD 1: Using Supabase Dashboard (Recommended)');
  console.log('------------------------------------------------');
  console.log('1. Go to your Supabase project dashboard');
  console.log(`2. Open the SQL Editor: https://app.supabase.com/project/${supabaseUrl.split('.')[0].replace('https://', '')}/sql/new`);
  console.log('3. Copy and paste this SQL:\n');
  
  const sql = `-- Add image_metadata column to store different image versions
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS image_metadata JSONB;

-- Add comment explaining the structure
COMMENT ON COLUMN articles.image_metadata IS 'Stores URLs for different image versions: {original, optimized, whatsapp}';

-- Verify it was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'articles' AND column_name = 'image_metadata';`;
  
  console.log(sql);
  console.log('\n4. Click "Run" button');
  console.log('5. You should see a success message\n');
  
  console.log('METHOD 2: Using Table Editor');
  console.log('----------------------------');
  console.log('1. Go to Table Editor in Supabase Dashboard');
  console.log('2. Select the "articles" table');
  console.log('3. Click "Add column" button');
  console.log('4. Set:');
  console.log('   - Name: image_metadata');
  console.log('   - Type: jsonb');
  console.log('   - Default value: (leave empty)');
  console.log('   - Nullable: Yes (checked)');
  console.log('5. Click "Save"\n');
  
  console.log('METHOD 3: Using psql (if you have PostgreSQL client)');
  console.log('---------------------------------------------------');
  console.log('If you have the database connection string:');
  console.log('psql $DATABASE_URL -c "ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_metadata JSONB;"');
  console.log('\n=== After Adding the Column ===\n');
  console.log('Once you\'ve added the column, the image optimization will work automatically.');
  console.log('Re-run this script to verify the column was added successfully.');
  
  // Also save the SQL to a file for convenience
  fs.writeFileSync('add-image-metadata-manual.sql', sql);
  console.log('\n✅ SQL saved to: add-image-metadata-manual.sql');
}

// Run the check
checkAndAddImageMetadata().catch(console.error);