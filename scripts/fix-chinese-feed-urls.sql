-- Fix Chinese feed URLs based on correct patterns

-- CHP feeds - correct URLs
UPDATE gov_feeds_unified SET 
  url_zh_tw = 'https://www.chp.gov.hk/tc/rss/pressreleases.xml',
  url_zh_cn = 'https://www.chp.gov.hk/sc/rss/pressreleases.xml'
WHERE base_slug = 'chp_press';

UPDATE gov_feeds_unified SET 
  url_zh_tw = 'https://www.chp.gov.hk/tc/rss/cdwatch.xml',
  url_zh_cn = 'https://www.chp.gov.hk/sc/rss/cdwatch.xml'
WHERE base_slug = 'chp_disease';

UPDATE gov_feeds_unified SET 
  url_zh_tw = 'https://www.chp.gov.hk/tc/rss/guidelines.xml',
  url_zh_cn = 'https://www.chp.gov.hk/sc/rss/guidelines.xml'
WHERE base_slug = 'chp_guidelines';

UPDATE gov_feeds_unified SET 
  url_zh_tw = 'https://www.chp.gov.hk/tc/rss/ncdaware.xml',
  url_zh_cn = 'https://www.chp.gov.hk/sc/rss/ncdaware.xml'
WHERE base_slug = 'chp_ncd';

-- HKMA feeds - correct URLs
UPDATE gov_feeds_unified SET 
  url_zh_tw = 'https://www.hkma.gov.hk/chi/other-information/rss/rss_press-release.xml',
  url_zh_cn = 'https://www.hkma.gov.hk/sc/other-information/rss/rss_press-release.xml'
WHERE base_slug = 'hkma_press';

UPDATE gov_feeds_unified SET 
  url_zh_tw = 'https://www.hkma.gov.hk/chi/other-information/rss/rss_circulars.xml',
  url_zh_cn = 'https://www.hkma.gov.hk/sc/other-information/rss/rss_circulars.xml'
WHERE base_slug = 'hkma_circulars';

UPDATE gov_feeds_unified SET 
  url_zh_tw = 'https://www.hkma.gov.hk/chi/other-information/rss/rss_guidelines.xml',
  url_zh_cn = 'https://www.hkma.gov.hk/sc/other-information/rss/rss_guidelines.xml'
WHERE base_slug = 'hkma_guidelines';

UPDATE gov_feeds_unified SET 
  url_zh_tw = 'https://www.hkma.gov.hk/chi/other-information/rss/rss_speeches.xml',
  url_zh_cn = 'https://www.hkma.gov.hk/sc/other-information/rss/rss_speeches.xml'
WHERE base_slug = 'hkma_speeches';

-- HKO feeds - correct URLs
UPDATE gov_feeds_unified SET 
  url_zh_tw = 'https://rss.weather.gov.hk/rss/WeatherWarningSummaryv2_uc.xml',
  url_zh_cn = 'https://rss.weather.gov.hk/rss/WeatherWarningSummaryv2_sc.xml'
WHERE base_slug = 'hko_warn';

UPDATE gov_feeds_unified SET 
  url_zh_tw = 'https://rss.weather.gov.hk/rss/QuickEarthquakeMessage_uc.xml',
  url_zh_cn = 'https://rss.weather.gov.hk/rss/QuickEarthquakeMessage_sc.xml'
WHERE base_slug = 'hko_eq';

UPDATE gov_feeds_unified SET 
  url_zh_tw = 'https://rss.weather.gov.hk/rss/FeltEarthquake_uc.xml',
  url_zh_cn = 'https://rss.weather.gov.hk/rss/FeltEarthquake_sc.xml'
WHERE base_slug = 'hko_felt_earthquake';

-- News.gov.hk - correct URLs
UPDATE gov_feeds_unified SET 
  url_zh_tw = 'https://www.news.gov.hk/tc/common/html/rss/topstories.rss.xml',
  url_zh_cn = 'https://www.news.gov.hk/sc/common/html/rss/topstories.rss.xml'
WHERE base_slug = 'news_gov_top';

-- MTR - correct URL
UPDATE gov_feeds_unified SET 
  url_zh_tw = 'https://www.mtr.com.hk/alert/ryg_line_status_tc.xml',
  url_zh_cn = 'https://www.mtr.com.hk/alert/ryg_line_status_sc.xml'
WHERE base_slug = 'mtr_rail';

-- Transport Department - keep existing URLs (they have special XML format)
-- These will need special handling in the parser