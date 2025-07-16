-- Fix environment category issues
-- 1. Update existing CHP incidents to use environment category
UPDATE incidents 
SET category = 'environment'
WHERE source_slug LIKE 'chp_%' AND category != 'environment';

-- 2. Update materialized view to include incidents from last 30 days instead of 7 days
DROP MATERIALIZED VIEW IF EXISTS incidents_public CASCADE;

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
    -- Add category-specific fields (only using confirmed enum values)
    CASE 
        WHEN i.category = 'top_signals' THEN 'Top Signals'
        WHEN i.category = 'environment' THEN 'Environment'
        WHEN i.category = 'road' THEN 'Traffic Update'
        WHEN i.category = 'rail' THEN 'Rail Service'
        WHEN i.category = 'weather' THEN 'Weather Alert'
        WHEN i.category = 'utility' THEN 'Utility Service'
        ELSE 'General Alert'
    END as category_display,
    -- Add priority scoring based on category and severity (only using confirmed enum values)
    CASE 
        WHEN i.category = 'top_signals' AND i.severity >= 6 THEN 120
        WHEN i.category = 'environment' AND i.severity >= 7 THEN 110
        WHEN i.category = 'weather' AND i.severity >= 6 THEN 90
        WHEN i.category = 'road' AND i.severity >= 5 THEN 80
        WHEN i.category = 'rail' AND i.severity >= 5 THEN 80
        ELSE i.relevance_score
    END as display_priority
FROM incidents i
WHERE i.source_updated_at >= NOW() - INTERVAL '30 days'  -- Extended to 30 days to include more incidents
ORDER BY i.source_updated_at DESC;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_incidents_public_category ON incidents_public (category);
CREATE INDEX IF NOT EXISTS idx_incidents_public_priority ON incidents_public (display_priority DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_public_created_at ON incidents_public (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_public_source_updated_at ON incidents_public (source_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_public_top_signals ON incidents_public (category) WHERE category = 'top_signals';
CREATE INDEX IF NOT EXISTS idx_incidents_public_environment ON incidents_public (category) WHERE category = 'environment';

-- Recreate the function
CREATE OR REPLACE FUNCTION get_incidents_by_category(category_filter incident_category)
RETURNS TABLE(
    id text,
    source_slug text,
    title text,
    body text,
    category incident_category,
    severity integer,
    relevance_score numeric,
    starts_at timestamp with time zone,
    source_updated_at timestamp with time zone,
    enrichment_status text,
    enriched_title text,
    enriched_summary text,
    enriched_content text,
    key_points text[],
    why_it_matters text,
    key_facts text[],
    reporting_score numeric,
    additional_sources text[],
    sources jsonb,
    enrichment_metadata jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    image_url text,
    longitude numeric,
    latitude numeric,
    category_display text,
    display_priority numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM incidents_public
    WHERE incidents_public.category = category_filter
    ORDER BY incidents_public.display_priority DESC, incidents_public.source_updated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW incidents_public;

-- Show results
SELECT 
    source_slug,
    category,
    COUNT(*) as count,
    MAX(source_updated_at) as latest_update
FROM incidents_public
WHERE source_slug LIKE 'chp_%'
GROUP BY source_slug, category
ORDER BY source_slug, category;