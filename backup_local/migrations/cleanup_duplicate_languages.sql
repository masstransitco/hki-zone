-- Cleanup script: Remove duplicate language versions before applying uniqueness constraint
-- This script identifies and removes duplicate enhanced articles, keeping the most recent version

-- Step 1: Identify duplicate language versions
WITH duplicate_groups AS (
  SELECT 
    original_article_id,
    language,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(id ORDER BY created_at DESC) as article_ids,
    ARRAY_AGG(title ORDER BY created_at DESC) as titles,
    ARRAY_AGG(created_at ORDER BY created_at DESC) as created_dates
  FROM articles
  WHERE original_article_id IS NOT NULL
    AND language IS NOT NULL
  GROUP BY original_article_id, language
  HAVING COUNT(*) > 1
)
SELECT 
  original_article_id,
  language,
  duplicate_count,
  article_ids[1] as keep_id,
  article_ids[2:] as delete_ids,
  titles[1] as keep_title,
  created_dates[1] as keep_date
FROM duplicate_groups
ORDER BY duplicate_count DESC;

-- Step 2: Create a backup table of articles to be deleted (for safety)
CREATE TABLE IF NOT EXISTS articles_duplicate_backup AS
SELECT a.* 
FROM articles a
JOIN (
  SELECT UNNEST(article_ids[2:]) as delete_id
  FROM (
    SELECT 
      original_article_id,
      language,
      ARRAY_AGG(id ORDER BY created_at DESC) as article_ids
    FROM articles
    WHERE original_article_id IS NOT NULL
      AND language IS NOT NULL
    GROUP BY original_article_id, language
    HAVING COUNT(*) > 1
  ) dup
) del ON a.id = del.delete_id;

-- Step 3: Delete duplicate articles (keeping the most recent one)
DELETE FROM articles
WHERE id IN (
  SELECT UNNEST(article_ids[2:])
  FROM (
    SELECT 
      original_article_id,
      language,
      ARRAY_AGG(id ORDER BY created_at DESC) as article_ids
    FROM articles
    WHERE original_article_id IS NOT NULL
      AND language IS NOT NULL
    GROUP BY original_article_id, language
    HAVING COUNT(*) > 1
  ) dup
);

-- Step 4: Verify no duplicates remain
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN 'SUCCESS: No duplicates remain. Safe to apply uniqueness constraint.'
    ELSE 'ERROR: ' || COUNT(*) || ' duplicate groups still exist!'
  END as status,
  COUNT(*) as remaining_duplicates
FROM (
  SELECT original_article_id, language
  FROM articles
  WHERE original_article_id IS NOT NULL
    AND language IS NOT NULL
  GROUP BY original_article_id, language
  HAVING COUNT(*) > 1
) remaining;

-- Step 5: Show summary of cleanup
SELECT 
  'Cleanup Summary' as report,
  (SELECT COUNT(*) FROM articles_duplicate_backup) as articles_deleted,
  (SELECT COUNT(DISTINCT original_article_id) FROM articles_duplicate_backup) as source_articles_affected,
  (SELECT COUNT(*) FROM articles WHERE original_article_id IS NOT NULL AND language IS NOT NULL) as remaining_enhanced_articles;