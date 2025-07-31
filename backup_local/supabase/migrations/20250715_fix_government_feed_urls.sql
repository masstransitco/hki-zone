-- Migration: Fix government feed URLs and add new working feeds
-- This migration updates broken feed URLs and adds new working feeds

-- Update existing feeds with corrected URLs
UPDATE gov_feeds SET 
  url = 'https://rss.weather.gov.hk/rss/QuickEarthquakeMessage.xml',
  active = true 
WHERE slug = 'hko_eq';

-- Add new working feeds
INSERT INTO gov_feeds (slug, url, active) VALUES
  ('hko_felt_earthquake', 'https://rss.weather.gov.hk/rss/FeltEarthquake.xml', true)
ON CONFLICT (slug) DO UPDATE SET 
  url = EXCLUDED.url,
  active = EXCLUDED.active;

-- Disable broken feeds until correct URLs are found
UPDATE gov_feeds SET active = false 
WHERE slug IN ('td_special', 'mtr_rail', 'emsd_util');

-- Add comments to document the changes
COMMENT ON TABLE gov_feeds IS 'Updated 2025-07-15: Fixed broken feed URLs, disabled non-working feeds';

-- Display updated feed status
SELECT 
  slug,
  url,
  active,
  'Updated feed URLs and status' as status
FROM gov_feeds
ORDER BY active DESC, slug;