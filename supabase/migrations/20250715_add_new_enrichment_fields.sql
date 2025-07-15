-- Migration: Add new enrichment fields to incidents table
-- This migration adds the new fields needed for enhanced enrichment

-- Add new columns to incidents table
ALTER TABLE incidents 
ADD COLUMN IF NOT EXISTS additional_sources JSONB,
ADD COLUMN IF NOT EXISTS key_facts JSONB,
ADD COLUMN IF NOT EXISTS reporting_score INTEGER;

-- Rename ai_score to relevance_score if it exists
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'incidents' AND column_name = 'ai_score') THEN
        ALTER TABLE incidents RENAME COLUMN ai_score TO relevance_score;
    END IF;
END $$;

-- Add relevance_score column if it doesn't exist
ALTER TABLE incidents 
ADD COLUMN IF NOT EXISTS relevance_score INTEGER DEFAULT 0;

-- Drop dependent functions first
DROP FUNCTION IF EXISTS get_incidents_by_category(incident_category);
DROP FUNCTION IF EXISTS get_incidents_near_location(float, float, float);

-- Update materialized view to include new columns
DROP MATERIALIZED VIEW IF EXISTS incidents_public CASCADE;

CREATE MATERIALIZED VIEW incidents_public AS
SELECT
    id,
    source_slug,
    title,
    body,
    category,
    severity,
    ST_X(location)::numeric as longitude,
    ST_Y(location)::numeric as latitude,
    starts_at,
    source_updated_at,
    enrichment_status,
    relevance_score,
    enriched_title,
    enriched_summary,
    enriched_content,
    key_points,
    why_it_matters,
    image_url,
    sources,
    citations,
    additional_sources,
    key_facts,
    reporting_score,
    created_at,
    updated_at
FROM incidents
ORDER BY source_updated_at DESC;

-- Create unique index for materialized view
CREATE UNIQUE INDEX incidents_public_id_idx ON incidents_public(id);

-- Update indexes
DROP INDEX IF EXISTS idx_incidents_ai_score;
CREATE INDEX IF NOT EXISTS idx_incidents_relevance_score ON incidents(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_reporting_score ON incidents(reporting_score DESC);

-- Recreate the helper functions that depend on the materialized view
CREATE OR REPLACE FUNCTION get_incidents_by_category(cat incident_category)
RETURNS SETOF incidents_public AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM incidents_public
    WHERE category = cat
    ORDER BY source_updated_at DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_incidents_near_location(
    lat FLOAT,
    lng FLOAT,
    radius_km FLOAT DEFAULT 10
)
RETURNS SETOF incidents AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM incidents
    WHERE location IS NOT NULL
    AND ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
        radius_km * 1000
    )
    ORDER BY source_updated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Add comments for new columns
COMMENT ON COLUMN incidents.additional_sources IS 'Additional sources found during Perplexity research';
COMMENT ON COLUMN incidents.key_facts IS 'Key verified facts from enrichment process';
COMMENT ON COLUMN incidents.reporting_score IS 'Newsworthiness score (1-10) for reporting priority';
COMMENT ON COLUMN incidents.relevance_score IS 'Content-based relevance score (0-100)';