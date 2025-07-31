-- Update Transport Department feed URLs to the correct RSS endpoints
-- The Chinese URLs were pointing to old/incorrect endpoints

-- TD Traffic Notices
UPDATE gov_feeds_unified 
SET 
  url_zh_tw = 'https://www.td.gov.hk/filemanager/rss/tc/traffic_notices.xml',
  url_zh_cn = 'https://www.td.gov.hk/filemanager/rss/sc/traffic_notices.xml'
WHERE base_slug = 'td_notices';

-- TD Press Releases  
UPDATE gov_feeds_unified 
SET 
  url_zh_tw = 'https://www.td.gov.hk/filemanager/rss/tc/press_release.xml',
  url_zh_cn = 'https://www.td.gov.hk/filemanager/rss/sc/press_release.xml'
WHERE base_slug = 'td_press';

-- Also ensure td_special exists if it doesn't
INSERT INTO gov_feeds_unified (
  base_slug,
  name_en,
  name_zh_tw,
  name_zh_cn,
  department,
  feed_type,
  url_en,
  url_zh_tw,
  url_zh_cn,
  active
) VALUES (
  'td_special',
  'Transport Dept Special Traffic News',
  '運輸署特別交通消息',
  '运输署特别交通消息',
  'transport',
  'special',
  'https://www.td.gov.hk/filemanager/rss/en/special_traffic_news.xml',
  'https://www.td.gov.hk/filemanager/rss/tc/special_traffic_news.xml', 
  'https://www.td.gov.hk/filemanager/rss/sc/special_traffic_news.xml',
  true
)
ON CONFLICT (base_slug) 
DO UPDATE SET 
  url_en = EXCLUDED.url_en,
  url_zh_tw = EXCLUDED.url_zh_tw,
  url_zh_cn = EXCLUDED.url_zh_cn;