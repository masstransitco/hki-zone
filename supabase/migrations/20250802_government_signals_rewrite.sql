-- Government Signals Architecture Rewrite
-- Date: 2025-08-02
-- Purpose: Complete rebuild to eliminate duplicates and ensure language parity

-- Drop existing views and functions that depend on old tables
DROP MATERIALIZED VIEW IF EXISTS incidents_public;
DROP FUNCTION IF EXISTS get_incidents_by_language(content_language, incident_category, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_incidents_with_language(TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS merge_multilingual_incidents();

-- Create enum types for the new system
DO $$ BEGIN
    CREATE TYPE government_category AS ENUM (
        'transport_notice',
        'transport_press', 
        'weather_warning',
        'weather_earthquake',
        'health_alert',
        'health_guideline',
        'monetary_press',
        'monetary_circular',
        'administrative',
        'emergency',
        'utility'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new values to existing processing_status enum
DO $$ BEGIN
    -- Add new enum values if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'discovered' AND enumtypid = 'processing_status'::regtype) THEN
        ALTER TYPE processing_status ADD VALUE 'discovered';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'content_partial' AND enumtypid = 'processing_status'::regtype) THEN
        ALTER TYPE processing_status ADD VALUE 'content_partial';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'content_complete' AND enumtypid = 'processing_status'::regtype) THEN
        ALTER TYPE processing_status ADD VALUE 'content_complete';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'enriched' AND enumtypid = 'processing_status'::regtype) THEN
        ALTER TYPE processing_status ADD VALUE 'enriched';
    END IF;
EXCEPTION
    WHEN OTHERS THEN null;
END $$;

-- Create the new unified government signals table
CREATE TABLE government_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Source tracking (ensures uniqueness per government notice)
    source_identifier TEXT NOT NULL UNIQUE, -- Format: domain_slug_notice_id (e.g., "td_notices_82079")
    feed_group TEXT NOT NULL, -- e.g., 'td_notices', 'hko_warnings', 'hkma_press'
    
    -- Structured multilingual content with validation
    content JSONB NOT NULL DEFAULT '{}',
    /* Expected structure:
    {
      "meta": {
        "notice_id": "82079",
        "urls": {
          "en": "http://www.td.gov.hk/en/traffic_notices/index_id_82079.html",
          "zh-TW": "http://www.td.gov.hk/tc/traffic_notices/index_id_82079.html", 
          "zh-CN": "http://www.td.gov.hk/sc/traffic_notices/index_id_82079.html"
        },
        "published_at": "2025-08-01T07:41:37Z",
        "discovered_at": "2025-08-02T10:00:00Z"
      },
      "languages": {
        "en": {
          "title": "Service Hours Adjustments of KMB Route Nos. 81C, 281B and 281X",
          "body": "Members of the public are advised...",
          "scraped_at": "2025-08-02T10:05:00Z",
          "content_hash": "abc123...",
          "word_count": 250
        },
        "zh-TW": {
          "title": "九巴第81C號線、第281B號線及第281X號線服務時間調整",
          "body": "公眾人士請注意...",
          "scraped_at": "2025-08-02T10:05:30Z",
          "content_hash": "def456...",
          "word_count": 180
        }
      }
    }
    */
    
    -- Classification and priority
    category government_category NOT NULL,
    priority_score INTEGER NOT NULL DEFAULT 50 CHECK (priority_score >= 0 AND priority_score <= 100),
    tags TEXT[] DEFAULT '{}',
    
    -- Geolocation (if applicable)
    location JSONB DEFAULT '{}', -- {"lat": 22.3193, "lng": 114.1694, "address": "Central, HK"}
    
    -- Processing lifecycle
    processing_status processing_status DEFAULT 'discovered',
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    error_log JSONB DEFAULT '[]', -- Array of error objects with timestamps
    
    -- Performance and monitoring
    scraping_attempts INTEGER DEFAULT 0,
    enrichment_metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints to ensure data integrity
    CONSTRAINT valid_content_structure CHECK (
        jsonb_typeof(content) = 'object' AND
        content ? 'meta' AND
        content ? 'languages' AND
        jsonb_typeof(content->'meta') = 'object' AND
        jsonb_typeof(content->'languages') = 'object'
    ),
    CONSTRAINT has_required_languages CHECK (
        content->'languages' ? 'en'  -- English is always required
    ),
    CONSTRAINT valid_priority_score CHECK (priority_score BETWEEN 0 AND 100),
    CONSTRAINT valid_scraping_attempts CHECK (scraping_attempts >= 0)
);

