-- Analyze duplicate incidents
WITH incident_groups AS (
  SELECT 
    f.base_slug,
    i.source_published_at,
    COUNT(*) as variant_count,
    array_agg(DISTINCT 
      CASE 
        WHEN i.content ? 'en' THEN 'en'
        WHEN i.content ? 'zh-TW' THEN 'zh-TW'
        WHEN i.content ? 'zh-CN' THEN 'zh-CN'
      END
    ) as languages,
    array_agg(i.id) as incident_ids
  FROM incidents_unified i
  JOIN gov_feeds_unified f ON f.id = i.feed_id
  WHERE i.source_published_at > NOW() - INTERVAL '1 day'
  GROUP BY f.base_slug, i.source_published_at
  HAVING COUNT(*) > 1
)
SELECT * FROM incident_groups
ORDER BY source_published_at DESC
LIMIT 10;

-- Check a specific example
SELECT 
  id,
  content,
  source_guid,
  feed_id
FROM incidents_unified
WHERE source_published_at = (
  SELECT source_published_at 
  FROM incidents_unified 
  WHERE source_published_at > NOW() - INTERVAL '1 day'
  ORDER BY source_published_at DESC 
  LIMIT 1
);