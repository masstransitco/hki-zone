-- Migration: Create unified articles table
-- This migration consolidates articles, perplexity_news, and topics into a single table

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types for better type safety
DO $$ BEGIN
    CREATE TYPE article_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'ready', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE article_type AS ENUM ('scraped', 'ai_generated', 'ai_enhanced');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create the unified articles table
CREATE TABLE IF NOT EXISTS articles_unified (
    -- Core fields
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    
    -- Timestamps (published_at is used for ordering)
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Content fields
    summary TEXT,
    lede TEXT,
    key_points JSONB,
    why_it_matters TEXT,
    
    -- Media
    image_url TEXT,
    image_metadata JSONB,
    
    -- Status tracking
    status article_status DEFAULT 'published' NOT NULL,
    processing_status processing_status DEFAULT 'ready' NOT NULL,
    
    -- Metadata
    article_type article_type NOT NULL,
    generation_metadata JSONB,
    enhancement_metadata JSONB,
    structured_sources JSONB,
    contextual_data JSONB,
    
    -- Author information
    author TEXT,
    
    -- Cost tracking
    generation_cost DECIMAL(10, 6),
    
    -- Feature flags
    features JSONB DEFAULT '{"has_image": false, "has_ai_content": false, "has_translation": false}'::jsonb NOT NULL,
    
    -- Search queries for discoverability
    search_queries TEXT[],
    
    -- Legacy ID references for migration
    legacy_article_id TEXT,
    legacy_table_name TEXT
);

-- Create indexes for performance
CREATE INDEX idx_articles_unified_published_at ON articles_unified(published_at DESC);
CREATE INDEX idx_articles_unified_category ON articles_unified(category);
CREATE INDEX idx_articles_unified_source ON articles_unified(source);
CREATE INDEX idx_articles_unified_article_type ON articles_unified(article_type);
CREATE INDEX idx_articles_unified_status ON articles_unified(status);
CREATE INDEX idx_articles_unified_processing_status ON articles_unified(processing_status);
CREATE INDEX idx_articles_unified_features ON articles_unified USING gin(features);
CREATE INDEX idx_articles_unified_search_queries ON articles_unified USING gin(search_queries);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_articles_unified_updated_at 
    BEFORE UPDATE ON articles_unified 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE articles_unified ENABLE ROW LEVEL SECURITY;

-- Policy for public read access
CREATE POLICY "Public can read published articles" ON articles_unified
    FOR SELECT
    USING (status = 'published');

-- Policy for service role to manage all articles
CREATE POLICY "Service role can manage all articles" ON articles_unified
    FOR ALL
    USING (auth.role() = 'service_role');

-- Create a function to safely update features JSONB
CREATE OR REPLACE FUNCTION update_article_features(
    article_id UUID,
    feature_key TEXT,
    feature_value BOOLEAN
)
RETURNS VOID AS $$
BEGIN
    UPDATE articles_unified
    SET features = jsonb_set(features, ARRAY[feature_key], to_jsonb(feature_value))
    WHERE id = article_id;
END;
$$ LANGUAGE plpgsql;

-- Create helper function to check if article exists by URL
CREATE OR REPLACE FUNCTION article_exists_by_url(check_url TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM articles_unified 
        WHERE url = check_url
    );
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE articles_unified IS 'Unified table for all article types including scraped, AI-generated, and AI-enhanced content';
COMMENT ON COLUMN articles_unified.published_at IS 'Primary timestamp for article ordering - never modified after creation';
COMMENT ON COLUMN articles_unified.article_type IS 'Distinguishes between scraped news, AI-generated content (perplexity), and AI-enhanced articles';
COMMENT ON COLUMN articles_unified.features IS 'Feature flags for filtering and display logic';
COMMENT ON COLUMN articles_unified.legacy_article_id IS 'Original ID from the source table, used for migration tracking';
COMMENT ON COLUMN articles_unified.legacy_table_name IS 'Source table name for migration tracking';