-- Create performance indexes
CREATE INDEX idx_government_signals_feed_group ON government_signals(feed_group);
CREATE INDEX idx_government_signals_category ON government_signals(category);
CREATE INDEX idx_government_signals_status ON government_signals(processing_status);
CREATE INDEX idx_government_signals_priority ON government_signals(priority_score DESC);
CREATE INDEX idx_government_signals_published ON government_signals((content->'meta'->>'published_at') DESC);
CREATE INDEX idx_government_signals_updated ON government_signals(updated_at DESC);

-- GIN indexes for JSONB content searching
CREATE INDEX idx_government_signals_content_gin ON government_signals USING GIN (content);
CREATE INDEX idx_government_signals_tags_gin ON government_signals USING GIN (tags);

-- Create feed configuration table for the new system
CREATE TABLE government_feed_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Feed identification
    feed_group TEXT NOT NULL UNIQUE, -- e.g., 'td_notices', 'hko_warnings'
    department TEXT NOT NULL, -- e.g., 'transport', 'weather', 'health'
    feed_type TEXT NOT NULL, -- e.g., 'notices', 'warnings', 'press'
    
    -- Multilingual feed URLs
    urls JSONB NOT NULL DEFAULT '{}',
    /* Structure:
    {
      "en": "https://www.td.gov.hk/filemanager/rss/en/traffic_notices.xml",
      "zh-TW": "https://www.td.gov.hk/filemanager/rss/tc/traffic_notices.xml",
      "zh-CN": "https://www.td.gov.hk/filemanager/rss/sc/traffic_notices.xml"
    }
    */
    
    -- Processing configuration
    scraping_config JSONB DEFAULT '{}',
    /* Structure:
    {
      "enabled": true,
      "frequency_minutes": 10,
      "priority_boost": 0,
      "content_selectors": {
        "title": ".page-title, h1",
        "body": ".content-body, .main-content"
      },
      "url_patterns": {
        "notice_id_regex": "index_id_(\\d+)",
        "language_url_map": {
          "en": "/en/",
          "zh-TW": "/tc/", 
          "zh-CN": "/sc/"
        }
      }
    }
    */
    
    -- Status and monitoring
    active BOOLEAN DEFAULT true,
    last_fetch_attempt TIMESTAMPTZ,
    last_successful_fetch TIMESTAMPTZ,
    fetch_error_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_urls_structure CHECK (
        jsonb_typeof(urls) = 'object' AND
        urls ? 'en'  -- English URL is required
    )
);

-- Insert initial feed configurations
INSERT INTO government_feed_sources (feed_group, department, feed_type, urls, scraping_config) VALUES
-- Transport Department
('td_notices', 'transport', 'notices', '{
    "en": "https://www.td.gov.hk/filemanager/rss/en/traffic_notices.xml",
    "zh-TW": "https://www.td.gov.hk/filemanager/rss/tc/traffic_notices.xml",
    "zh-CN": "https://www.td.gov.hk/filemanager/rss/sc/traffic_notices.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 5,
    "priority_boost": 10,
    "content_selectors": {
        "title": ".page-title, h1, .title",
        "body": ".content-body, .main-content, .wrapfield"
    },
    "url_patterns": {
        "notice_id_regex": "index_id_(\\\\d+)",
        "language_url_map": {
            "en": "/en/",
            "zh-TW": "/tc/",
            "zh-CN": "/sc/"
        }
    }
}'),

('td_press', 'transport', 'press', '{
    "en": "https://www.td.gov.hk/filemanager/rss/en/press_release.xml",
    "zh-TW": "https://www.td.gov.hk/filemanager/rss/tc/press_release.xml",
    "zh-CN": "https://www.td.gov.hk/filemanager/rss/sc/press_release.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 15,
    "priority_boost": 5,
    "content_selectors": {
        "title": ".page-title, h1",
        "body": ".content-body, .main-content"
    },
    "url_patterns": {
        "notice_id_regex": "index_id_(\\\\d+)",
        "language_url_map": {
            "en": "/en/",
            "zh-TW": "/tc/",
            "zh-CN": "/sc/"
        }
    }
}'),

