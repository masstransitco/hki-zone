-- Add more government news sources and observatory feeds
-- Based on comprehensive testing of RSS feed availability

-- Update existing HKO warnings to use v2 API
UPDATE government_feed_sources 
SET 
    urls = '{
        "en": "https://rss.weather.gov.hk/rss/WeatherWarningSummaryv2.xml",
        "zh-TW": "https://rss.weather.gov.hk/rss/WeatherWarningSummaryv2_uc.xml"
    }'::jsonb,
    feed_group = 'hko_warnings_v2'
WHERE feed_group = 'hko_warnings';

-- Add more Hong Kong Observatory feeds (verified working)
INSERT INTO government_feed_sources (feed_group, department, feed_type, urls, scraping_config) VALUES

-- HKO Current Weather Report (verified working for EN and ZH-TW)
('hko_current_weather', 'weather', 'report', '{
    "en": "https://rss.weather.gov.hk/rss/CurrentWeather.xml",
    "zh-TW": "https://rss.weather.gov.hk/rss/CurrentWeather_uc.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 10,
    "priority_boost": 5,
    "content_selectors": {
        "title": "title",
        "body": "description"
    }
}'),

-- HKO Weather Forecast
('hko_forecast', 'weather', 'forecast', '{
    "en": "https://rss.weather.gov.hk/rss/WeatherForecast.xml",
    "zh-TW": "https://rss.weather.gov.hk/rss/WeatherForecast_uc.xml",
    "zh-CN": "https://rss.weather.gov.hk/rss/WeatherForecast_uc.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 30,
    "priority_boost": 3,
    "content_selectors": {
        "title": "title",
        "body": "description"
    }
}'),

-- HKO Earthquake Information
('hko_earthquakes', 'weather', 'earthquake', '{
    "en": "https://rss.weather.gov.hk/rss/QuickEarthquakeMessage.xml",
    "zh-TW": "https://rss.weather.gov.hk/rss/QuickEarthquakeMessage_uc.xml",
    "zh-CN": "https://rss.weather.gov.hk/rss/QuickEarthquakeMessage_uc.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 5,
    "priority_boost": 25,
    "content_selectors": {
        "title": "title",
        "body": "description"
    }
}'),

-- HKO Special Weather Tips
('hko_special_tips', 'weather', 'tips', '{
    "en": "https://rss.weather.gov.hk/rss/SpecialWeatherTips.xml",
    "zh-TW": "https://rss.weather.gov.hk/rss/SpecialWeatherTips_uc.xml",
    "zh-CN": "https://rss.weather.gov.hk/rss/SpecialWeatherTips_uc.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 15,
    "priority_boost": 10,
    "content_selectors": {
        "title": "title",
        "body": "description"
    }
}'),

-- Government News - Main Feed
('gov_news_main', 'government', 'news', '{
    "en": "https://www.news.gov.hk/en/common/html/topstories.rss.xml",
    "zh-TW": "https://www.news.gov.hk/tc/common/html/topstories.rss.xml",
    "zh-CN": "https://www.news.gov.hk/sc/common/html/topstories.rss.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 15,
    "priority_boost": 8,
    "content_selectors": {
        "title": ".page-title, h1",
        "body": ".content, .main-content"
    },
    "url_patterns": {
        "notice_id_regex": "record/(\\\\w+)\\\\.htm",
        "language_url_map": {
            "en": "/en/",
            "zh-TW": "/tc/",
            "zh-CN": "/sc/"
        }
    }
}'),

-- Government News - City/Life
('gov_news_city', 'government', 'news', '{
    "en": "https://www.news.gov.hk/en/city/html/articles.rss.xml",
    "zh-TW": "https://www.news.gov.hk/tc/city/html/articles.rss.xml",
    "zh-CN": "https://www.news.gov.hk/sc/city/html/articles.rss.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 30,
    "priority_boost": 3,
    "content_selectors": {
        "title": ".page-title, h1",
        "body": ".content, .main-content"
    },
    "url_patterns": {
        "notice_id_regex": "record/(\\\\w+)\\\\.htm",
        "language_url_map": {
            "en": "/en/",
            "zh-TW": "/tc/",
            "zh-CN": "/sc/"
        }
    }
}'),

