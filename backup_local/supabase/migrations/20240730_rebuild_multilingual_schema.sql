-- Clean rebuild of government feeds multilingual architecture
-- This migration creates a unified data model for proper content parity

-- First, create new unified feeds configuration table
CREATE TABLE IF NOT EXISTS gov_feeds_unified (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_slug TEXT NOT NULL UNIQUE, -- e.g., 'td_notices' without language suffix
  name_en TEXT NOT NULL,
  name_zh_tw TEXT,
  name_zh_cn TEXT,
  department TEXT NOT NULL, -- e.g., 'transport', 'health', 'monetary'
  feed_type TEXT NOT NULL, -- e.g., 'notices', 'press', 'warnings'
  
  -- Feed URLs for each language
  url_en TEXT,
  url_zh_tw TEXT,
  url_zh_cn TEXT,
  
  -- Feed metadata
  update_frequency TEXT DEFAULT '1 hour',
  active BOOLEAN DEFAULT true,
  
  -- Tracking
  last_fetch_en TIMESTAMPTZ,
  last_fetch_zh_tw TIMESTAMPTZ,
  last_fetch_zh_cn TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create new unified incidents table with proper multilingual support
CREATE TABLE IF NOT EXISTS incidents_unified (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source information
  feed_id UUID REFERENCES gov_feeds_unified(id),
  source_guid TEXT NOT NULL, -- Original RSS guid
  source_published_at TIMESTAMPTZ NOT NULL,
  
  -- Multilingual content stored in structured JSONB
  content JSONB NOT NULL DEFAULT '{}',
  /* Expected structure:
  {
    "en": {
      "title": "...",
      "body": "...",
      "link": "..."
    },
    "zh-TW": {
      "title": "...",
      "body": "...",
      "link": "..."
    },
    "zh-CN": {
      "title": "...",
      "body": "...",
      "link": "..."
    }
  }
  */
  
  -- Shared metadata
  category TEXT NOT NULL DEFAULT 'gov',
  severity INTEGER DEFAULT 3,
  relevance_score DECIMAL DEFAULT 0.5,
  
  -- Location data (if applicable)
  location JSONB DEFAULT '{}',
  
  -- Enrichment data (language-agnostic)
  enrichment_status TEXT DEFAULT 'pending',
  enriched_at TIMESTAMPTZ,
  enrichment_data JSONB DEFAULT '{}',
  
  -- Image (can be language-specific)
  images JSONB DEFAULT '{}',
  
  -- Deduplication
  content_hash TEXT NOT NULL, -- SHA256 of concatenated content
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  UNIQUE(feed_id, source_guid),
  UNIQUE(content_hash)
);

-- Create indexes for performance
CREATE INDEX idx_incidents_unified_published ON incidents_unified(source_published_at DESC);
CREATE INDEX idx_incidents_unified_feed ON incidents_unified(feed_id);
CREATE INDEX idx_incidents_unified_category ON incidents_unified(category);
CREATE INDEX idx_incidents_unified_enrichment ON incidents_unified(enrichment_status);

-- Create function to get incidents with language preference and fallback
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
    
    -- Detect original language (first available)
    CASE 
      WHEN i.content ? 'en' THEN 'en'
      WHEN i.content ? 'zh-TW' THEN 'zh-TW'
      WHEN i.content ? 'zh-CN' THEN 'zh-CN'
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

-- Populate unified feeds configuration from existing data
INSERT INTO gov_feeds_unified (base_slug, name_en, name_zh_tw, department, feed_type, url_en, url_zh_tw)
SELECT DISTINCT ON (base_slug)
  CASE 
    WHEN slug LIKE '%_zh_tw' THEN REPLACE(slug, '_zh_tw', '')
    WHEN slug LIKE '%_zh_cn' THEN REPLACE(slug, '_zh_cn', '')
    ELSE slug
  END as base_slug,
  
  -- English names
  CASE REPLACE(REPLACE(slug, '_zh_tw', ''), '_zh_cn', '')
    WHEN 'td_notices' THEN 'Transport Dept Traffic Notices'
    WHEN 'td_press' THEN 'Transport Dept Press Release'
    WHEN 'td_special' THEN 'Transport Dept Special Traffic News'
    WHEN 'chp_press' THEN 'Health Protection Centre Press'
    WHEN 'chp_disease' THEN 'Health Protection Centre Disease Watch'
    WHEN 'chp_guidelines' THEN 'Health Protection Centre Guidelines'
    WHEN 'chp_ncd' THEN 'Health Protection Centre NCD'
    WHEN 'hkma_press' THEN 'HKMA Press Release'
    WHEN 'hkma_circulars' THEN 'HKMA Circulars'
    WHEN 'hkma_guidelines' THEN 'HKMA Guidelines'
    WHEN 'hkma_speeches' THEN 'HKMA Speeches'
    WHEN 'hko_warn' THEN 'Observatory Weather Warning'
    WHEN 'hko_eq' THEN 'Observatory Earthquake Info'
    WHEN 'hko_felt_earthquake' THEN 'Observatory Felt Earthquake'
    WHEN 'news_gov_top' THEN 'Government News Top Stories'
    WHEN 'mtr_rail' THEN 'MTR Service Update'
    WHEN 'ha_ae_waiting' THEN 'HA A&E Waiting Times'
    ELSE slug
  END as name_en,
  
  -- Chinese names
  CASE REPLACE(REPLACE(slug, '_zh_tw', ''), '_zh_cn', '')
    WHEN 'td_notices' THEN '運輸署交通通告'
    WHEN 'td_press' THEN '運輸署新聞公報'
    WHEN 'td_special' THEN '運輸署特別交通消息'
    WHEN 'chp_press' THEN '衞生防護中心新聞公報'
    WHEN 'chp_disease' THEN '衞生防護中心疾病監測'
    WHEN 'chp_guidelines' THEN '衞生防護中心指引'
    WHEN 'chp_ncd' THEN '衞生防護中心非傳染病'
    WHEN 'hkma_press' THEN '金管局新聞稿'
    WHEN 'hkma_circulars' THEN '金管局通告'
    WHEN 'hkma_guidelines' THEN '金管局指引'
    WHEN 'hkma_speeches' THEN '金管局演辭'
    WHEN 'hko_warn' THEN '天文台天氣警告'
    WHEN 'hko_eq' THEN '天文台地震資訊'
    WHEN 'hko_felt_earthquake' THEN '天文台有感地震'
    WHEN 'news_gov_top' THEN '政府新聞網頭條'
    WHEN 'mtr_rail' THEN '港鐵服務消息'
    WHEN 'ha_ae_waiting' THEN '醫管局急症室輪候時間'
  END as name_zh_tw,
  
  -- Department categorization
  CASE 
    WHEN slug LIKE 'td_%' THEN 'transport'
    WHEN slug LIKE 'chp_%' THEN 'health'
    WHEN slug LIKE 'hkma_%' THEN 'monetary'
    WHEN slug LIKE 'hko_%' THEN 'observatory'
    WHEN slug LIKE 'news_gov%' THEN 'government'
    WHEN slug LIKE 'mtr_%' THEN 'transport'
    WHEN slug LIKE 'ha_%' THEN 'health'
    WHEN slug LIKE 'emsd_%' THEN 'utilities'
    ELSE 'government'
  END as department,
  
  -- Feed type
  CASE 
    WHEN slug LIKE '%_notices' THEN 'notices'
    WHEN slug LIKE '%_press' THEN 'press'
    WHEN slug LIKE '%_warn%' THEN 'warnings'
    WHEN slug LIKE '%_special' THEN 'special'
    WHEN slug LIKE '%_guidelines' THEN 'guidelines'
    ELSE 'general'
  END as feed_type,
  
  -- URLs
  MAX(CASE WHEN language = 'en' THEN url END) as url_en,
  MAX(CASE WHEN language = 'zh-TW' THEN url END) as url_zh_tw
  
FROM gov_feeds
WHERE active = true
GROUP BY base_slug, slug;

-- Add missing Chinese feed URLs (from our RSS testing)
UPDATE gov_feeds_unified SET 
  url_zh_tw = CASE base_slug
    WHEN 'td_notices' THEN 'https://www.td.gov.hk/tc/special_news/trafficnews_tc.xml'
    WHEN 'td_press' THEN 'https://www.td.gov.hk/tc/publications_and_press_releases/press_releases/press_tc.xml'
    WHEN 'chp_press' THEN 'https://www.chp.gov.hk/rss/pressrelease_tc_rss.xml'
    WHEN 'hkma_press' THEN 'https://www.hkma.gov.hk/chi/rss/press-releases.xml'
    WHEN 'hko_warn' THEN 'https://www.hko.gov.hk/textonly/chinese/rss/WeatherWarningBulletin_tc.xml'
    WHEN 'news_gov_top' THEN 'https://www.news.gov.hk/tc/common/html/topstories.rss.xml'
  END
WHERE base_slug IN ('td_notices', 'td_press', 'chp_press', 'hkma_press', 'hko_warn', 'news_gov_top')
  AND url_zh_tw IS NULL;

-- Add simplified Chinese URLs where available
UPDATE gov_feeds_unified SET 
  url_zh_cn = CASE base_slug
    WHEN 'td_notices' THEN 'https://www.td.gov.hk/sc/special_news/trafficnews_sc.xml'
    WHEN 'td_press' THEN 'https://www.td.gov.hk/sc/publications_and_press_releases/press_releases/press_sc.xml'
    WHEN 'chp_press' THEN 'https://www.chp.gov.hk/rss/pressrelease_sc_rss.xml'
    WHEN 'hkma_press' THEN 'https://www.hkma.gov.hk/sc/rss/press-releases.xml'
    WHEN 'hko_warn' THEN 'https://www.hko.gov.hk/textonly/sc/rss/WeatherWarningBulletin_sc.xml'
    WHEN 'news_gov_top' THEN 'https://www.news.gov.hk/sc/common/html/topstories.rss.xml'
  END
WHERE base_slug IN ('td_notices', 'td_press', 'chp_press', 'hkma_press', 'hko_warn', 'news_gov_top');

-- Create view for easy access to feed availability
CREATE OR REPLACE VIEW gov_feeds_language_coverage AS
SELECT 
  base_slug,
  name_en,
  name_zh_tw,
  department,
  feed_type,
  (url_en IS NOT NULL) as has_english,
  (url_zh_tw IS NOT NULL) as has_traditional_chinese,
  (url_zh_cn IS NOT NULL) as has_simplified_chinese,
  CASE 
    WHEN url_en IS NOT NULL AND url_zh_tw IS NOT NULL AND url_zh_cn IS NOT NULL THEN 'complete'
    WHEN url_en IS NOT NULL AND (url_zh_tw IS NOT NULL OR url_zh_cn IS NOT NULL) THEN 'partial'
    WHEN url_en IS NOT NULL AND url_zh_tw IS NULL AND url_zh_cn IS NULL THEN 'english_only'
    ELSE 'unknown'
  END as coverage_status
FROM gov_feeds_unified
WHERE active = true
ORDER BY department, feed_type, base_slug;

-- Create trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_gov_feeds_unified_updated_at 
  BEFORE UPDATE ON gov_feeds_unified 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incidents_unified_updated_at 
  BEFORE UPDATE ON incidents_unified 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE gov_feeds_unified IS 'Unified configuration for all government RSS feeds with multilingual support';
COMMENT ON TABLE incidents_unified IS 'Unified incident storage with proper multilingual content structure';
COMMENT ON FUNCTION get_incidents_with_language IS 'Retrieve incidents with language preference and automatic fallback';