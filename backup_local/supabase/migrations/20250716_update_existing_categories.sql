-- Migration: Update existing data to use new categories
-- Date: 2025-07-16
-- Purpose: Update existing incidents to use the new top_signals and environment categories

-- Update existing HKMA_PRESS incidents to top_signals category
UPDATE incidents 
SET category = 'top_signals'
WHERE source_slug = 'hkma_press' AND category != 'top_signals';

-- Update existing HKMA_SPEECHES incidents to top_signals category
UPDATE incidents 
SET category = 'top_signals'
WHERE source_slug = 'hkma_speeches' AND category != 'top_signals';

-- Update existing NEWS_GOV_TOP incidents to top_signals category
UPDATE incidents 
SET category = 'top_signals'
WHERE source_slug = 'news_gov_top' AND category != 'top_signals';

-- Update existing CHP_DISEASE incidents to environment category
UPDATE incidents 
SET category = 'environment'
WHERE source_slug = 'chp_disease' AND category != 'environment';

-- Update other CHP incidents that contain disease-related content to environment
UPDATE incidents 
SET category = 'environment'
WHERE source_slug LIKE 'chp_%' 
  AND category != 'environment'
  AND (
    LOWER(title) LIKE '%disease%' OR 
    LOWER(title) LIKE '%virus%' OR 
    LOWER(title) LIKE '%infection%' OR
    LOWER(body) LIKE '%disease%' OR 
    LOWER(body) LIKE '%virus%' OR 
    LOWER(body) LIKE '%infection%'
  );

-- Show the results of the updates
SELECT 
  source_slug,
  category,
  COUNT(*) as count
FROM incidents
WHERE source_slug IN ('hkma_press', 'hkma_speeches', 'news_gov_top', 'chp_disease')
GROUP BY source_slug, category
ORDER BY source_slug, category;

-- Refresh the materialized view to reflect the changes
REFRESH MATERIALIZED VIEW incidents_public;