-- Government News - Finance
('gov_news_finance', 'government', 'news', '{
    "en": "https://www.news.gov.hk/en/finance/html/articles.rss.xml",
    "zh-TW": "https://www.news.gov.hk/tc/finance/html/articles.rss.xml",
    "zh-CN": "https://www.news.gov.hk/sc/finance/html/articles.rss.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 30,
    "priority_boost": 5,
    "content_selectors": {
        "title": ".page-title, h1",
        "body": ".content, .main-content"
    },
    "url_patterns": {
        "notice_id_regex": "record/(\\\\w+)\\\\.htm",
        "language_url_map": {
            "en": "/en/",
            "zh-TW": "/tc/",
            "zh-CN": "/sc/"
        }
    }
}'),

-- Government News - Business
('gov_news_business', 'government', 'news', '{
    "en": "https://www.news.gov.hk/en/business/html/articles.rss.xml",
    "zh-TW": "https://www.news.gov.hk/tc/business/html/articles.rss.xml",
    "zh-CN": "https://www.news.gov.hk/sc/business/html/articles.rss.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 30,
    "priority_boost": 4,
    "content_selectors": {
        "title": ".page-title, h1",
        "body": ".content, .main-content"
    },
    "url_patterns": {
        "notice_id_regex": "record/(\\\\w+)\\\\.htm",
        "language_url_map": {
            "en": "/en/",
            "zh-TW": "/tc/",
            "zh-CN": "/sc/"
        }
    }
}'),

-- Government News - Health
('gov_news_health', 'government', 'news', '{
    "en": "https://www.news.gov.hk/en/health/html/articles.rss.xml",
    "zh-TW": "https://www.news.gov.hk/tc/health/html/articles.rss.xml",
    "zh-CN": "https://www.news.gov.hk/sc/health/html/articles.rss.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 20,
    "priority_boost": 10,
    "content_selectors": {
        "title": ".page-title, h1",
        "body": ".content, .main-content"
    },
    "url_patterns": {
        "notice_id_regex": "record/(\\\\w+)\\\\.htm",
        "language_url_map": {
            "en": "/en/",
            "zh-TW": "/tc/",
            "zh-CN": "/sc/"
        }
    }
}'),

-- Government News - Infrastructure
('gov_news_infrastructure', 'government', 'news', '{
    "en": "https://www.news.gov.hk/en/infrastructure/html/articles.rss.xml",
    "zh-TW": "https://www.news.gov.hk/tc/infrastructure/html/articles.rss.xml",
    "zh-CN": "https://www.news.gov.hk/sc/infrastructure/html/articles.rss.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 30,
    "priority_boost": 5,
    "content_selectors": {
        "title": ".page-title, h1",
        "body": ".content, .main-content"
    },
    "url_patterns": {
        "notice_id_regex": "record/(\\\\w+)\\\\.htm",
        "language_url_map": {
            "en": "/en/",
            "zh-TW": "/tc/",
            "zh-CN": "/sc/"
        }
    }
}'),

-- Government News - Environment
('gov_news_environment', 'government', 'news', '{
    "en": "https://www.news.gov.hk/en/environment/html/articles.rss.xml",
    "zh-TW": "https://www.news.gov.hk/tc/environment/html/articles.rss.xml",
    "zh-CN": "https://www.news.gov.hk/sc/environment/html/articles.rss.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 30,
    "priority_boost": 3,
    "content_selectors": {
        "title": ".page-title, h1",
        "body": ".content, .main-content"
    },
    "url_patterns": {
        "notice_id_regex": "record/(\\\\w+)\\\\.htm",
        "language_url_map": {
            "en": "/en/",
            "zh-TW": "/tc/",
            "zh-CN": "/sc/"
        }
    }
}'),

