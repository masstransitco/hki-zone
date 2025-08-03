-- Comprehensive fix for all government RSS feeds
-- Date: 2025-08-03
-- Goal: Ensure all feeds work and have 3-language support

-- ==========================================
-- 1. DISABLE COMPLETELY BROKEN FEEDS
-- ==========================================

-- Disable all broken government news feeds (they don't have RSS)
UPDATE government_feed_sources 
SET active = false, updated_at = NOW()
WHERE feed_group IN (
    'gov_news_main',
    'gov_news_city',
    'gov_news_finance',
    'gov_news_business',
    'gov_news_health',
    'gov_news_infrastructure',
    'gov_news_environment',
    'gov_api_main'
);

-- Disable non-existent HKO feeds
UPDATE government_feed_sources 
SET active = false, updated_at = NOW()
WHERE feed_group IN ('hko_forecast', 'hko_special_tips');

-- Disable duplicate HKO current weather
UPDATE government_feed_sources 
SET active = false, updated_at = NOW()
WHERE feed_group = 'hko_current_weather';

-- ==========================================
-- 2. FIX HKO FEEDS - Add Simplified Chinese
-- ==========================================

-- HKO 9-day forecast
UPDATE government_feed_sources 
SET 
    urls = jsonb_set(urls, '{zh-CN}', '"https://rss.weather.gov.hk/sc/rss/SeveralDaysWeatherForecast_uc.xml"'),
    updated_at = NOW()
WHERE feed_group = 'hko_9day_v2';

-- HKO Current Weather
UPDATE government_feed_sources 
SET 
    urls = jsonb_set(urls, '{zh-CN}', '"https://rss.weather.gov.hk/sc/rss/CurrentWeather_uc.xml"'),
    updated_at = NOW()
WHERE feed_group = 'hko_current_v2';

-- HKO Local Forecast
UPDATE government_feed_sources 
SET 
    urls = jsonb_set(urls, '{zh-CN}', '"https://rss.weather.gov.hk/sc/rss/LocalWeatherForecast_uc.xml"'),
    updated_at = NOW()
WHERE feed_group = 'hko_local_forecast_v2';

-- HKO Felt Earthquake (doesn't have zh-CN, use zh-TW as fallback)
UPDATE government_feed_sources 
SET 
    scraping_config = jsonb_set(
        scraping_config,
        '{language_fallback}',
        '{"zh-CN": "zh-TW"}'::jsonb
    ),
    updated_at = NOW()
WHERE feed_group = 'hko_felt_earthquake';

-- ==========================================
-- 3. FIX OTHER DEPARTMENT FEEDS
-- ==========================================

-- Fix EDB feeds (they have malformed XML, needs special handling)
UPDATE government_feed_sources 
SET 
    active = false, -- Disable for now due to XML parsing issues
    scraping_config = jsonb_set(
        scraping_config,
        '{note}',
        '"XML has encoding issues - needs custom parser"'
    ),
    updated_at = NOW()
WHERE feed_group = 'edb_announcements';

-- Fix Fire Services Department URLs
UPDATE government_feed_sources 
SET 
    urls = '{
        "en": "https://www.hkfsd.gov.hk/eng/news/press_releases/rss.xml",
        "zh-TW": "https://www.hkfsd.gov.hk/chi/news/press_releases/rss.xml",
        "zh-CN": "https://www.hkfsd.gov.hk/chi/news/press_releases/rss.xml"
    }'::jsonb,
    scraping_config = jsonb_set(
        scraping_config,
        '{content_selectors}',
        '{
            "title": ".press-title, h1, .title",
            "body": ".press-content, .content, .main-content"
        }'::jsonb
    ),
    updated_at = NOW()
WHERE feed_group = 'fsd_press';

-- Fix Centre for Health Protection URLs
UPDATE government_feed_sources 
SET 
    urls = '{
        "en": "https://www.chp.gov.hk/en/features/xml/599.xml",
        "zh-TW": "https://www.chp.gov.hk/tc/features/xml/599.xml",
        "zh-CN": "https://www.chp.gov.hk/sc/features/xml/599.xml"
    }'::jsonb,
    scraping_config = jsonb_set(
        scraping_config,
        '{content_selectors}',
        '{
            "title": ".title, h1, .page-header",
            "body": ".content, .article-content, .main-content"
        }'::jsonb
    ),
    updated_at = NOW()
WHERE feed_group = 'chp_press';

-- Disable CHP alerts (no RSS feed available)
UPDATE government_feed_sources 
SET active = false, updated_at = NOW()
WHERE feed_group = 'chp_alerts';

-- Fix Immigration Department URLs
UPDATE government_feed_sources 
SET 
    urls = '{
        "en": "https://www.immd.gov.hk/eng/press/rss.xml",
        "zh-TW": "https://www.immd.gov.hk/hkt/press/rss.xml",
        "zh-CN": "https://www.immd.gov.hk/hks/press/rss.xml"
    }'::jsonb,
    scraping_config = jsonb_set(
        scraping_config,
        '{content_selectors}',
        '{
            "title": ".press-title, h1, .title",
            "body": ".press-content, .content, .main-content"
        }'::jsonb
    ),
    updated_at = NOW()
WHERE feed_group = 'immd_announcements';

