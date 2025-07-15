-- Fix Government Feed URLs Script
-- Run this directly in Supabase SQL Editor

-- Update the broken earthquake feed URL
UPDATE gov_feeds SET 
  url = 'https://rss.weather.gov.hk/rss/QuickEarthquakeMessage.xml',
  active = true 
WHERE slug = 'hko_eq';

-- Add new working felt earthquake feed
INSERT INTO gov_feeds (slug, url, active) VALUES
  ('hko_felt_earthquake', 'https://rss.weather.gov.hk/rss/FeltEarthquake.xml', true)
ON CONFLICT (slug) DO UPDATE SET 
  url = EXCLUDED.url,
  active = EXCLUDED.active;

-- Disable feeds that are currently broken
UPDATE gov_feeds SET active = false 
WHERE slug IN ('td_special', 'mtr_rail', 'emsd_util');

-- Reset last_seen_pubdate for all feeds to force full reprocessing with new content-based IDs
UPDATE gov_feeds SET last_seen_pubdate = NULL;

-- Show current feed status
SELECT 
  slug,
  url,
  active,
  last_seen_pubdate,
  CASE 
    WHEN active = true THEN '✅ Active'
    ELSE '❌ Disabled'
  END as status
FROM gov_feeds
ORDER BY active DESC, slug;