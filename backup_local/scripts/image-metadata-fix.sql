-- Check if image_metadata column exists and add it if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'articles' 
        AND column_name = 'image_metadata'
    ) THEN
        ALTER TABLE articles ADD COLUMN image_metadata JSONB;
        RAISE NOTICE 'image_metadata column added successfully';
    ELSE
        RAISE NOTICE 'image_metadata column already exists';
    END IF;
END $$;

-- Add comment explaining the structure
COMMENT ON COLUMN articles.image_metadata IS 'Stores URLs for different image versions: {original, optimized, whatsapp}';

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM 
    information_schema.columns 
WHERE 
    table_name = 'articles' 
    AND column_name = 'image_metadata';