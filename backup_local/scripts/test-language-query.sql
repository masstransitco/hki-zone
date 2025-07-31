-- Test what's happening with language queries

-- Check incidents with multilingual content
SELECT 
  id,
  feed_id,
  content,
  source_published_at
FROM incidents_unified
WHERE feed_id IN (
  SELECT id FROM gov_feeds_unified WHERE base_slug = 'hko_warn'
)
ORDER BY source_published_at DESC
LIMIT 5;

-- Test the function with English
SELECT * FROM get_incidents_with_language('en', NULL, 5, 0);

-- Check how content is structured
SELECT 
  id,
  jsonb_pretty(content) as content_structure
FROM incidents_unified
WHERE content IS NOT NULL
LIMIT 2;