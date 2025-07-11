-- Add images column to articles_unified table and migrate existing car images

-- Step 1: Add the images column if it doesn't exist
ALTER TABLE articles_unified 
ADD COLUMN IF NOT EXISTS images JSONB;

-- Step 2: Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_articles_unified_images 
ON articles_unified((images IS NOT NULL));

-- Step 3: Update existing cars to have images array from their image_url
-- This converts single image_url to an array format
UPDATE articles_unified 
SET images = 
  CASE 
    WHEN image_url IS NOT NULL AND image_url != '' 
    THEN jsonb_build_array(image_url)
    ELSE '[]'::jsonb
  END
WHERE category = 'cars' 
  AND images IS NULL;

-- Step 4: Add some example multi-image data for testing
-- (Only runs if you have specific test cars)
UPDATE articles_unified 
SET images = '[
  "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&h=400&fit=crop",
  "https://images.unsplash.com/photo-1555626906-fcf10d6851b4?w=800&h=400&fit=crop",
  "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&h=400&fit=crop"
]'::jsonb
WHERE title LIKE '%BMW%' 
  AND category = 'cars'
  AND jsonb_array_length(images) <= 1
LIMIT 1;

-- Step 5: Verify the migration
SELECT 
  COUNT(*) as total_cars,
  COUNT(CASE WHEN images IS NOT NULL THEN 1 END) as cars_with_images,
  COUNT(CASE WHEN jsonb_array_length(images) > 1 THEN 1 END) as cars_with_multiple_images
FROM articles_unified
WHERE category = 'cars';

-- Step 6: Show a sample of cars with their image counts
SELECT 
  id,
  title,
  CASE 
    WHEN images IS NULL THEN 0
    ELSE jsonb_array_length(images)
  END as image_count,
  published_at
FROM articles_unified
WHERE category = 'cars'
ORDER BY published_at DESC
LIMIT 10;