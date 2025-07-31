-- Add image_metadata column to store different image versions
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS image_metadata JSONB;

-- Add comment explaining the structure
COMMENT ON COLUMN articles.image_metadata IS 'Stores URLs for different image versions: {original, optimized, whatsapp}';