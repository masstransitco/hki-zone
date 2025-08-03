-- Fix Government News and HKO Feed URLs based on actual working endpoints
-- Date: 2025-08-03

-- Fix Government News feeds - they use a different URL structure
UPDATE government_feed_sources 
SET 
    urls = '{
        "en": "https://www.news.gov.hk/en/api/news/list_news.ashx?top_news=Y&lang=en",
        "zh-TW": "https://www.news.gov.hk/tc/api/news/list_news.ashx?top_news=Y&lang=tc",
        "zh-CN": "https://www.news.gov.hk/sc/api/news/list_news.ashx?top_news=Y&lang=sc"
    }'::jsonb,
    feed_type = 'api',
    scraping_config = jsonb_set(
        scraping_config,
        '{api_format}',
        'true'
    ),
    updated_at = NOW()
WHERE feed_group = 'gov_news_main';

-- Disable broken government news category feeds for now
UPDATE government_feed_sources 
SET 
    active = false,
    updated_at = NOW()
WHERE feed_group IN (
    'gov_news_city',
    'gov_news_finance', 
    'gov_news_business',
    'gov_news_health',
    'gov_news_infrastructure',
    'gov_news_environment'
);

-- Fix HKO feeds that have wrong URLs
-- Remove non-existent feeds
UPDATE government_feed_sources 
SET 
    active = false,
    updated_at = NOW()
WHERE feed_group IN ('hko_forecast', 'hko_special_tips');

-- Fix duplicated HKO current weather (keep only the v2 version)
UPDATE government_feed_sources 
SET 
    active = false,
    updated_at = NOW()
WHERE feed_group = 'hko_current_weather';

-- Add correct GOVNEWS API endpoints (main feed only for now)
INSERT INTO government_feed_sources (feed_group, department, feed_type, urls, scraping_config) 
VALUES 
('gov_api_main', 'government', 'api', '{
    "en": "https://www.news.gov.hk/api/en/common/html/topstories.json",
    "zh-TW": "https://www.news.gov.hk/api/tc/common/html/topstories.json", 
    "zh-CN": "https://www.news.gov.hk/api/sc/common/html/topstories.json"
}', '{
    "enabled": true,
    "frequency_minutes": 15,
    "priority_boost": 8,
    "api_format": true,
    "content_selectors": {
        "title": ".topstory_txt_title",
        "body": ".topstory_txt_content"
    },
    "url_patterns": {
        "notice_id_regex": "/(\\\\d{10,})\\\\.htm",
        "language_url_map": {
            "en": "/en/",
            "zh-TW": "/tc/",
            "zh-CN": "/sc/"
        }
    }
}')
ON CONFLICT (feed_group) DO UPDATE SET
    urls = EXCLUDED.urls,
    scraping_config = EXCLUDED.scraping_config,
    active = true,
    updated_at = NOW();

-- Update stats
SELECT 
    department,
    COUNT(*) as total_feeds,
    COUNT(CASE WHEN active THEN 1 END) as active_feeds
FROM government_feed_sources 
GROUP BY department
ORDER BY department;