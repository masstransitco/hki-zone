-- Fix remaining broken feeds and ensure HKO doesn't use scraping
-- Date: 2025-08-03

-- ==========================================
-- 1. FIX POLICE RSS FEED
-- ==========================================

UPDATE government_feed_sources 
SET 
    urls = '{
        "en": "https://www.police.gov.hk/app/php/press_release.php?lang=en",
        "zh-TW": "https://www.police.gov.hk/app/php/press_release.php?lang=tc",
        "zh-CN": "https://www.police.gov.hk/app/php/press_release.php?lang=sc"
    }'::jsonb,
    scraping_config = jsonb_set(
        scraping_config,
        '{content_selectors}',
        '{
            "title": ".title, h1, .press-title, .pr_title",
            "body": ".content, .press-content, .main-content, .pr_content"
        }'::jsonb
    ),
    updated_at = NOW()
WHERE feed_group = 'hkpf_press';

-- ==========================================
-- 2. DISABLE BROKEN GOVERNMENT FEEDS
-- ==========================================

-- These departments don't have working RSS feeds
UPDATE government_feed_sources 
SET active = false, updated_at = NOW()
WHERE feed_group IN (
    'fsd_press',      -- Fire Services (no RSS available)
    'chp_press',      -- Centre for Health Protection (no RSS)
    'immd_announcements', -- Immigration (no RSS)
    'lands_press'     -- Lands Department (no RSS)
);

-- ==========================================
-- 3. ENSURE HKO FEEDS DON'T USE SCRAPING
-- ==========================================

-- HKO feeds have content in RSS, no scraping needed
UPDATE government_feed_sources 
SET 
    scraping_config = jsonb_set(
        jsonb_set(
            scraping_config,
            '{enabled}',
            'false'
        ),
        '{content_in_rss}',
        'true'
    ),
    updated_at = NOW()
WHERE department = 'weather'
AND active = true;

-- ==========================================
-- 4. CONFIGURE PROPER SCRAPERS
-- ==========================================

-- Ensure all active non-HKO feeds have scraping enabled
UPDATE government_feed_sources 
SET 
    scraping_config = jsonb_set(
        scraping_config,
        '{enabled}',
        'true'
    )
WHERE department NOT IN ('weather')
AND active = true;

-- ==========================================
-- 5. SUMMARY REPORT
-- ==========================================

-- Show final state of all feeds
SELECT 
    feed_group,
    department,
    feed_type,
    active,
    CASE 
        WHEN NOT active THEN '❌ Disabled'
        WHEN urls ? 'multilingual' THEN '✅ Multilingual XML'
        WHEN urls ? 'en' AND urls ? 'zh-TW' AND urls ? 'zh-CN' THEN '✅ All 3 languages'
        WHEN urls ? 'en' AND urls ? 'zh-TW' THEN '⚠️ Missing zh-CN'
        ELSE '❌ Missing languages'
    END as status,
    CASE 
        WHEN scraping_config->>'enabled' = 'true' THEN '🔧 Scraping'
        WHEN scraping_config->>'content_in_rss' = 'true' THEN '📄 RSS Content'
        ELSE '❓ Unknown'
    END as content_source
FROM government_feed_sources
ORDER BY active DESC, department, feed_group;

-- Count active feeds by department
SELECT 
    department,
    COUNT(*) as total_feeds,
    COUNT(CASE WHEN active THEN 1 END) as active_feeds,
    COUNT(CASE WHEN active AND scraping_config->>'enabled' = 'true' THEN 1 END) as needs_scraping,
    COUNT(CASE WHEN active AND scraping_config->>'content_in_rss' = 'true' THEN 1 END) as rss_content
FROM government_feed_sources 
GROUP BY department
ORDER BY active_feeds DESC, department;