-- Hong Kong Observatory
('hko_warnings', 'weather', 'warnings', '{
    "en": "https://rss.weather.gov.hk/rss/WeatherWarningSummaryv2.xml",
    "zh-TW": "https://rss.weather.gov.hk/rss/WeatherWarningSummaryv2_uc.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 5,
    "priority_boost": 20,
    "content_selectors": {
        "title": "title",
        "body": "description"
    }
}'),

-- Hong Kong Monetary Authority
('hkma_press', 'monetary', 'press', '{
    "en": "https://www.hkma.gov.hk/eng/other-information/rss/rss_press-release.xml",
    "zh-TW": "https://www.hkma.gov.hk/chi/other-information/rss/rss_press-release.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 30,
    "priority_boost": 0,
    "content_selectors": {
        "title": ".page-title, h1",
        "body": ".content-body, .main-content"
    }
}');

-- Create indexes for feed sources
CREATE INDEX idx_feed_sources_department ON government_feed_sources(department);
CREATE INDEX idx_feed_sources_active ON government_feed_sources(active);
CREATE INDEX idx_feed_sources_last_fetch ON government_feed_sources(last_successful_fetch DESC);

-- Create function to get signals with language preference and fallback
CREATE OR REPLACE FUNCTION get_government_signals(
    p_languages TEXT[] DEFAULT ARRAY['en'],
    p_categories government_category[] DEFAULT NULL,
    p_feed_groups TEXT[] DEFAULT NULL,
    p_min_priority INTEGER DEFAULT 0,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    source_identifier TEXT,
    feed_group TEXT,
    category government_category,
    priority_score INTEGER,
    title TEXT,
    body TEXT,
    published_at TIMESTAMPTZ,
    processing_status processing_status,
    language_used TEXT,
    content_complete BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH signal_with_content AS (
        SELECT 
            gs.id,
            gs.source_identifier,
            gs.feed_group,
            gs.category,
            gs.priority_score,
            gs.content,
            gs.processing_status,
            (gs.content->'meta'->>'published_at')::TIMESTAMPTZ as published_at,
            -- Determine which language to use (preference order)
            CASE 
                WHEN p_languages[1] = 'zh-TW' AND gs.content->'languages' ? 'zh-TW' THEN 'zh-TW'
                WHEN p_languages[1] = 'zh-CN' AND gs.content->'languages' ? 'zh-CN' THEN 'zh-CN'
                WHEN 'en' = ANY(p_languages) AND gs.content->'languages' ? 'en' THEN 'en'
                WHEN gs.content->'languages' ? 'zh-TW' THEN 'zh-TW'
                WHEN gs.content->'languages' ? 'zh-CN' THEN 'zh-CN'
                ELSE 'en'
            END as selected_language,
            -- Check if content is complete for expected languages
            CASE
                WHEN gs.content->'languages' ? 'en' AND 
                     COALESCE(gs.content->'languages'->'en'->>'title', '') != '' AND
                     COALESCE(gs.content->'languages'->'en'->>'body', '') != ''
                THEN true
                ELSE false
            END as content_complete
        FROM government_signals gs
        WHERE 
            gs.priority_score >= p_min_priority
            AND (p_categories IS NULL OR gs.category = ANY(p_categories))
            AND (p_feed_groups IS NULL OR gs.feed_group = ANY(p_feed_groups))
            AND gs.processing_status != 'failed'
    )
    SELECT 
        swc.id,
        swc.source_identifier,
        swc.feed_group,
        swc.category,
        swc.priority_score,
        COALESCE(
            swc.content->'languages'->swc.selected_language->>'title',
            swc.content->'languages'->'en'->>'title',
            'Untitled'
        ) as title,
        COALESCE(
            swc.content->'languages'->swc.selected_language->>'body',
            swc.content->'languages'->'en'->>'body',
            ''
        ) as body,
        swc.published_at,
        swc.processing_status,
        swc.selected_language as language_used,
        swc.content_complete
    FROM signal_with_content swc
    ORDER BY 
        swc.priority_score DESC,
        swc.published_at DESC,
        swc.content_complete DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Create function to update signal content (for scraping engine)
CREATE OR REPLACE FUNCTION update_signal_content(
    p_source_identifier TEXT,
    p_language TEXT,
    p_title TEXT,
    p_body TEXT,
    p_scraped_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN AS $$
DECLARE
    content_hash TEXT;
    word_count INTEGER;
BEGIN
    -- Generate content hash for deduplication
    content_hash := encode(sha256((p_title || p_body)::bytea), 'hex');
    
    -- Calculate word count (approximate)
    word_count := array_length(string_to_array(trim(p_title || ' ' || p_body), ' '), 1);
    
    -- Update the signal content
    UPDATE government_signals 
    SET 
        content = jsonb_set(
            jsonb_set(
                jsonb_set(
                    jsonb_set(
                        content,
                        ARRAY['languages', p_language, 'title'],
                        to_jsonb(p_title)
                    ),
                    ARRAY['languages', p_language, 'body'],
                    to_jsonb(p_body)
                ),
                ARRAY['languages', p_language, 'scraped_at'],
                to_jsonb(p_scraped_at)
            ),
            ARRAY['languages', p_language, 'content_hash'],
            to_jsonb(content_hash)
        ),
        processing_status = CASE 
            WHEN processing_status = 'discovered' THEN 'content_partial'
            WHEN processing_status = 'content_partial' THEN 'content_complete'
            ELSE processing_status
        END,
        updated_at = NOW()
    WHERE source_identifier = p_source_identifier;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate priority score based on content
CREATE OR REPLACE FUNCTION calculate_signal_priority(
    p_category government_category,
    p_content JSONB,
    p_base_priority INTEGER DEFAULT 50
)
RETURNS INTEGER AS $$
DECLARE
    priority INTEGER := p_base_priority;
    title_text TEXT;
    body_text TEXT;
    combined_text TEXT;
    hours_since_published NUMERIC;
BEGIN
    -- Get English content for analysis
    title_text := COALESCE(p_content->'languages'->'en'->>'title', '');
    body_text := COALESCE(p_content->'languages'->'en'->>'body', '');
    combined_text := lower(title_text || ' ' || body_text);
    
    -- Category-based priority boost
    priority := priority + CASE p_category
        WHEN 'emergency' THEN 40
        WHEN 'weather_warning' THEN 30
        WHEN 'health_alert' THEN 25
        WHEN 'transport_notice' THEN 15
        WHEN 'transport_press' THEN 10
        WHEN 'monetary_press' THEN 5
        ELSE 0
    END;
    
    -- Urgency keyword boost
    IF combined_text ~ '(urgent|emergency|immediate|critical|severe|major disruption|suspended)' THEN
        priority := priority + 20;
    ELSIF combined_text ~ '(important|significant|disruption|delay|affected|closed)' THEN
        priority := priority + 10;
    ELSIF combined_text ~ '(temporary|special|arrangement|notice)' THEN
        priority := priority + 5;
    END IF;
    
    -- Freshness boost (decay over time)
    BEGIN
        hours_since_published := EXTRACT(EPOCH FROM (NOW() - (p_content->'meta'->>'published_at')::TIMESTAMPTZ)) / 3600;
        IF hours_since_published < 1 THEN
            priority := priority + 15;
        ELSIF hours_since_published < 6 THEN
            priority := priority + 10;
        ELSIF hours_since_published < 24 THEN
            priority := priority + 5;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            -- If published_at is invalid, no freshness boost
            NULL;
    END;
    
    -- Ensure priority stays within bounds
    RETURN LEAST(100, GREATEST(0, priority));
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update priority scores
CREATE OR REPLACE FUNCTION trigger_update_signal_priority()
RETURNS TRIGGER AS $$
BEGIN
    NEW.priority_score := calculate_signal_priority(NEW.category, NEW.content, NEW.priority_score);
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_signal_priority_trigger
    BEFORE INSERT OR UPDATE ON government_signals
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_signal_priority();

-- Add helpful comments
COMMENT ON TABLE government_signals IS 'Unified government signals table with zero duplication and proper multilingual support';
COMMENT ON COLUMN government_signals.source_identifier IS 'Unique identifier per government notice (format: domain_slug_notice_id)';
COMMENT ON COLUMN government_signals.content IS 'Structured JSONB containing all multilingual content with metadata';
COMMENT ON COLUMN government_signals.processing_status IS 'Current processing state of the signal';
COMMENT ON FUNCTION get_government_signals IS 'Retrieve signals with language preference and intelligent fallback';
COMMENT ON FUNCTION update_signal_content IS 'Update signal content for a specific language (used by scraping engine)';
COMMENT ON FUNCTION calculate_signal_priority IS 'Calculate dynamic priority score based on content analysis';