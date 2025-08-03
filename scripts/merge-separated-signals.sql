-- Merge separated language signals for police and TD press feeds
-- Date: 2025-08-03

-- First, let's analyze the current state
WITH signal_analysis AS (
  SELECT 
    feed_group,
    CASE 
      WHEN feed_group = 'hkpf_press' THEN 
        regexp_replace(source_identifier, '.*refno=([^&]+).*', '\1')
      WHEN feed_group = 'td_press' THEN
        regexp_replace(source_identifier, '.*P(\d+).*', 'P\1')
      ELSE source_identifier
    END as base_id,
    source_identifier,
    content,
    created_at,
    updated_at
  FROM government_signals
  WHERE feed_group IN ('hkpf_press', 'td_press')
),
language_data AS (
  SELECT 
    sa.feed_group,
    sa.base_id,
    sa.source_identifier,
    jsonb_object_keys(sa.content->'languages') as lang
  FROM signal_analysis sa
)
SELECT 
  feed_group,
  base_id,
  COUNT(DISTINCT source_identifier) as signal_count,
  array_agg(DISTINCT lang) as languages
FROM language_data
GROUP BY feed_group, base_id
ORDER BY feed_group, base_id DESC
LIMIT 20;

-- The actual merge will be done in the next step after verifying the analysis