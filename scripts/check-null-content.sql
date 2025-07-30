-- Check for incidents with null English content
SELECT 
  i.id,
  f.base_slug,
  i.content->'en'->>'title' as en_title,
  i.content->'zh-TW'->>'title' as zh_tw_title,
  i.content->'zh-CN'->>'title' as zh_cn_title,
  i.source_published_at
FROM incidents_unified i
JOIN gov_feeds_unified f ON f.id = i.feed_id
WHERE 
  (i.content->'en'->>'title' IS NULL OR i.content->'en'->>'title' = '')
  AND i.source_published_at > NOW() - INTERVAL '1 day'
ORDER BY i.source_published_at DESC
LIMIT 10;