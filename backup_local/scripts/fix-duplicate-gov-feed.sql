-- Fix duplicate government news feed issue
-- The news_gov_top_zh is a duplicate that should be removed

-- First, check if there are any incidents linked to the duplicate feed
WITH duplicate_feed AS (
  SELECT id FROM gov_feeds_unified WHERE base_slug = 'news_gov_top_zh'
)
DELETE FROM incidents_unified 
WHERE feed_id IN (SELECT id FROM duplicate_feed);

-- Now remove the duplicate feed
DELETE FROM gov_feeds_unified 
WHERE base_slug = 'news_gov_top_zh';

-- Ensure the main feed has correct naming and URLs
UPDATE gov_feeds_unified 
SET 
  name_en = 'Government News Top Stories',
  name_zh_tw = '政府新聞網頭條',
  name_zh_cn = '政府新闻网头条',
  url_en = 'https://www.news.gov.hk/rss/news/topstories_en.xml',
  url_zh_tw = 'https://www.news.gov.hk/tc/common/html/topstories.rss.xml',
  url_zh_cn = 'https://www.news.gov.hk/sc/common/html/topstories.rss.xml'
WHERE base_slug = 'news_gov_top';