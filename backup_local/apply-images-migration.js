// Script to apply the images column migration
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyImagesMigration() {
  console.log('🔧 Applying images column migration...\n');
  
  try {
    // Check if column already exists
    const { data: testData, error: testError } = await supabase
      .from('articles_unified')
      .select('images')
      .limit(1);
    
    if (!testError || !testError.message.includes('column "images" does not exist')) {
      console.log('✅ Images column already exists!');
      
      // Check if any cars have images arrays
      const { data: cars, error: carsError } = await supabase
        .from('articles_unified')
        .select('id, title, images')
        .eq('category', 'cars')
        .not('images', 'is', null)
        .limit(5);
      
      if (cars && cars.length > 0) {
        console.log(`\n✅ Found ${cars.length} cars with images arrays`);
        cars.forEach(car => {
          console.log(`- ${car.title}: ${Array.isArray(car.images) ? car.images.length : 0} images`);
        });
      } else {
        console.log('\n⚠️  No cars have images arrays yet');
        console.log('Run the car scraper to populate them: npm run scrape:cars');
      }
      
      return;
    }
    
    console.log('❌ Images column does not exist. Cannot apply migration via JavaScript.');
    console.log('\nYou need to run this SQL directly in your Supabase dashboard:');
    console.log('\n--- START SQL ---');
    console.log(`
-- Add images array column to articles_unified table for storing multiple car images

-- Add the images column as JSONB array
ALTER TABLE articles_unified 
ADD COLUMN IF NOT EXISTS images JSONB;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_articles_unified_images 
ON articles_unified((images IS NOT NULL));

-- Update existing cars to use images array from image_url
UPDATE articles_unified 
SET images = jsonb_build_array(image_url)
WHERE category = 'cars' 
  AND image_url IS NOT NULL 
  AND images IS NULL;

-- Add comment
COMMENT ON COLUMN articles_unified.images IS 'Array of image URLs, primarily used for car listings with multiple photos';
`);
    console.log('--- END SQL ---\n');
    console.log('Steps to apply:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to the SQL Editor');
    console.log('3. Paste and run the SQL above');
    console.log('4. Then re-run the car scraper to populate images');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the migration check
applyImagesMigration();