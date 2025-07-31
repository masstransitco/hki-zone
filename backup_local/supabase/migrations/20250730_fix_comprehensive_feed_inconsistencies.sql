-- Migration: Fix comprehensive government feed language inconsistencies
-- Date: 2025-07-30
-- Purpose: Add missing Chinese feed variants and fix feed processing issues

-- Add missing CHP disease surveillance Chinese feed
INSERT INTO gov_feeds (slug, url, language, parent_feed_slug, active) VALUES
  ('chp_disease_zh_tw', 'https://www.chp.gov.hk/rss/cdwatch_zh_tw_RSS.xml', 'zh-TW', 'chp_disease', true)
ON CONFLICT (slug) DO UPDATE SET 
  url = EXCLUDED.url,
  language = EXCLUDED.language,
  parent_feed_slug = EXCLUDED.parent_feed_slug,
  active = EXCLUDED.active;

-- Add missing MTR rail Chinese feed
INSERT INTO gov_feeds (slug, url, language, parent_feed_slug, active) VALUES
  ('mtr_rail_zh_tw', 'https://alert.mtr.com.hk/rss/rail_tc.xml', 'zh-TW', 'mtr_rail', true)
ON CONFLICT (slug) DO UPDATE SET 
  url = EXCLUDED.url,
  language = EXCLUDED.language,
  parent_feed_slug = EXCLUDED.parent_feed_slug,
  active = EXCLUDED.active;

-- Add TD special traffic news Chinese variants (if/when available)
INSERT INTO gov_feeds (slug, url, language, parent_feed_slug, active) VALUES
  ('td_special_zh_tw', 'https://static.data.gov.hk/td/special-traffic-news/tc/1.xml', 'zh-TW', 'td_special', false), -- Disabled until URL confirmed
  ('td_special_zh_cn', 'https://static.data.gov.hk/td/special-traffic-news/sc/1.xml', 'zh-CN', 'td_special', false)  -- Disabled until URL confirmed
ON CONFLICT (slug) DO UPDATE SET 
  url = EXCLUDED.url,
  language = EXCLUDED.language,
  parent_feed_slug = EXCLUDED.parent_feed_slug,
  active = EXCLUDED.active;

-- Ensure proper language field mappings for existing feeds
UPDATE gov_feeds SET language = 'en' WHERE language IS NULL AND slug NOT LIKE '%_zh_%';
UPDATE gov_feeds SET language = 'zh-TW' WHERE language IS NULL AND slug LIKE '%_zh_tw';
UPDATE gov_feeds SET language = 'zh-CN' WHERE language IS NULL AND slug LIKE '%_zh_cn';

-- Fix hospital A&E Chinese feed - ensure it's active
UPDATE gov_feeds SET active = true WHERE slug = 'ha_ae_waiting_zh_tw';

-- Reset last_seen_pubdate for Chinese feeds that are severely underrepresented
-- This will force reprocessing of all their content
UPDATE gov_feeds SET 
  last_seen_pubdate = NULL,
  last_processed_at = NULL 
WHERE slug IN (
  'td_press_zh_tw', 
  'td_press_zh_cn', 
  'ha_ae_waiting_zh_tw',
  'hko_warn_zh_tw',
  'hko_eq_zh_tw',
  'hkma_press_zh_tw',
  'chp_press_zh_tw',
  'news_gov_top_zh'
);

-- Add proper category mappings for feeds that might be missing them
UPDATE gov_feeds SET category = 'road' WHERE slug LIKE 'td_%' AND category IS NULL;
UPDATE gov_feeds SET category = 'weather' WHERE slug LIKE 'hko_%' AND category IS NULL;
UPDATE gov_feeds SET category = 'health' WHERE slug LIKE 'chp_%' AND category IS NULL;
UPDATE gov_feeds SET category = 'financial' WHERE slug LIKE 'hkma_%' AND category IS NULL;
UPDATE gov_feeds SET category = 'top_signals' WHERE slug LIKE 'news_gov_top%' AND category IS NULL;
UPDATE gov_feeds SET category = 'utility' WHERE slug LIKE 'ha_ae_%' AND category IS NULL;
UPDATE gov_feeds SET category = 'rail' WHERE slug LIKE 'mtr_%' AND category IS NULL;

-- Ensure all Chinese feeds have proper parent-child relationships
UPDATE gov_feeds SET parent_feed_slug = 'chp_disease' WHERE slug = 'chp_disease_zh_tw' AND parent_feed_slug IS NULL;
UPDATE gov_feeds SET parent_feed_slug = 'mtr_rail' WHERE slug = 'mtr_rail_zh_tw' AND parent_feed_slug IS NULL;

-- Add comments
COMMENT ON TABLE gov_feeds IS 'Government RSS feed configurations with comprehensive multilingual coverage and fixed language inconsistencies';

-- Display summary of changes
SELECT 
  'Feed Configuration Summary' as summary,
  COUNT(*) as total_feeds,
  COUNT(*) FILTER (WHERE language = 'en') as english_feeds,
  COUNT(*) FILTER (WHERE language = 'zh-TW') as traditional_chinese_feeds,
  COUNT(*) FILTER (WHERE language = 'zh-CN') as simplified_chinese_feeds,
  COUNT(*) FILTER (WHERE active = true) as active_feeds,
  COUNT(*) FILTER (WHERE last_seen_pubdate IS NULL) as feeds_reset_for_reprocessing
FROM gov_feeds;