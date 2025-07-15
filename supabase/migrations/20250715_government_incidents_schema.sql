-- Migration: Create government incidents and feeds tables
-- This migration creates the infrastructure for government incident monitoring

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create enum types for incident categorization
DO $$ BEGIN
    CREATE TYPE incident_category AS ENUM ('road', 'rail', 'weather', 'utility');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enrichment_status AS ENUM ('pending', 'enriched', 'ready', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create government feeds catalog table
CREATE TABLE IF NOT EXISTS gov_feeds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,        -- 'td_special', 'mtr_rail', etc.
    url TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    last_seen_pubdate TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the 7 curated government feeds
INSERT INTO gov_feeds (slug, url) VALUES
    ('td_special', 'https://static.data.gov.hk/td/special-traffic-news/en/1.xml'),
    ('td_notices', 'https://www.td.gov.hk/filemanager/rss/en/traffic_notices.xml'),
    ('td_press', 'https://www.td.gov.hk/filemanager/rss/en/press_release.xml'),
    ('mtr_rail', 'https://alert.mtr.com.hk/rss/rail_en.xml'),
    ('hko_warn', 'https://rss.weather.gov.hk/rss/WeatherWarningSummaryv2.xml'),
    ('hko_eq', 'https://rss.weather.gov.hk/rss/QuickEarthquake.xml'),
    ('emsd_util', 'https://www.emsd.gov.hk/en/rss/electricity_incidents.xml')
ON CONFLICT (slug) DO NOTHING;

-- Create incidents table for storing government incident data
CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,              -- e.g. 'td_20250715_00123'
    source_slug TEXT NOT NULL REFERENCES gov_feeds(slug) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT,
    category incident_category NOT NULL,
    severity INTEGER DEFAULT 0,
    location GEOMETRY(Point, 4326),   -- PostGIS geometry for location
    starts_at TIMESTAMPTZ,
    source_updated_at TIMESTAMPTZ NOT NULL,
    
    -- Enrichment fields
    enrichment_status enrichment_status DEFAULT 'pending',
    relevance_score INTEGER DEFAULT 0,
    enriched_title TEXT,
    enriched_summary TEXT,
    enriched_content TEXT,
    key_points JSONB,
    why_it_matters TEXT,
    image_url TEXT,
    image_prompt TEXT,
    
    -- New enrichment fields
    additional_sources JSONB,          -- Additional sources from Perplexity research
    key_facts JSONB,                   -- 2-3 key facts from enrichment
    reporting_score INTEGER,           -- Score 1-10 for reporting worthiness
    
    -- Metadata
    sources JSONB,
    citations JSONB,
    enrichment_metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_incidents_source_slug ON incidents(source_slug);
CREATE INDEX idx_incidents_category ON incidents(category);
CREATE INDEX idx_incidents_severity ON incidents(severity DESC);
CREATE INDEX idx_incidents_source_updated_at ON incidents(source_updated_at DESC);
CREATE INDEX idx_incidents_enrichment_status ON incidents(enrichment_status);
CREATE INDEX idx_incidents_relevance_score ON incidents(relevance_score DESC);
CREATE INDEX idx_incidents_location ON incidents USING GIST(location);
CREATE INDEX idx_incidents_starts_at ON incidents(starts_at DESC);

-- Create materialized view for public API access
CREATE MATERIALIZED VIEW IF NOT EXISTS incidents_public AS
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

-- Create updated_at trigger for incidents table
CREATE TRIGGER update_incidents_updated_at 
    BEFORE UPDATE ON incidents
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create updated_at trigger for gov_feeds table
CREATE TRIGGER update_gov_feeds_updated_at 
    BEFORE UPDATE ON gov_feeds
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE gov_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- Policy for public read access to active feeds
CREATE POLICY "Public can read active gov feeds" ON gov_feeds
    FOR SELECT
    USING (active = true);

-- Policy for service role to manage all feeds
CREATE POLICY "Service role can manage all gov feeds" ON gov_feeds
    FOR ALL
    USING (auth.role() = 'service_role');

-- Policy for public read access to incidents
CREATE POLICY "Public can read incidents" ON incidents
    FOR SELECT
    USING (true);

-- Policy for service role to manage all incidents
CREATE POLICY "Service role can manage all incidents" ON incidents
    FOR ALL
    USING (auth.role() = 'service_role');

-- Helper function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_incidents_public()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY incidents_public;
END;
$$ LANGUAGE plpgsql;

-- Helper function to get incidents by category
CREATE OR REPLACE FUNCTION get_incidents_by_category(cat incident_category)
RETURNS SETOF incidents_public AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM incidents_public
    WHERE category = cat
    ORDER BY source_updated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Helper function to get incidents within a geographic area
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

-- Helper function to update incident enrichment
CREATE OR REPLACE FUNCTION update_incident_enrichment(
    incident_id TEXT,
    new_enriched_title TEXT DEFAULT NULL,
    new_enriched_summary TEXT DEFAULT NULL,
    new_enriched_content TEXT DEFAULT NULL,
    new_key_points JSONB DEFAULT NULL,
    new_why_it_matters TEXT DEFAULT NULL,
    new_image_url TEXT DEFAULT NULL,
    new_sources JSONB DEFAULT NULL,
    new_citations JSONB DEFAULT NULL,
    new_enrichment_metadata JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE incidents
    SET 
        enrichment_status = 'enriched',
        enriched_title = COALESCE(new_enriched_title, enriched_title),
        enriched_summary = COALESCE(new_enriched_summary, enriched_summary),
        enriched_content = COALESCE(new_enriched_content, enriched_content),
        key_points = COALESCE(new_key_points, key_points),
        why_it_matters = COALESCE(new_why_it_matters, why_it_matters),
        image_url = COALESCE(new_image_url, image_url),
        sources = COALESCE(new_sources, sources),
        citations = COALESCE(new_citations, citations),
        enrichment_metadata = COALESCE(new_enrichment_metadata, enrichment_metadata),
        updated_at = NOW()
    WHERE id = incident_id;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE gov_feeds IS 'Catalog of government RSS/XML feeds for incident monitoring';
COMMENT ON TABLE incidents IS 'Government incidents parsed from official feeds with enrichment capability';
COMMENT ON MATERIALIZED VIEW incidents_public IS 'Public-facing view of incidents with geographic data';
COMMENT ON COLUMN incidents.id IS 'Unique identifier format: source_YYYYMMDD_HHMMSS';
COMMENT ON COLUMN incidents.location IS 'PostGIS geometry point (longitude, latitude) in WGS84';
COMMENT ON COLUMN incidents.relevance_score IS 'Content-based relevance score (0-100)';
COMMENT ON COLUMN incidents.enrichment_status IS 'Processing status for AI enrichment workflow';