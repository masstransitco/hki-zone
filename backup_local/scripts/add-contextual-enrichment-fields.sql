-- Add fields for storing contextual enrichment data
-- This migration adds support for historical context and data-driven insights

-- Add contextual data fields to perplexity_news table
ALTER TABLE perplexity_news 
ADD COLUMN IF NOT EXISTS contextual_data JSONB;

-- The contextual_data JSON structure will store:
-- {
--   "contextual_bullets": [
--     {
--       "historical_context": "Past data/figures...",
--       "key_fact": "Current situation...",
--       "significance": "Why it matters..."
--     }
--   ],
--   "data_points": [
--     {
--       "metric": "Metric name",
--       "value": "Current value",
--       "comparison": "vs historical"
--     }
--   ],
--   "historical_references": ["url1", "url2"],
--   "enrichment_version": "contextual_v1"
-- }

-- Add index for querying contextual data
CREATE INDEX IF NOT EXISTS idx_perplexity_news_contextual_data 
ON perplexity_news USING gin(contextual_data);

-- Add comment for documentation
COMMENT ON COLUMN perplexity_news.contextual_data IS 'Stores contextual enrichment data including historical comparisons and data points in JSON format';