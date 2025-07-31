-- Fix the get_incidents_with_language function to use correct JSONB syntax

DROP FUNCTION IF EXISTS get_incidents_with_language;

CREATE OR REPLACE FUNCTION get_incidents_with_language(
  p_language TEXT DEFAULT 'en',
  p_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  feed_id UUID,
  feed_name TEXT,
  title TEXT,
  body TEXT,
  link TEXT,
  source_published_at TIMESTAMPTZ,
  category TEXT,
  severity INTEGER,
  relevance_score DECIMAL,
  has_translation BOOLEAN,
  original_language TEXT,
  enrichment_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH feed_names AS (
    SELECT 
      f.id,
      CASE 
        WHEN p_language = 'zh-TW' THEN COALESCE(f.name_zh_tw, f.name_en)
        WHEN p_language = 'zh-CN' THEN COALESCE(f.name_zh_cn, f.name_zh_tw, f.name_en)
        ELSE f.name_en
      END as display_name
    FROM gov_feeds_unified f
  )
  SELECT 
    i.id,
    i.feed_id,
    fn.display_name as feed_name,
    
    -- Get title with fallback
    CASE 
      WHEN p_language = 'en' THEN 
        i.content->'en'->>'title'
      WHEN p_language = 'zh-TW' THEN 
        COALESCE(
          i.content->'zh-TW'->>'title',
          i.content->'zh-CN'->>'title',
          i.content->'en'->>'title'
        )
      WHEN p_language = 'zh-CN' THEN 
        COALESCE(
          i.content->'zh-CN'->>'title',
          i.content->'zh-TW'->>'title',  -- Will be converted in API
          i.content->'en'->>'title'
        )
    END as title,
    
    -- Get body with fallback
    CASE 
      WHEN p_language = 'en' THEN 
        i.content->'en'->>'body'
      WHEN p_language = 'zh-TW' THEN 
        COALESCE(
          i.content->'zh-TW'->>'body',
          i.content->'zh-CN'->>'body',
          i.content->'en'->>'body'
        )
      WHEN p_language = 'zh-CN' THEN 
        COALESCE(
          i.content->'zh-CN'->>'body',
          i.content->'zh-TW'->>'body',  -- Will be converted in API
          i.content->'en'->>'body'
        )
    END as body,
    
    -- Get link with fallback
    CASE 
      WHEN p_language = 'en' THEN 
        i.content->'en'->>'link'
      WHEN p_language = 'zh-TW' THEN 
        COALESCE(
          i.content->'zh-TW'->>'link',
          i.content->'zh-CN'->>'link',
          i.content->'en'->>'link'
        )
      WHEN p_language = 'zh-CN' THEN 
        COALESCE(
          i.content->'zh-CN'->>'link',
          i.content->'zh-TW'->>'link',
          i.content->'en'->>'link'
        )
    END as link,
    
    i.source_published_at,
    i.category,
    i.severity,
    i.relevance_score,
    
    -- Check if requested language is available
    CASE 
      WHEN p_language = 'en' THEN i.content ? 'en'
      WHEN p_language = 'zh-TW' THEN i.content ? 'zh-TW'
      WHEN p_language = 'zh-CN' THEN i.content ? 'zh-CN'
    END as has_translation,
    
    -- Detect actual content language for the returned result
    CASE 
      WHEN p_language = 'en' AND (i.content ? 'en') THEN 'en'
      WHEN p_language = 'zh-TW' AND (i.content ? 'zh-TW') THEN 'zh-TW'
      WHEN p_language = 'zh-TW' AND NOT (i.content ? 'zh-TW') AND (i.content ? 'zh-CN') THEN 'zh-CN'
      WHEN p_language = 'zh-CN' AND (i.content ? 'zh-CN') THEN 'zh-CN'
      WHEN p_language = 'zh-CN' AND NOT (i.content ? 'zh-CN') AND (i.content ? 'zh-TW') THEN 'zh-TW'
      ELSE CASE
        WHEN i.content ? 'en' THEN 'en'
        WHEN i.content ? 'zh-TW' THEN 'zh-TW'
        WHEN i.content ? 'zh-CN' THEN 'zh-CN'
      END
    END as original_language,
    
    i.enrichment_status
    
  FROM incidents_unified i
  JOIN feed_names fn ON fn.id = i.feed_id
  WHERE 
    -- Category filter
    (p_category IS NULL OR i.category = p_category)
    -- Only show from last 7 days
    AND i.source_published_at > NOW() - INTERVAL '7 days'
  ORDER BY 
    i.source_published_at DESC,
    i.relevance_score DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;