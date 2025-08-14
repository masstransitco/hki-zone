-- Government Signals Storage Optimization Migration
-- This migration normalizes the government_signals table to prevent massive storage waste
-- from GIN indexes on JSONB content

-- Create normalized content table
CREATE TABLE IF NOT EXISTS government_signals_content (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    signal_id UUID NOT NULL REFERENCES government_signals(id) ON DELETE CASCADE,
    language TEXT NOT NULL CHECK (language IN ('en', 'zh-TW', 'zh-CN')),
    title TEXT NOT NULL,
    body TEXT DEFAULT '',
    word_count INTEGER DEFAULT 0,
    content_hash TEXT,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(signal_id, language)
);

-- Create metadata table for signal meta information
CREATE TABLE IF NOT EXISTS government_signals_meta (
    signal_id UUID PRIMARY KEY REFERENCES government_signals(id) ON DELETE CASCADE,
    notice_id TEXT,
    published_at TIMESTAMPTZ,
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    urls JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create efficient indexes (not on entire JSONB!)
CREATE INDEX IF NOT EXISTS idx_signals_content_signal_id ON government_signals_content(signal_id);
CREATE INDEX IF NOT EXISTS idx_signals_content_language ON government_signals_content(language);
CREATE INDEX IF NOT EXISTS idx_signals_content_title_search ON government_signals_content USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_signals_content_body_search ON government_signals_content USING gin(to_tsvector('english', body)) WHERE LENGTH(body) > 0;
CREATE INDEX IF NOT EXISTS idx_signals_meta_published ON government_signals_meta(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_meta_notice_id ON government_signals_meta(notice_id);

-- Drop the problematic GIN index on entire JSONB content if it exists
DROP INDEX IF EXISTS idx_government_signals_content_gin;

-- Remove content column from main table if it exists
ALTER TABLE government_signals DROP COLUMN IF EXISTS content;

-- Drop old functions and triggers that depended on the content JSONB field
DROP TRIGGER IF EXISTS update_signal_priority_trigger ON government_signals;
DROP FUNCTION IF EXISTS trigger_update_signal_priority() CASCADE;
DROP FUNCTION IF EXISTS get_government_signals(text[], text[], text[], integer, integer, integer, boolean);
DROP FUNCTION IF EXISTS update_signal_content(uuid, text, text, text);
DROP FUNCTION IF EXISTS calculate_signal_priority(jsonb, text, integer);

-- Create function to get signals with proper language handling
CREATE OR REPLACE FUNCTION get_government_signals_v2(
    p_languages text[] DEFAULT ARRAY['en'],
    p_categories text[] DEFAULT NULL,
    p_feed_groups text[] DEFAULT NULL,
    p_min_priority integer DEFAULT 0,
    p_limit integer DEFAULT 20,
    p_offset integer DEFAULT 0,
    p_include_partial boolean DEFAULT false
)
RETURNS TABLE (
    id uuid,
    source_identifier text,
    feed_group text,
    category government_category,
    priority_score integer,
    processing_status processing_status,
    created_at timestamptz,
    updated_at timestamptz,
    notice_id text,
    published_at timestamptz,
    urls jsonb,
    title text,
    body text,
    language_used text,
    word_count integer,
    scraped_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH signal_with_preferred_content AS (
        SELECT DISTINCT ON (gs.id)
            gs.id,
            gs.source_identifier,
            gs.feed_group,
            gs.category,
            gs.priority_score,
            gs.processing_status,
            gs.created_at,
            gs.updated_at,
            meta.notice_id,
            meta.published_at,
            meta.urls,
            content.title,
            content.body,
            content.language as language_used,
            content.word_count,
            content.scraped_at,
            -- Language preference order
            CASE content.language
                WHEN 'en' THEN 1
                WHEN 'zh-TW' THEN 2
                WHEN 'zh-CN' THEN 3
                ELSE 4
            END as lang_priority
        FROM government_signals gs
        LEFT JOIN government_signals_meta meta ON meta.signal_id = gs.id
        LEFT JOIN government_signals_content content ON content.signal_id = gs.id
        WHERE 
            (p_categories IS NULL OR gs.category = ANY(p_categories::government_category[]))
            AND (p_feed_groups IS NULL OR gs.feed_group = ANY(p_feed_groups))
            AND gs.priority_score >= p_min_priority
            AND (p_include_partial OR gs.processing_status IN ('content_complete', 'enriched'))
            AND (content.language = ANY(p_languages) OR content.language IS NULL)
        ORDER BY gs.id, lang_priority
    )
    SELECT * FROM signal_with_preferred_content
    ORDER BY priority_score DESC, created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Create updated_at trigger for new tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_signals_content_updated_at BEFORE UPDATE ON government_signals_content FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_signals_meta_updated_at BEFORE UPDATE ON government_signals_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comment on the optimization
COMMENT ON TABLE government_signals_content IS 'Normalized content table - prevents massive GIN index storage waste';
COMMENT ON TABLE government_signals_meta IS 'Metadata table for government signals';
COMMENT ON INDEX idx_signals_content_title_search IS 'Text search on titles only - much more efficient than entire JSONB';
COMMENT ON INDEX idx_signals_content_body_search IS 'Text search on bodies where content exists';