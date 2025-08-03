-- Fix HKMA feeds to include Simplified Chinese URLs and updated scraping config
-- HKMA provides zh-CN content at /gb_chi/ URLs

-- Update HKMA Press Releases
UPDATE government_feed_sources 
SET 
    urls = jsonb_set(
        urls,
        '{zh-CN}',
        '"https://www.hkma.gov.hk/gb_chi/other-information/rss/rss_press-release.xml"'
    ),
    scraping_config = jsonb_set(
        jsonb_set(
            scraping_config,
            '{url_patterns,language_url_map,zh-CN}',
            '"/gb_chi/news-and-media/press-releases/"'
        ),
        '{content_selectors}',
        '{
            "title": ".press-release-title, .page-title, h1, h3.press-release-title",
            "body": ".template-content-area, .content-area, .main-content, .press-release-content"
        }'::jsonb
    ),
    updated_at = NOW()
WHERE feed_group = 'hkma_press';

-- Update HKMA Circulars
UPDATE government_feed_sources 
SET 
    urls = jsonb_set(
        urls,
        '{zh-CN}',
        '"https://www.hkma.gov.hk/gb_chi/other-information/rss/rss_circulars.xml"'
    ),
    scraping_config = jsonb_set(
        jsonb_set(
            scraping_config,
            '{url_patterns,language_url_map,zh-CN}',
            '"/gb_chi/regulatory-resources/circulars/"'
        ),
        '{content_selectors}',
        '{
            "title": ".page-title, h1, .circular-title",
            "body": ".template-content-area, .content-area, .main-content, .circular-content"
        }'::jsonb
    ),
    updated_at = NOW()
WHERE feed_group = 'hkma_circulars';

-- Update HKMA Guidelines
UPDATE government_feed_sources 
SET 
    urls = jsonb_set(
        urls,
        '{zh-CN}',
        '"https://www.hkma.gov.hk/gb_chi/other-information/rss/rss_guidelines.xml"'
    ),
    scraping_config = jsonb_set(
        jsonb_set(
            scraping_config,
            '{url_patterns,language_url_map,zh-CN}',
            '"/gb_chi/regulatory-resources/guidelines/"'
        ),
        '{content_selectors}',
        '{
            "title": ".page-title, h1, .guideline-title",
            "body": ".template-content-area, .content-area, .main-content, .guideline-content"
        }'::jsonb
    ),
    updated_at = NOW()
WHERE feed_group = 'hkma_guidelines';

-- Verify the updates
SELECT 
    feed_group,
    urls->'zh-CN' as simplified_chinese_url,
    scraping_config->'url_patterns'->'language_url_map'->'zh-CN' as zh_cn_pattern
FROM government_feed_sources 
WHERE department = 'monetary'
ORDER BY feed_group;