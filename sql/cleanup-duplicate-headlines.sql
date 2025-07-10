-- SQL Script to clean up duplicate fallback headlines
-- This script removes duplicate articles keeping only the most recent of each title

-- First, let's see what we're dealing with
SELECT 
    title,
    source,
    COUNT(*) as duplicate_count,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM articles_unified
WHERE article_type = 'ai_generated'
    AND source = 'Perplexity AI (Fallback)'
GROUP BY title, source
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- Create a backup of what we're about to delete (optional)
-- CREATE TABLE articles_unified_backup AS 
-- SELECT * FROM articles_unified 
-- WHERE source = 'Perplexity AI (Fallback)';

-- Delete duplicate fallback articles, keeping only the most recent of each title
DELETE FROM articles_unified
WHERE id IN (
    SELECT id FROM (
        SELECT 
            id,
            title,
            ROW_NUMBER() OVER (
                PARTITION BY title 
                ORDER BY created_at DESC, id DESC
            ) as row_num
        FROM articles_unified
        WHERE source = 'Perplexity AI (Fallback)'
            AND article_type = 'ai_generated'
    ) duplicates
    WHERE row_num > 1
);

-- Verify the cleanup
SELECT 
    'After cleanup - Remaining fallback articles:' as status,
    COUNT(*) as count
FROM articles_unified
WHERE source = 'Perplexity AI (Fallback)';

-- Check if any duplicates remain
SELECT 
    'After cleanup - Duplicate check:' as status,
    title,
    COUNT(*) as count
FROM articles_unified
WHERE article_type = 'ai_generated'
GROUP BY title
HAVING COUNT(*) > 1;

-- Optional: Delete ALL fallback articles if you want a clean slate
-- WARNING: This will remove all fallback-generated content
-- DELETE FROM articles_unified WHERE source = 'Perplexity AI (Fallback)';

-- Show summary of remaining AI-generated articles
SELECT 
    source,
    COUNT(*) as article_count,
    MIN(created_at) as oldest_article,
    MAX(created_at) as newest_article
FROM articles_unified
WHERE article_type = 'ai_generated'
GROUP BY source
ORDER BY COUNT(*) DESC;