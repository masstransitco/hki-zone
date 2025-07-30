-- Fix the Government News Simplified Chinese URL (returns 404)
-- Update to use Traditional Chinese URL for now since Simplified Chinese feed doesn't exist

UPDATE gov_feeds_unified 
SET 
  url_zh_cn = NULL  -- Set to NULL since the SC feed doesn't exist
WHERE base_slug = 'news_gov_top';

-- The system will automatically convert Traditional to Simplified Chinese when needed