-- Check TD feed configuration
SELECT 
  base_slug,
  name_en,
  url_en,
  url_zh_tw,
  url_zh_cn,
  active,
  last_fetch_en,
  last_fetch_zh_tw,
  last_fetch_zh_cn
FROM gov_feeds_unified
WHERE base_slug LIKE 'td_%'
ORDER BY base_slug;

-- Check if any TD incidents were stored
SELECT 
  f.base_slug,
  COUNT(i.id) as incident_count,
  MAX(i.source_published_at) as latest_incident
FROM gov_feeds_unified f
LEFT JOIN incidents_unified i ON i.feed_id = f.id
WHERE f.base_slug LIKE 'td_%'
GROUP BY f.base_slug;

-- Check recent incidents to see what feeds are present
SELECT 
  f.base_slug,
  COUNT(*) as count
FROM incidents_unified i
JOIN gov_feeds_unified f ON f.id = i.feed_id
WHERE i.source_published_at > NOW() - INTERVAL '1 day'
GROUP BY f.base_slug
ORDER BY count DESC;