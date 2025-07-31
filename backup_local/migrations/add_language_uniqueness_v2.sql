-- Migration v2: Add language column and uniqueness constraint (with duplicate handling)
-- Run cleanup_duplicate_languages.sql FIRST if you get duplicate key errors

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

-- Step 3: Check for any remaining duplicates before creating constraint
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT original_article_id, language
    FROM articles
    WHERE original_article_id IS NOT NULL
      AND language IS NOT NULL
    GROUP BY original_article_id, language
    HAVING COUNT(*) > 1
  ) dup;
  
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Cannot create unique constraint: % duplicate language versions exist. Run cleanup_duplicate_languages.sql first.', duplicate_count;
  END IF;
END $$;

-- Step 4: Create unique index to prevent duplicate language versions
-- This ensures each source article can only have one enhanced version per language
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_source_language 
ON articles (original_article_id, language) 
WHERE original_article_id IS NOT NULL;

-- Step 5: Add comment to explain the constraint
COMMENT ON INDEX idx_unique_source_language IS 
'Ensures each source article can only have one enhanced version per language. Prevents duplicate trilingual saves.';

-- Step 6: Create a view to monitor for any violations (should always return 0 rows)
CREATE OR REPLACE VIEW duplicate_language_monitor AS
SELECT 
  original_article_id,
  language,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(id ORDER BY created_at DESC) as duplicate_ids,
  ARRAY_AGG(title ORDER BY created_at DESC) as duplicate_titles,
  ARRAY_AGG(created_at ORDER BY created_at DESC) as created_dates
FROM articles
WHERE original_article_id IS NOT NULL
  AND language IS NOT NULL
GROUP BY original_article_id, language
HAVING COUNT(*) > 1;

-- Step 7: Add index on language for faster queries
CREATE INDEX IF NOT EXISTS idx_articles_language 
ON articles (language) 
WHERE is_ai_enhanced = true;

-- Step 8: Add index on trilingual_batch_id for batch queries
CREATE INDEX IF NOT EXISTS idx_articles_trilingual_batch 
ON articles (trilingual_batch_id) 
WHERE trilingual_batch_id IS NOT NULL;

-- Step 9: Create a view to analyze language distribution
CREATE OR REPLACE VIEW language_distribution AS
SELECT 
  language,
  COUNT(*) as article_count,
  COUNT(DISTINCT original_article_id) as unique_sources,
  MIN(created_at) as oldest_article,
  MAX(created_at) as newest_article
FROM articles
WHERE is_ai_enhanced = true
  AND language IS NOT NULL
GROUP BY language
ORDER BY article_count DESC;

-- Step 10: Verification queries
SELECT 'Constraint Status' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE indexname = 'idx_unique_source_language'
    ) THEN 'SUCCESS: Unique constraint created'
    ELSE 'ERROR: Constraint not created'
  END as status;

SELECT 'Duplicate Check' as check_type,
  CASE 
    WHEN COUNT(*) = 0 THEN 'SUCCESS: No duplicate language versions'
    ELSE 'ERROR: ' || COUNT(*) || ' duplicates found'
  END as status
FROM duplicate_language_monitor;

SELECT 'Language Distribution' as check_type,
  language,
  article_count
FROM language_distribution;