-- Centre for Health Protection - Press Releases (expand existing)
('chp_press', 'health', 'press', '{
    "en": "https://www.chp.gov.hk/files/rss/en_press_release.xml",
    "zh-TW": "https://www.chp.gov.hk/files/rss/tc_press_release.xml",
    "zh-CN": "https://www.chp.gov.hk/files/rss/sc_press_release.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 15,
    "priority_boost": 15,
    "content_selectors": {
        "title": ".page-title, h1",
        "body": ".content-body, .main-content"
    },
    "url_patterns": {
        "notice_id_regex": "id=(\\\\d+)",
        "language_url_map": {
            "en": "/en/",
            "zh-TW": "/tc/",
            "zh-CN": "/sc/"
        }
    }
}'),

-- Centre for Health Protection - Health Alerts
('chp_alerts', 'health', 'alert', '{
    "en": "https://www.chp.gov.hk/files/rss/en_health_alert.xml",
    "zh-TW": "https://www.chp.gov.hk/files/rss/tc_health_alert.xml",
    "zh-CN": "https://www.chp.gov.hk/files/rss/sc_health_alert.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 10,
    "priority_boost": 20,
    "content_selectors": {
        "title": ".page-title, h1",
        "body": ".content-body, .main-content"
    },
    "url_patterns": {
        "notice_id_regex": "id=(\\\\d+)",
        "language_url_map": {
            "en": "/en/",
            "zh-TW": "/tc/",
            "zh-CN": "/sc/"
        }
    }
}'),

-- Hong Kong Police Force - Press Releases
('hkpf_press', 'police', 'press', '{
    "en": "https://www.police.gov.hk/info/rss/press_en.xml",
    "zh-TW": "https://www.police.gov.hk/info/rss/press_tc.xml",
    "zh-CN": "https://www.police.gov.hk/info/rss/press_sc.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 20,
    "priority_boost": 8,
    "content_selectors": {
        "title": ".page-title, h1",
        "body": ".content, .main-content"
    },
    "url_patterns": {
        "notice_id_regex": "press_(\\\\d+)",
        "language_url_map": {
            "en": "/ppp_en/",
            "zh-TW": "/ppp_tc/",
            "zh-CN": "/ppp_sc/"
        }
    }
}'),

-- Fire Services Department - Press Releases
('fsd_press', 'emergency', 'press', '{
    "en": "https://www.hkfsd.gov.hk/eng/source/rss/press.xml",
    "zh-TW": "https://www.hkfsd.gov.hk/chi/source/rss/press.xml",
    "zh-CN": "https://www.hkfsd.gov.hk/chi/source/rss/press.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 15,
    "priority_boost": 12,
    "content_selectors": {
        "title": ".page-title, h1",
        "body": ".content-body, .main-content"
    },
    "url_patterns": {
        "notice_id_regex": "press_id=(\\\\d+)",
        "language_url_map": {
            "en": "/eng/",
            "zh-TW": "/chi/",
            "zh-CN": "/chi/"
        }
    }
}'),

-- Education Bureau - Announcements
('edb_announcements', 'education', 'announcement', '{
    "en": "https://www.edb.gov.hk/attachment/en/news/whats-new/rss_en_new.xml",
    "zh-TW": "https://www.edb.gov.hk/attachment/tc/news/whats-new/rss_tc_new.xml",
    "zh-CN": "https://www.edb.gov.hk/attachment/sc/news/whats-new/rss_sc_new.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 30,
    "priority_boost": 10,
    "content_selectors": {
        "title": ".page-title, h1",
        "body": ".content, .main-content"
    },
    "url_patterns": {
        "notice_id_regex": "id=(\\\\w+)",
        "language_url_map": {
            "en": "/en/",
            "zh-TW": "/tc/",
            "zh-CN": "/sc/"
        }
    }
}'),

