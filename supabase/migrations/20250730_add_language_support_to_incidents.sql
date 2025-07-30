-- Migration: Add language support to incidents table
-- Date: 2025-07-30
-- Purpose: Support multilingual government feeds (English, Traditional Chinese, Simplified Chinese)

-- Add language enum type
DO $$ BEGIN
    CREATE TYPE content_language AS ENUM ('en', 'zh-TW', 'zh-CN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add language columns to incidents table
ALTER TABLE incidents 
ADD COLUMN IF NOT EXISTS language content_language DEFAULT 'en',
ADD COLUMN IF NOT EXISTS title_zh_tw TEXT,
ADD COLUMN IF NOT EXISTS body_zh_tw TEXT,
ADD COLUMN IF NOT EXISTS title_zh_cn TEXT,
ADD COLUMN IF NOT EXISTS body_zh_cn TEXT;

-- Add language column to gov_feeds table
ALTER TABLE gov_feeds
ADD COLUMN IF NOT EXISTS language content_language DEFAULT 'en',
ADD COLUMN IF NOT EXISTS parent_feed_slug TEXT REFERENCES gov_feeds(slug);

-- Create index for language filtering
CREATE INDEX IF NOT EXISTS idx_incidents_language ON incidents(language);
CREATE INDEX IF NOT EXISTS idx_gov_feeds_language ON gov_feeds(language);
CREATE INDEX IF NOT EXISTS idx_gov_feeds_parent_feed ON gov_feeds(parent_feed_slug);

-- Update incidents table to use JSONB for multilingual content
ALTER TABLE incidents 
ADD COLUMN IF NOT EXISTS multilingual_content JSONB;

-- Add comment
COMMENT ON COLUMN incidents.multilingual_content IS 'Stores title and body in multiple languages: {en: {title, body}, zh_TW: {title, body}, zh_CN: {title, body}}';

-- Insert Chinese language feed configurations
INSERT INTO gov_feeds (slug, url, language, parent_feed_slug, active) VALUES
  -- Transport Department - Traditional Chinese
  ('td_notices_zh_tw', 'https://www.td.gov.hk/filemanager/rss/tc/traffic_notices.xml', 'zh-TW', 'td_notices', true),
  ('td_press_zh_tw', 'https://www.td.gov.hk/filemanager/rss/tc/press_release.xml', 'zh-TW', 'td_press', true),
  
  -- Transport Department - Simplified Chinese  
  ('td_notices_zh_cn', 'https://www.td.gov.hk/filemanager/rss/sc/traffic_notices.xml', 'zh-CN', 'td_notices', true),
  ('td_press_zh_cn', 'https://www.td.gov.hk/filemanager/rss/sc/press_release.xml', 'zh-CN', 'td_press', true),
  
  -- Hong Kong Observatory - Traditional Chinese
  ('hko_warn_zh_tw', 'https://rss.weather.gov.hk/rss/WeatherWarningSummaryv2_uc.xml', 'zh-TW', 'hko_warn', true),
  ('hko_eq_zh_tw', 'https://rss.weather.gov.hk/rss/QuickEarthquakeMessage_uc.xml', 'zh-TW', 'hko_eq', true),
  ('hko_felt_earthquake_zh_tw', 'https://rss.weather.gov.hk/rss/FeltEarthquake_uc.xml', 'zh-TW', 'hko_felt_earthquake', true),
  
  -- Hospital Authority A&E - Traditional Chinese
  ('ha_ae_waiting_zh_tw', 'https://www.ha.org.hk/opendata/aed/aedwtdata-tc.json', 'zh-TW', 'ha_ae_waiting', true),
  
  -- HKMA - Traditional Chinese
  ('hkma_press_zh_tw', 'https://www.hkma.gov.hk/chi/other-information/rss/rss_press-release.xml', 'zh-TW', 'hkma_press', true),
  ('hkma_speeches_zh_tw', 'https://www.hkma.gov.hk/chi/other-information/rss/rss_speeches.xml', 'zh-TW', 'hkma_speeches', true),
  ('hkma_guidelines_zh_tw', 'https://www.hkma.gov.hk/chi/other-information/rss/rss_guidelines.xml', 'zh-TW', 'hkma_guidelines', true),
  ('hkma_circulars_zh_tw', 'https://www.hkma.gov.hk/chi/other-information/rss/rss_circulars.xml', 'zh-TW', 'hkma_circulars', true)
ON CONFLICT (slug) DO UPDATE SET 
  url = EXCLUDED.url,
  language = EXCLUDED.language,
  parent_feed_slug = EXCLUDED.parent_feed_slug,
  active = EXCLUDED.active;

-- Create function to merge multilingual incidents
CREATE OR REPLACE FUNCTION merge_multilingual_incidents() RETURNS void AS $$
DECLARE
  parent_incident RECORD;
  child_incident RECORD;
BEGIN
  -- Find all English incidents that have matching Chinese versions
  FOR parent_incident IN 
    SELECT i.* FROM incidents i 
    JOIN gov_feeds gf ON i.source_slug = gf.slug 
    WHERE gf.language = 'en' 
    AND EXISTS (
      SELECT 1 FROM incidents ci 
      JOIN gov_feeds cgf ON ci.source_slug = cgf.slug 
      WHERE cgf.parent_feed_slug = gf.slug
    )
  LOOP
    -- Initialize multilingual content if not exists
    IF parent_incident.multilingual_content IS NULL THEN
      UPDATE incidents SET multilingual_content = jsonb_build_object(
        'en', jsonb_build_object('title', parent_incident.title, 'body', parent_incident.body)
      ) WHERE id = parent_incident.id;
    END IF;
    
    -- Find and merge Chinese versions
    FOR child_incident IN 
      SELECT ci.*, cgf.language FROM incidents ci
      JOIN gov_feeds cgf ON ci.source_slug = cgf.slug
      WHERE cgf.parent_feed_slug = (
        SELECT slug FROM gov_feeds WHERE slug = parent_incident.source_slug
      )
      AND ci.source_updated_at = parent_incident.source_updated_at
    LOOP
      -- Update parent with Chinese content
      UPDATE incidents SET 
        multilingual_content = multilingual_content || 
          jsonb_build_object(
            child_incident.language::text, 
            jsonb_build_object('title', child_incident.title, 'body', child_incident.body)
          )
      WHERE id = parent_incident.id;
      
      -- Remove the child incident to avoid duplicates
      DELETE FROM incidents WHERE id = child_incident.id;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Update the incidents_public materialized view to include language support
DROP MATERIALIZED VIEW IF EXISTS incidents_public;

CREATE MATERIALIZED VIEW incidents_public AS
SELECT 
    i.id,
    i.source_slug,
    i.title,
    i.body,
    i.title_zh_tw,
    i.body_zh_tw,
    i.title_zh_cn,
    i.body_zh_cn,
    i.multilingual_content,
    i.language,
    i.category,
    i.severity,
    i.relevance_score,
    i.starts_at,
    i.source_updated_at,
    i.enrichment_status,
    i.enriched_title,
    i.enriched_summary,
    i.enriched_content,
    i.key_points,
    i.why_it_matters,
    i.key_facts,
    i.reporting_score,
    i.additional_sources,
    i.sources,
    i.enrichment_metadata,
    i.created_at,
    i.updated_at,
    i.image_url,
    -- Extract longitude and latitude from PostGIS geometry
    CASE 
        WHEN i.location IS NOT NULL THEN ST_X(i.location)
        ELSE NULL
    END as longitude,
    CASE 
        WHEN i.location IS NOT NULL THEN ST_Y(i.location)
        ELSE NULL
    END as latitude,
    -- Add category-specific fields
    CASE 
        WHEN i.category = 'top_signals' THEN 'Priority'
        WHEN i.category = 'health' THEN 'Health Alert'
        WHEN i.category = 'environment' THEN 'Environment'
        WHEN i.category = 'financial' THEN 'Financial Update'
        WHEN i.category = 'administrative' THEN 'Administrative'
        WHEN i.category = 'gov' THEN 'Government News'
        WHEN i.category = 'ae' THEN 'A&E Waiting Times'
        WHEN i.category = 'road' THEN 'Traffic Update'
        WHEN i.category = 'rail' THEN 'Rail Service'
        WHEN i.category = 'weather' THEN 'Weather Alert'
        WHEN i.category = 'utility' THEN 'Utility Service'
        ELSE 'General Alert'
    END as category_display,
    -- Priority scoring
    CASE 
        WHEN i.category = 'top_signals' AND i.severity >= 5 THEN 95
        WHEN i.category = 'health' AND i.severity >= 7 THEN 100
        WHEN i.category = 'ae' AND i.severity >= 6 THEN 95
        WHEN i.category = 'weather' AND i.severity >= 6 THEN 90
        WHEN i.category = 'road' AND i.severity >= 5 THEN 80
        WHEN i.category = 'rail' AND i.severity >= 5 THEN 80
        WHEN i.category = 'financial' AND i.severity >= 6 THEN 70
        WHEN i.category = 'gov' AND i.severity >= 4 THEN 65
        WHEN i.category = 'administrative' AND i.severity >= 4 THEN 60
        WHEN i.category = 'environment' AND i.severity >= 5 THEN 75
        ELSE i.relevance_score
    END as display_priority
FROM incidents i
WHERE i.source_updated_at >= NOW() - INTERVAL '7 days'
ORDER BY i.source_updated_at DESC;

-- Create indexes for efficient querying
CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_public_id ON incidents_public(id);
CREATE INDEX IF NOT EXISTS idx_incidents_public_language ON incidents_public(language);
CREATE INDEX IF NOT EXISTS idx_incidents_public_category ON incidents_public(category);
CREATE INDEX IF NOT EXISTS idx_incidents_public_priority ON incidents_public(display_priority DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_public_source_updated_at ON incidents_public(source_updated_at DESC);

-- Function to get incidents by language preference
CREATE OR REPLACE FUNCTION get_incidents_by_language(
    user_language content_language DEFAULT 'en',
    p_category incident_category DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id TEXT,
    source_slug TEXT,
    title TEXT,
    body TEXT,
    category incident_category,
    severity INTEGER,
    relevance_score INTEGER,
    source_updated_at TIMESTAMPTZ,
    enrichment_status enrichment_status,
    display_priority INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.source_slug,
        -- Return title in user's language, fallback to English
        CASE 
            WHEN user_language = 'zh-TW' AND i.title_zh_tw IS NOT NULL THEN i.title_zh_tw
            WHEN user_language = 'zh-CN' AND i.title_zh_cn IS NOT NULL THEN i.title_zh_cn
            WHEN user_language = 'zh-TW' AND i.multilingual_content->>'zh_TW' IS NOT NULL THEN 
                (i.multilingual_content->'zh_TW'->>'title')::TEXT
            WHEN user_language = 'zh-CN' AND i.multilingual_content->>'zh_CN' IS NOT NULL THEN 
                (i.multilingual_content->'zh_CN'->>'title')::TEXT
            ELSE i.title
        END as title,
        -- Return body in user's language, fallback to English
        CASE 
            WHEN user_language = 'zh-TW' AND i.body_zh_tw IS NOT NULL THEN i.body_zh_tw
            WHEN user_language = 'zh-CN' AND i.body_zh_cn IS NOT NULL THEN i.body_zh_cn
            WHEN user_language = 'zh-TW' AND i.multilingual_content->>'zh_TW' IS NOT NULL THEN 
                (i.multilingual_content->'zh_TW'->>'body')::TEXT
            WHEN user_language = 'zh-CN' AND i.multilingual_content->>'zh_CN' IS NOT NULL THEN 
                (i.multilingual_content->'zh_CN'->>'body')::TEXT
            ELSE i.body
        END as body,
        i.category,
        i.severity,
        i.relevance_score,
        i.source_updated_at,
        i.enrichment_status,
        i.display_priority
    FROM incidents_public i
    WHERE (p_category IS NULL OR i.category = p_category)
    ORDER BY i.display_priority DESC, i.source_updated_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON COLUMN incidents.language IS 'Primary language of the incident content';
COMMENT ON COLUMN incidents.title_zh_tw IS 'Traditional Chinese title (deprecated, use multilingual_content)';
COMMENT ON COLUMN incidents.body_zh_tw IS 'Traditional Chinese body (deprecated, use multilingual_content)';
COMMENT ON COLUMN incidents.title_zh_cn IS 'Simplified Chinese title (deprecated, use multilingual_content)';
COMMENT ON COLUMN incidents.body_zh_cn IS 'Simplified Chinese body (deprecated, use multilingual_content)';
COMMENT ON COLUMN gov_feeds.language IS 'Language of the feed content';
COMMENT ON COLUMN gov_feeds.parent_feed_slug IS 'Reference to parent feed for language variants';
COMMENT ON FUNCTION get_incidents_by_language IS 'Retrieves incidents with content in the user preferred language';

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW incidents_public;