-- Migration: Add language column and uniqueness constraint to prevent duplicate language versions
-- This ensures each source article can only have one enhanced version per language

-- Step 1: Add language column if it doesn't exist
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS language TEXT 
CHECK (language IN ('en', 'zh-TW', 'zh-CN'));

-- Step 2: Populate language column from existing data
-- For existing enhanced articles, extract language from enhancement_metadata
UPDATE articles 
SET language = enhancement_metadata->>'language'
WHERE is_ai_enhanced = true 
  AND language IS NULL
  AND enhancement_metadata->>'language' IS NOT NULL;

-- For existing enhanced articles where language is in language_variant
UPDATE articles 
SET language = language_variant
WHERE is_ai_enhanced = true 
  AND language IS NULL
  AND language_variant IS NOT NULL;

-- Step 3: Create unique index to prevent duplicate language versions
-- This ensures each source article can only have one enhanced version per language
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_source_language 
ON articles (original_article_id, language) 
WHERE original_article_id IS NOT NULL;

-- Step 4: Add comment to explain the constraint
COMMENT ON INDEX idx_unique_source_language IS 
'Ensures each source article can only have one enhanced version per language. Prevents duplicate trilingual saves.';

-- Step 5: Create a view to monitor for any violations (should always return 0 rows)
CREATE OR REPLACE VIEW duplicate_language_monitor AS
SELECT 
  original_article_id,
  language,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(id) as duplicate_ids,
  ARRAY_AGG(title) as duplicate_titles
FROM articles
WHERE original_article_id IS NOT NULL
  AND language IS NOT NULL
GROUP BY original_article_id, language
HAVING COUNT(*) > 1;

-- Step 6: Add index on language for faster queries
CREATE INDEX IF NOT EXISTS idx_articles_language 
ON articles (language) 
WHERE is_ai_enhanced = true;

-- Step 7: Add index on trilingual_batch_id for batch queries
CREATE INDEX IF NOT EXISTS idx_articles_trilingual_batch 
ON articles (trilingual_batch_id) 
WHERE trilingual_batch_id IS NOT NULL;

-- Verification query (run after migration)
-- Should return 0 if no duplicates exist
SELECT COUNT(*) as duplicate_language_versions
FROM duplicate_language_monitor;