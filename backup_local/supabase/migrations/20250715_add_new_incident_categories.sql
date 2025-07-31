-- Migration: Add new incident categories for expanded government feeds
-- Date: 2025-07-15
-- Purpose: Extend the incident_category enum to support health, financial, and administrative feeds

-- Add new categories to the incident_category enum
ALTER TYPE incident_category ADD VALUE 'health';
ALTER TYPE incident_category ADD VALUE 'financial';
ALTER TYPE incident_category ADD VALUE 'administrative';

-- Insert new feed configurations for the successfully tested feeds
INSERT INTO gov_feeds (slug, url, active) VALUES 
  -- Health feeds (Centre for Health Protection)
  ('chp_press', 'https://www.chp.gov.hk/rss/pressreleases_en_RSS.xml', true),
  ('chp_disease', 'https://www.chp.gov.hk/rss/cdwatch_en_RSS.xml', true),
  ('chp_ncd', 'https://www.chp.gov.hk/rss/ncdaware_en_RSS.xml', true),
  ('chp_guidelines', 'https://www.chp.gov.hk/rss/guidelines_en_RSS.xml', true),
  
  -- Hospital A&E waiting times (JSON API)
  ('ha_ae_waiting', 'https://www.ha.org.hk/opendata/aed/aedwtdata-en.json', true),
  
  -- Financial feeds (Hong Kong Monetary Authority)
  ('hkma_press', 'https://www.hkma.gov.hk/eng/other-information/rss/rss_press-release.xml', true),
  ('hkma_speeches', 'https://www.hkma.gov.hk/eng/other-information/rss/rss_speeches.xml', true),
  ('hkma_guidelines', 'https://www.hkma.gov.hk/eng/other-information/rss/rss_guidelines.xml', true),
  ('hkma_circulars', 'https://www.hkma.gov.hk/eng/other-information/rss/rss_circulars.xml', true),
  
  -- Administrative feeds (Government news)
  ('news_gov_top', 'https://www.news.gov.hk/rss/news/topstories_en.xml', true)
ON CONFLICT (slug) DO UPDATE SET 
  url = EXCLUDED.url,
  active = EXCLUDED.active,
  updated_at = NOW();

-- Update the incidents_public materialized view to include new categories
DROP MATERIALIZED VIEW IF EXISTS incidents_public;

CREATE MATERIALIZED VIEW incidents_public AS
SELECT 
    i.id,
    i.source_slug,
    i.title,
    i.body,
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
        WHEN i.category = 'health' THEN 'Health Alert'
        WHEN i.category = 'financial' THEN 'Financial Update'
        WHEN i.category = 'administrative' THEN 'Government News'
        WHEN i.category = 'road' THEN 'Traffic Update'
        WHEN i.category = 'rail' THEN 'Rail Service'
        WHEN i.category = 'weather' THEN 'Weather Alert'
        WHEN i.category = 'utility' THEN 'Utility Service'
        ELSE 'General Alert'
    END as category_display,
    -- Add priority scoring based on category and severity
    CASE 
        WHEN i.category = 'health' AND i.severity >= 7 THEN 100
        WHEN i.category = 'weather' AND i.severity >= 6 THEN 90
        WHEN i.category = 'road' AND i.severity >= 5 THEN 80
        WHEN i.category = 'rail' AND i.severity >= 5 THEN 80
        WHEN i.category = 'financial' AND i.severity >= 6 THEN 70
        WHEN i.category = 'administrative' AND i.severity >= 4 THEN 60
        ELSE i.relevance_score
    END as display_priority
