-- Add ai_summary column to articles_unified table for car enrichment compatibility
-- This column will store car-specific enrichment data from the CarEnricher

-- Add the ai_summary column
ALTER TABLE articles_unified 
ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- Add index for performance when filtering enriched vs non-enriched cars
CREATE INDEX IF NOT EXISTS idx_articles_unified_ai_summary_not_null 
ON articles_unified((ai_summary IS NOT NULL)) 
WHERE category = 'cars';

-- Add comment explaining the column
COMMENT ON COLUMN articles_unified.ai_summary IS 'Car-specific enrichment data including estimated year, fuel consumption, common faults, etc. Used by CarEnricher for car listings.';

-- Optional: Migrate any existing car enrichment data from contextual_data
-- This would only apply if any cars were already enriched using the unified enricher
UPDATE articles_unified
SET ai_summary = contextual_data->>'enrichment_summary'
WHERE category = 'cars' 
  AND ai_summary IS NULL 
  AND contextual_data IS NOT NULL 
  AND contextual_data->>'enrichment_summary' IS NOT NULL;