-- Fix Lands Department URLs
UPDATE government_feed_sources 
SET 
    urls = '{
        "en": "https://www.landsd.gov.hk/en/news/press.xml",
        "zh-TW": "https://www.landsd.gov.hk/tc/news/press.xml",
        "zh-CN": "https://www.landsd.gov.hk/sc/news/press.xml"
    }'::jsonb,
    scraping_config = jsonb_set(
        scraping_config,
        '{content_selectors}',
        '{
            "title": ".press-title, h1, .title",
            "body": ".press-content, .content, .main-content"
        }'::jsonb
    ),
    updated_at = NOW()
WHERE feed_group = 'lands_press';

-- Fix Hong Kong Police Force URLs
UPDATE government_feed_sources 
SET 
    urls = '{
        "en": "https://www.police.gov.hk/ppp_en/03_police_message/pr/rss.xml",
        "zh-TW": "https://www.police.gov.hk/ppp_tc/03_police_message/pr/rss.xml",
        "zh-CN": "https://www.police.gov.hk/ppp_sc/03_police_message/pr/rss.xml"
    }'::jsonb,
    scraping_config = jsonb_set(
        scraping_config,
        '{content_selectors}',
        '{
            "title": ".title, h1, .press-title",
            "body": ".content, .press-content, .main-content"
        }'::jsonb
    ),
    updated_at = NOW()
WHERE feed_group = 'hkpf_press';

-- ==========================================
-- 4. CONFIGURE SCRAPERS FOR ALL FEEDS
-- ==========================================

-- Update all non-HKO feeds to require scraping
UPDATE government_feed_sources 
SET 
    scraping_config = jsonb_set(
        scraping_config,
        '{enabled}',
        'true'
    )
WHERE department NOT IN ('weather')
AND active = true;

-- Ensure HKO feeds don't use scraping (content is in RSS)
UPDATE government_feed_sources 
SET 
    scraping_config = jsonb_set(
        scraping_config,
        '{enabled}',
        'false'
    ),
    scraping_config = jsonb_set(
        scraping_config,
        '{content_in_rss}',
        'true'
    )
WHERE department = 'weather'
AND active = true;

-- ==========================================
-- 5. ADD PROPER CONTENT SELECTORS
-- ==========================================

-- Transport Department selectors
UPDATE government_feed_sources 
SET 
    scraping_config = jsonb_set(
        scraping_config,
        '{content_selectors}',
        '{
            "title": ".page-title, h1, .title",
            "body": ".content-body, .main-content, .wrapfield, #content"
        }'::jsonb
    )
WHERE department = 'transport' 
AND feed_type != 'xml_data';

-- HKMA selectors
UPDATE government_feed_sources 
SET 
    scraping_config = jsonb_set(
        scraping_config,
        '{content_selectors}',
        '{
            "title": ".press-release-title, .page-title, h1, h3.press-release-title",
            "body": ".template-content-area, .content-area, .main-content, .press-release-content"
        }'::jsonb
    )
WHERE department = 'monetary';

-- ==========================================
-- 6. ADD URL PATTERNS FOR LANGUAGE SWITCHING
-- ==========================================

-- HKMA URL patterns
UPDATE government_feed_sources 
SET 
    scraping_config = jsonb_set(
        scraping_config,
        '{url_patterns,language_url_map}',
        '{
            "en": "/eng/",
            "zh-TW": "/chi/",
            "zh-CN": "/gb_chi/"
        }'::jsonb
    )
WHERE department = 'monetary';

-- Transport Department URL patterns
UPDATE government_feed_sources 
SET 
    scraping_config = jsonb_set(
        scraping_config,
        '{url_patterns,language_url_map}',
        '{
            "en": "/en/",
            "zh-TW": "/tc/",
            "zh-CN": "/sc/"
        }'::jsonb
    )
WHERE department = 'transport'
AND feed_type != 'xml_data';

-- Other departments URL patterns
UPDATE government_feed_sources 
SET 
    scraping_config = jsonb_set(
        scraping_config,
        '{url_patterns,language_url_map}',
        '{
            "en": "/eng/",
            "zh-TW": "/tc/",
            "zh-CN": "/sc/"
        }'::jsonb
    )
WHERE department IN ('police', 'lands', 'immigration', 'emergency', 'health');

-- ==========================================
-- 7. SUMMARY REPORT
-- ==========================================

SELECT 
    department,
    COUNT(*) as total_feeds,
    COUNT(CASE WHEN active THEN 1 END) as active_feeds,
    COUNT(CASE WHEN active AND scraping_config->>'enabled' = 'true' THEN 1 END) as feeds_with_scraping
FROM government_feed_sources 
GROUP BY department
ORDER BY department;

-- List all active feeds
SELECT 
    feed_group,
    department,
    feed_type,
    CASE 
        WHEN urls ? 'multilingual' THEN 'Multilingual XML'
        WHEN urls ? 'en' AND urls ? 'zh-TW' AND urls ? 'zh-CN' THEN '✅ All 3 languages'
        WHEN urls ? 'en' AND urls ? 'zh-TW' THEN '⚠️ Missing zh-CN'
        ELSE '❌ Missing languages'
    END as language_support
FROM government_feed_sources
WHERE active = true
ORDER BY department, feed_group;