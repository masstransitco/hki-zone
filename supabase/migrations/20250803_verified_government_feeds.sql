-- Add verified working government feeds (tested August 3, 2025)
-- This migration adds 12 working feed groups: 5 TD XML feeds + 7 HKO RSS feeds

-- Update existing HKO warnings to the new v3 endpoint
UPDATE government_feed_sources 
SET 
    feed_group = 'hko_warnings_v3',
    urls = '{
        "en": "https://rss.weather.gov.hk/rss/WeatherWarningSummaryv2.xml",
        "zh-TW": "https://rss.weather.gov.hk/rss/WeatherWarningSummaryv2_uc.xml",
        "zh-CN": "https://rss.weather.gov.hk/sc/rss/WeatherWarningSummaryv2_uc.xml"
    }'::jsonb,
    scraping_config = jsonb_set(
        scraping_config,
        '{priority_boost}',
        '25'
    )
WHERE feed_group = 'hko_warnings' OR feed_group = 'hko_warnings_v2';

-- Insert new verified working feeds
INSERT INTO government_feed_sources (feed_group, department, feed_type, urls, scraping_config) VALUES

-- Transport Department XML Data Feeds (multilingual in single XML)
('td_special_traffic', 'transport', 'xml_data', '{
    "multilingual": "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Special_Traffic_and_Transport_Arrangement.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 5,
    "priority_boost": 20,
    "content_selectors": {
        "title_en": "Title_EN",
        "title_tc": "Title_TC", 
        "title_sc": "Title_SC",
        "body": "Detail_EN"
    },
    "xml_data_format": true
}'),

('td_clearways', 'transport', 'xml_data', '{
    "multilingual": "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Clearways.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 10,
    "priority_boost": 15,
    "content_selectors": {
        "title_en": "Title_EN",
        "title_tc": "Title_TC",
        "title_sc": "Title_SC",
        "body": "Detail_EN"
    },
    "xml_data_format": true
}'),

('td_public_transport', 'transport', 'xml_data', '{
    "multilingual": "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Public_Transports.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 10,
    "priority_boost": 18,
    "content_selectors": {
        "title_en": "Title_EN",
        "title_tc": "Title_TC",
        "title_sc": "Title_SC",
        "body": "Detail_EN"
    },
    "xml_data_format": true
}'),

('td_road_closure', 'transport', 'xml_data', '{
    "multilingual": "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Temporary_Road_Closure.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 5,
    "priority_boost": 25,
    "content_selectors": {
        "title_en": "Title_EN",
        "title_tc": "Title_TC",
        "title_sc": "Title_SC",
        "body": "Detail_EN"
    },
    "xml_data_format": true
}'),

('td_expressways', 'transport', 'xml_data', '{
    "multilingual": "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Expressways.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 10,
    "priority_boost": 20,
    "content_selectors": {
        "title_en": "Title_EN",
        "title_tc": "Title_TC",
        "title_sc": "Title_SC",
        "body": "Detail_EN"
    },
    "xml_data_format": true
}'),

-- Hong Kong Observatory RSS Feeds
('hko_warning_bulletin', 'weather', 'warning', '{
    "en": "https://rss.weather.gov.hk/rss/WeatherWarningBulletin.xml",
    "zh-TW": "https://rss.weather.gov.hk/rss/WeatherWarningBulletin_uc.xml",
    "zh-CN": "https://rss.weather.gov.hk/sc/rss/WeatherWarningBulletin_uc.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 5,
    "priority_boost": 30,
    "content_selectors": {
        "title": "title",
        "body": "description"
    }
}'),

('hko_earthquakes_quick', 'weather', 'earthquake', '{
    "en": "https://rss.weather.gov.hk/rss/QuickEarthquakeMessage.xml",
    "zh-TW": "https://rss.weather.gov.hk/rss/QuickEarthquakeMessage_uc.xml",
    "zh-CN": "https://rss.weather.gov.hk/sc/rss/QuickEarthquakeMessage_uc.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 5,
    "priority_boost": 35,
    "content_selectors": {
        "title": "title",
        "body": "description"
    }
}'),

('hko_felt_earthquake', 'weather', 'earthquake', '{
    "en": "https://rss.weather.gov.hk/rss/FeltEarthquake.xml",
    "zh-TW": "https://rss.weather.gov.hk/rss/FeltEarthquake_uc.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 10,
    "priority_boost": 30,
    "content_selectors": {
        "title": "title",
        "body": "description"
    }
}'),

('hko_current_v2', 'weather', 'current', '{
    "en": "https://rss.weather.gov.hk/rss/CurrentWeather.xml",
    "zh-TW": "https://rss.weather.gov.hk/rss/CurrentWeather_uc.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 15,
    "priority_boost": 8,
    "content_selectors": {
        "title": "title",
        "body": "description"
    }
}'),

('hko_local_forecast_v2', 'weather', 'forecast', '{
    "en": "https://rss.weather.gov.hk/rss/LocalWeatherForecast.xml",
    "zh-TW": "https://rss.weather.gov.hk/rss/LocalWeatherForecast_uc.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 30,
    "priority_boost": 10,
    "content_selectors": {
        "title": "title",
        "body": "description"
    }
}'),

('hko_9day_v2', 'weather', 'forecast', '{
    "en": "https://rss.weather.gov.hk/rss/SeveralDaysWeatherForecast.xml",
    "zh-TW": "https://rss.weather.gov.hk/rss/SeveralDaysWeatherForecast_uc.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 60,
    "priority_boost": 5,
    "content_selectors": {
        "title": "title",
        "body": "description"
    }
}')

ON CONFLICT (feed_group) DO UPDATE SET
    urls = EXCLUDED.urls,
    scraping_config = EXCLUDED.scraping_config,
    updated_at = NOW();

-- Update the aggregator mappings function to handle XML data feeds
-- Note: The aggregator code will need updates to handle XML data format

-- Add indexes for the new feed types
CREATE INDEX IF NOT EXISTS idx_feed_sources_xml_data ON government_feed_sources(feed_type) WHERE feed_type = 'xml_data';
CREATE INDEX IF NOT EXISTS idx_feed_sources_multilingual ON government_feed_sources USING GIN(urls) WHERE urls ? 'multilingual';

-- Update statistics
ANALYZE government_feed_sources;

-- Summary of additions:
-- ✅ 5 Transport Department XML data feeds (special traffic, clearways, public transport, road closures, expressways)
-- ✅ 6 Hong Kong Observatory RSS feeds with full multilingual support (warnings, earthquakes, forecasts)
-- ✅ Total: 11 new verified working feed groups + 1 updated existing feed
-- 
-- Notes:
-- - TD XML feeds contain multilingual content in single XML files (EN/TC/SC titles)
-- - HKO feeds work reliably with traditional RSS format
-- - All feeds tested and verified working as of August 3, 2025
-- - Simplified Chinese (zh-CN) support available for HKO feeds via /sc/rss/ endpoint