-- Immigration Department - Announcements
('immd_announcements', 'immigration', 'announcement', '{
    "en": "https://www.immd.gov.hk/eng/RSS/rssfeed.xml",
    "zh-TW": "https://www.immd.gov.hk/hkt/RSS/rssfeed.xml",
    "zh-CN": "https://www.immd.gov.hk/hks/RSS/rssfeed.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 30,
    "priority_boost": 8,
    "content_selectors": {
        "title": ".page-title, h1",
        "body": ".content-body, .main-content"
    },
    "url_patterns": {
        "notice_id_regex": "press/(\\\\d+)",
        "language_url_map": {
            "en": "/eng/",
            "zh-TW": "/hkt/",
            "zh-CN": "/hks/"
        }
    }
}'),

-- Lands Department - Press Releases
('lands_press', 'lands', 'press', '{
    "en": "https://www.landsd.gov.hk/en/resources/rss/rss.xml",
    "zh-TW": "https://www.landsd.gov.hk/tc/resources/rss/rss.xml",
    "zh-CN": "https://www.landsd.gov.hk/sc/resources/rss/rss.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 30,
    "priority_boost": 5,
    "content_selectors": {
        "title": ".page-title, h1",
        "body": ".content, .main-content"
    },
    "url_patterns": {
        "notice_id_regex": "press/(\\\\d+)",
        "language_url_map": {
            "en": "/en/",
            "zh-TW": "/tc/",
            "zh-CN": "/sc/"
        }
    }
}'),

-- HKMA - Circulars (add simplified Chinese)
('hkma_circulars', 'monetary', 'circular', '{
    "en": "https://www.hkma.gov.hk/eng/other-information/rss/rss_circulars.xml",
    "zh-TW": "https://www.hkma.gov.hk/chi/other-information/rss/rss_circulars.xml",
    "zh-CN": "https://www.hkma.gov.hk/chi/other-information/rss/rss_circulars.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 60,
    "priority_boost": 3,
    "content_selectors": {
        "title": ".page-title, h1",
        "body": ".content-body, .main-content"
    }
}'),

-- HKMA - Guidelines  
('hkma_guidelines', 'monetary', 'guideline', '{
    "en": "https://www.hkma.gov.hk/eng/other-information/rss/rss_guidelines.xml",
    "zh-TW": "https://www.hkma.gov.hk/chi/other-information/rss/rss_guidelines.xml",
    "zh-CN": "https://www.hkma.gov.hk/chi/other-information/rss/rss_guidelines.xml"
}', '{
    "enabled": true,
    "frequency_minutes": 60,
    "priority_boost": 3,
    "content_selectors": {
        "title": ".page-title, h1",
        "body": ".content-body, .main-content"
    }
}')

ON CONFLICT (feed_group) DO UPDATE SET
    urls = EXCLUDED.urls,
    scraping_config = EXCLUDED.scraping_config,
    updated_at = NOW();

-- Update the mapFeedGroupToCategory function in the aggregator to handle new feed groups
-- This would need to be done in the TypeScript code, but let's update the database enum if needed

-- Add new categories if they don't exist
DO $$ 
BEGIN
    -- Check if we need new category values
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'education' AND enumtypid = 'government_category'::regtype) THEN
        ALTER TYPE government_category ADD VALUE 'education';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'immigration' AND enumtypid = 'government_category'::regtype) THEN
        ALTER TYPE government_category ADD VALUE 'immigration';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'environment' AND enumtypid = 'government_category'::regtype) THEN
        ALTER TYPE government_category ADD VALUE 'environment';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'police' AND enumtypid = 'government_category'::regtype) THEN
        ALTER TYPE government_category ADD VALUE 'police';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'lands' AND enumtypid = 'government_category'::regtype) THEN
        ALTER TYPE government_category ADD VALUE 'lands';
    END IF;
END $$;

-- Add index for new departments
CREATE INDEX IF NOT EXISTS idx_feed_sources_feed_group ON government_feed_sources(feed_group);

-- Update statistics
ANALYZE government_feed_sources;