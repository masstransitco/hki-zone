-- Investigate the specific duplicate case
-- Run this to understand the duplicate before cleanup

-- Find all articles for the problematic original_article_id
SELECT 
  id,
  title,
  language,
  language_variant,
  enhancement_metadata->>'language' as metadata_language,
  created_at,
  enhancement_metadata->>'trilingual_batch_id' as batch_id,
  enhancement_metadata->>'enhanced_at' as enhanced_at,
  url
FROM articles
WHERE original_article_id = 'c6fda19d-3104-4776-863c-9d74b30756d9'
ORDER BY created_at DESC;

-- Check if this is a pattern - find all duplicates
WITH language_duplicates AS (
  SELECT 
    original_article_id,
    language,
    COUNT(*) as dup_count,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created,
    ARRAY_AGG(id ORDER BY created_at DESC) as article_ids
  FROM articles
  WHERE original_article_id IS NOT NULL
    AND (language IS NOT NULL OR language_variant IS NOT NULL)
  GROUP BY original_article_id, language
  HAVING COUNT(*) > 1
)
SELECT 
  original_article_id,
  language,
  dup_count,
  first_created,
  last_created,
  last_created - first_created as time_span,
  article_ids
FROM language_duplicates
ORDER BY dup_count DESC, last_created DESC
LIMIT 20;

-- Analyze the pattern of duplicates
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_enhanced,
  COUNT(DISTINCT original_article_id) as unique_sources,
  COUNT(*) - COUNT(DISTINCT original_article_id) * 3 as potential_duplicates
FROM articles
WHERE is_ai_enhanced = true
  AND original_article_id IS NOT NULL
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 10;

-- Check if duplicates are from specific batches
WITH batch_analysis AS (
  SELECT 
    enhancement_metadata->>'trilingual_batch_id' as batch_id,
    COUNT(*) as articles_in_batch,
    COUNT(DISTINCT original_article_id) as unique_sources,
    COUNT(DISTINCT language) as languages,
    MIN(created_at) as batch_time
  FROM articles
  WHERE is_ai_enhanced = true
    AND original_article_id IS NOT NULL
    AND enhancement_metadata->>'trilingual_batch_id' IS NOT NULL
  GROUP BY enhancement_metadata->>'trilingual_batch_id'
)
SELECT *
FROM batch_analysis
WHERE articles_in_batch > 3 -- More than expected for trilingual
ORDER BY batch_time DESC
LIMIT 20;