FROM incidents i
WHERE i.source_updated_at >= NOW() - INTERVAL '7 days'  -- Only show recent incidents
ORDER BY i.source_updated_at DESC;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_incidents_public_category ON incidents_public (category);
CREATE INDEX IF NOT EXISTS idx_incidents_public_priority ON incidents_public (display_priority DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_public_created_at ON incidents_public (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_public_source_updated_at ON incidents_public (source_updated_at DESC);

-- Add comments for documentation
COMMENT ON MATERIALIZED VIEW incidents_public IS 'Public view of incidents with geographic coordinates extracted and category-specific display logic';
COMMENT ON COLUMN incidents_public.category_display IS 'Human-readable category name for UI display';
COMMENT ON COLUMN incidents_public.display_priority IS 'Calculated priority score based on category and severity for ordering';

-- Create a function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_incidents_public_view()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW incidents_public;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically refresh the view when incidents are updated
CREATE OR REPLACE FUNCTION trigger_refresh_incidents_public()
RETURNS trigger AS $$
BEGIN
    -- Refresh the materialized view in a background job to avoid blocking
    PERFORM pg_notify('refresh_incidents_view', '');
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (if it doesn't exist)
DROP TRIGGER IF EXISTS trigger_incidents_refresh ON incidents;
CREATE TRIGGER trigger_incidents_refresh
    AFTER INSERT OR UPDATE OR DELETE ON incidents
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_refresh_incidents_public();

-- Add category-specific scoring functions
CREATE OR REPLACE FUNCTION calculate_health_severity(title text, description text)
RETURNS integer AS $$
BEGIN
    -- High severity health alerts (8-10)
    IF title ~* 'outbreak|epidemic|pandemic|emergency|critical|urgent|death|fatal' THEN
        RETURN 9;
    END IF;
    
    -- Medium severity health alerts (5-7)
    IF title ~* 'alert|warning|infection|disease|virus|bacteria|contamination' THEN
        RETURN 6;
    END IF;
    
    -- Low severity health updates (2-4)
    IF title ~* 'guideline|recommendation|update|notice|information' THEN
        RETURN 3;
    END IF;
    
    -- Default health severity
    RETURN 4;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_financial_severity(title text, description text)
RETURNS integer AS $$
BEGIN
    -- High severity financial alerts (7-9)
    IF title ~* 'emergency|crisis|urgent|critical|suspension|halt|frozen|fraud' THEN
        RETURN 8;
    END IF;
    
    -- Medium severity financial updates (4-6)
    IF title ~* 'alert|warning|change|update|circular|guideline|policy' THEN
        RETURN 5;
    END IF;
    
    -- Low severity financial information (1-3)
    IF title ~* 'statement|report|statistics|publication|research|speech' THEN
        RETURN 2;
    END IF;
    
    -- Default financial severity
    RETURN 3;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_administrative_severity(title text, description text)
RETURNS integer AS $$
BEGIN
    -- High severity administrative alerts (6-8)
    IF title ~* 'emergency|urgent|critical|closure|suspension|cancelled|alert' THEN
        RETURN 7;
    END IF;
    
    -- Medium severity administrative updates (3-5)
    IF title ~* 'change|update|notice|announcement|policy|regulation' THEN
        RETURN 4;
    END IF;
    
    -- Low severity administrative information (1-2)
    IF title ~* 'meeting|visit|ceremony|speech|statement|report' THEN
        RETURN 2;
    END IF;
    
    -- Default administrative severity
    RETURN 3;
END;
$$ LANGUAGE plpgsql;

-- Add comments for the new functions
COMMENT ON FUNCTION calculate_health_severity(text, text) IS 'Calculate severity score for health-related incidents based on keywords';
COMMENT ON FUNCTION calculate_financial_severity(text, text) IS 'Calculate severity score for financial incidents based on keywords';
COMMENT ON FUNCTION calculate_administrative_severity(text, text) IS 'Calculate severity score for administrative incidents based on keywords';

-- Update the existing gov_feeds table to ensure all feeds are properly configured
UPDATE gov_feeds SET active = true WHERE slug IN (
    'td_notices', 'td_press', 'hko_warn', 'hko_eq', 'hko_felt_eq'
);

-- Add metadata about the new feed types
INSERT INTO gov_feeds (slug, url, active, created_at, updated_at) VALUES
    ('feed_metadata_health', 'https://metadata.health.feeds', false, NOW(), NOW()),
    ('feed_metadata_financial', 'https://metadata.financial.feeds', false, NOW(), NOW()),
    ('feed_metadata_administrative', 'https://metadata.administrative.feeds', false, NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

-- Create a view for feed statistics
CREATE OR REPLACE VIEW feed_statistics AS
SELECT 
    gf.slug,
    gf.url,
    gf.active,
    gf.last_seen_pubdate,
    COUNT(i.id) as total_incidents,
    COUNT(CASE WHEN i.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as incidents_last_24h,
    COUNT(CASE WHEN i.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as incidents_last_7d,
    COUNT(CASE WHEN i.enrichment_status = 'enriched' THEN 1 END) as enriched_incidents,
    AVG(i.severity) as avg_severity,
    AVG(i.relevance_score) as avg_relevance_score,
    MAX(i.created_at) as last_incident_created,
    -- Extract category from incidents
    CASE 
        WHEN COUNT(i.id) > 0 THEN 
            (SELECT category FROM incidents WHERE source_slug = gf.slug LIMIT 1)
        ELSE NULL
    END as category
FROM gov_feeds gf
LEFT JOIN incidents i ON i.source_slug = gf.slug
GROUP BY gf.slug, gf.url, gf.active, gf.last_seen_pubdate
ORDER BY gf.active DESC, total_incidents DESC;

COMMENT ON VIEW feed_statistics IS 'Statistics and monitoring data for all government feeds';

-- Refresh the materialized view to include new data
REFRESH MATERIALIZED VIEW incidents_public;