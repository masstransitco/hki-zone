-- Update the database function to include feed_slug in the return
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
  feed_slug TEXT,  -- Add this field
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
      f.base_slug,  -- Include base_slug
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
    fn.base_slug as feed_slug,  -- Return the feed slug
    
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
          i.content->'zh-TW'->>'title',
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
          i.content->'zh-TW'->>'body',
          i.content->'en'->>'body'
        )
    END as body,
    
    -- Get link
    COALESCE(
      i.content->p_language->>'link',
      i.content->'en'->>'link',
      i.content->'zh-TW'->>'link',
      i.content->'zh-CN'->>'link'
    ) as link,
    
    i.source_published_at,
    i.category,
    i.severity,
    i.relevance_score,
    
    -- Check if requested language content exists
    CASE 
      WHEN p_language = 'en' THEN (i.content->'en' IS NOT NULL)
      WHEN p_language = 'zh-TW' THEN (i.content->'zh-TW' IS NOT NULL)
      WHEN p_language = 'zh-CN' THEN (i.content->'zh-CN' IS NOT NULL)
    END as has_translation,
    
    -- Determine original language
    CASE 
      WHEN i.content->'en' IS NOT NULL AND i.content->'zh-TW' IS NULL AND i.content->'zh-CN' IS NULL THEN 'en'
      WHEN i.content->'zh-TW' IS NOT NULL AND i.content->'en' IS NULL THEN 'zh-TW'
      WHEN i.content->'zh-CN' IS NOT NULL AND i.content->'en' IS NULL THEN 'zh-CN'
      ELSE CASE 
        WHEN p_language = 'zh-TW' AND i.content->'zh-TW' IS NOT NULL THEN 'zh-TW'
        WHEN p_language = 'zh-CN' AND i.content->'zh-CN' IS NOT NULL THEN 'zh-CN'
        ELSE 'en'
      END
    END as original_language,
    
    i.enrichment_status
  FROM incidents_unified i
  JOIN feed_names fn ON fn.id = i.feed_id
  WHERE 
    (p_category IS NULL OR i.category = p_category)
    AND i.active = true
  ORDER BY i.source_published_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;