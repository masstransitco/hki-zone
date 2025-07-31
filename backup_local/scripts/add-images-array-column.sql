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