-- Fix for enhancement cron job timeout issue
-- Issue: Database query timeout (error code 57014) when selecting articles for enhancement
-- Root cause: Sorting by JSONB fields without indexes
-- Solution: Create indexes on selection and JSONB expression fields

-- Index for filtering selected articles
CREATE INDEX IF NOT EXISTS idx_articles_selection_enhancement
ON articles(selected_for_enhancement, is_ai_enhanced)
WHERE selected_for_enhancement = true AND is_ai_enhanced = false;

-- Index for sorting by priority score (JSONB expression)
CREATE INDEX IF NOT EXISTS idx_articles_priority_score
ON articles(((selection_metadata->>'priority_score')::int))
WHERE selected_for_enhancement = true;

-- Index for sorting by selection timestamp (JSONB expression)
CREATE INDEX IF NOT EXISTS idx_articles_selected_at
ON articles((selection_metadata->>'selected_at'))
WHERE selected_for_enhancement = true;

-- Verify indexes were created
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'articles'
  AND indexname LIKE 'idx_articles_%'
ORDER BY indexname;
