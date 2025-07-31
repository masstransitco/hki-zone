-- Migration: Fix feed language discrepancies
-- Date: 2025-07-30
-- Purpose: Add missing Chinese language variants for Transport Department press releases, HKMA feeds, and CHP press feeds

-- Add missing Transport Department press Traditional Chinese RSS feed
INSERT INTO gov_feeds (slug, url, language, parent_feed_slug, active) VALUES
  ('td_press_zh_tw', 'https://www.td.gov.hk/filemanager/rss/tc/press_release.xml', 'zh-TW', 'td_press', true)
ON CONFLICT (slug) DO UPDATE SET 
  url = EXCLUDED.url,
  language = EXCLUDED.language,
  parent_feed_slug = EXCLUDED.parent_feed_slug,
  active = EXCLUDED.active;

-- Add missing HKMA Traditional Chinese RSS feeds
INSERT INTO gov_feeds (slug, url, language, parent_feed_slug, active) VALUES
  ('hkma_press_zh_tw', 'https://www.hkma.gov.hk/chi/other-information/rss/rss_press-release.xml', 'zh-TW', 'hkma_press', true),
  ('hkma_circulars_zh_tw', 'https://www.hkma.gov.hk/chi/other-information/rss/rss_circulars.xml', 'zh-TW', 'hkma_circulars', true)
ON CONFLICT (slug) DO UPDATE SET 
  url = EXCLUDED.url,
  language = EXCLUDED.language,
  parent_feed_slug = EXCLUDED.parent_feed_slug,
  active = EXCLUDED.active;

-- Add missing CHP Traditional Chinese RSS feed
INSERT INTO gov_feeds (slug, url, language, parent_feed_slug, active) VALUES
  ('chp_press_zh_tw', 'https://www.chp.gov.hk/rss/tc/press_release.xml', 'zh-TW', 'chp_press', true)
ON CONFLICT (slug) DO UPDATE SET 
  url = EXCLUDED.url,
  language = EXCLUDED.language,
  parent_feed_slug = EXCLUDED.parent_feed_slug,
  active = EXCLUDED.active;

-- Update language category mapping for news_gov_top to ensure proper categorization
-- The English news_gov_top should be categorized as "top_signals", not "utility"
UPDATE gov_feeds SET category = 'top_signals' WHERE slug = 'news_gov_top' AND language = 'en';

-- Add comment
COMMENT ON TABLE gov_feeds IS 'Government RSS feed configurations with language support for consistent multilingual coverage';