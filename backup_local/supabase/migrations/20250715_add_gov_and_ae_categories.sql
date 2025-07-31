-- Migration: Add Gov and A&E incident categories
-- Date: 2025-07-15
-- Purpose: Add new categories for government news and A&E waiting times

-- Add new categories to the incident_category enum
ALTER TYPE incident_category ADD VALUE 'gov';
ALTER TYPE incident_category ADD VALUE 'ae';

-- Update the news_gov_top feed to use 'gov' category
UPDATE gov_feeds SET url = 'https://www.news.gov.hk/rss/news/topstories_en.xml' WHERE slug = 'news_gov_top';

-- Update the incidents_public materialized view to include new categories
DROP MATERIALIZED VIEW IF EXISTS incidents_public;

CREATE MATERIALIZED VIEW incidents_public AS
SELECT 
    i.id,
    i.source_slug,
    i.title,
    i.body,
    i.category,
    i.severity,
    i.relevance_score,
    i.starts_at,
    i.source_updated_at,
    i.enrichment_status,
    i.enriched_title,
    i.enriched_summary,
    i.enriched_content,
    i.key_points,
    i.why_it_matters,
    i.key_facts,
    i.reporting_score,
    i.additional_sources,
    i.sources,
    i.enrichment_metadata,
    i.created_at,
    i.updated_at,
    -- Extract longitude and latitude from PostGIS geometry
    CASE 
        WHEN i.location IS NOT NULL THEN ST_X(i.location)
        ELSE NULL
    END as longitude,
    CASE 
        WHEN i.location IS NOT NULL THEN ST_Y(i.location)
        ELSE NULL
    END as latitude,
    -- Add category-specific fields
    CASE 
        WHEN i.category = 'health' THEN 'Health Alert'
        WHEN i.category = 'financial' THEN 'Financial Update'
        WHEN i.category = 'administrative' THEN 'Administrative'
        WHEN i.category = 'gov' THEN 'Government News'
        WHEN i.category = 'ae' THEN 'A&E Waiting Times'
        WHEN i.category = 'road' THEN 'Traffic Update'
        WHEN i.category = 'rail' THEN 'Rail Service'
        WHEN i.category = 'weather' THEN 'Weather Alert'
        WHEN i.category = 'utility' THEN 'Utility Service'
        ELSE 'General Alert'
    END as category_display,
    -- Add priority scoring based on category and severity
    CASE 
        WHEN i.category = 'health' AND i.severity >= 7 THEN 100
        WHEN i.category = 'ae' AND i.severity >= 6 THEN 95
        WHEN i.category = 'weather' AND i.severity >= 6 THEN 90
        WHEN i.category = 'road' AND i.severity >= 5 THEN 80
        WHEN i.category = 'rail' AND i.severity >= 5 THEN 80
        WHEN i.category = 'financial' AND i.severity >= 6 THEN 70
        WHEN i.category = 'gov' AND i.severity >= 4 THEN 65
        WHEN i.category = 'administrative' AND i.severity >= 4 THEN 60
        ELSE i.relevance_score
    END as display_priority
FROM incidents i
WHERE i.source_updated_at >= NOW() - INTERVAL '7 days'  -- Only show recent incidents
ORDER BY i.source_updated_at DESC;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_incidents_public_category ON incidents_public (category);
CREATE INDEX IF NOT EXISTS idx_incidents_public_priority ON incidents_public (display_priority DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_public_created_at ON incidents_public (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_public_source_updated_at ON incidents_public (source_updated_at DESC);

-- Add hospital information table for A&E details
CREATE TABLE IF NOT EXISTS hospital_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_code VARCHAR(20) UNIQUE NOT NULL,
    hospital_name_en VARCHAR(200) NOT NULL,
    hospital_name_zh VARCHAR(200),
    address_en TEXT,
    address_zh TEXT,
    phone_main VARCHAR(20),
    phone_ae VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    cluster VARCHAR(50), -- East, West, New Territories, Kowloon
    type VARCHAR(50), -- Public, Private
    website VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert hospital information
INSERT INTO hospital_info (
    hospital_code, hospital_name_en, hospital_name_zh, address_en, phone_main, phone_ae, 
    latitude, longitude, cluster, type, website
) VALUES 
    ('AHNH', 'Alice Ho Miu Ling Nethersole Hospital', '雅麗氏何妙齡那打素醫院', 
     '11 Chuen On Road, Tai Po, New Territories', '2689 2000', '2689 2000', 
     22.4708, 114.1291, 'New Territories East', 'Public', 'https://www3.ha.org.hk/ahnh/'),
    
    ('CGH', 'Caritas Medical Centre', '明愛醫院', 
     '111 Wing Hong Street, Sham Shui Po, Kowloon', '3408 7911', '3408 7911', 
     22.3386, 114.1586, 'Kowloon West', 'Public', 'https://www3.ha.org.hk/cmc/'),
    
    ('KWH', 'Kwong Wah Hospital', '廣華醫院', 
     '25 Waterloo Road, Yau Ma Tei, Kowloon', '2332 2311', '2332 2311', 
     22.3118, 114.1698, 'Kowloon Central', 'Public', 'https://www3.ha.org.hk/kwh/'),
    
    ('PMH', 'Princess Margaret Hospital', '瑪嘉烈醫院', 
     '2-10 Princess Margaret Hospital Road, Lai Chi Kok, Kowloon', '2990 1111', '2990 1111', 
     22.3383, 114.1495, 'Kowloon West', 'Public', 'https://www3.ha.org.hk/pmh/'),
    
    ('QEH', 'Queen Elizabeth Hospital', '伊利沙伯醫院', 
     '30 Gascoigne Road, Yau Ma Tei, Kowloon', '2958 8888', '2958 8888', 
     22.3093, 114.1751, 'Kowloon Central', 'Public', 'https://www3.ha.org.hk/qeh/'),
    
    ('QMH', 'Queen Mary Hospital', '瑪麗醫院', 
     '102 Pokfulam Road, Pokfulam, Hong Kong', '2255 3838', '2255 3838', 
     22.3193, 114.1294, 'Hong Kong West', 'Public', 'https://www3.ha.org.hk/qmh/'),
    
    ('RHTSK', 'Ruttonjee Hospital', '律敦治醫院', 
     '266 Queen\'s Road East, Wan Chai, Hong Kong', '2291 1345', '2291 1345', 
     22.2708, 114.1733, 'Hong Kong East', 'Public', 'https://www3.ha.org.hk/rhtsk/'),
    
    ('TMH', 'Tuen Mun Hospital', '屯門醫院', 
     '23 Tsing Chung Koon Road, Tuen Mun, New Territories', '2468 5111', '2468 5111', 
     22.4144, 114.1297, 'New Territories West', 'Public', 'https://www3.ha.org.hk/tmh/'),
    
    ('UCH', 'United Christian Hospital', '基督教聯合醫院', 
     '130 Hip Wo Street, Kwun Tong, Kowloon', '3513 3513', '3513 3513', 
     22.3083, 114.2250, 'Kowloon East', 'Public', 'https://www3.ha.org.hk/uch/'),
    
    ('WWH', 'Yan Chai Hospital', '仁濟醫院', 
     '7-11 Yan Chai Street, Tsuen Wan, New Territories', '2417 8383', '2417 8383', 
     22.4083, 114.1087, 'New Territories West', 'Public', 'https://www3.ha.org.hk/ych/'),
    
    ('PYNEH', 'Pamela Youde Nethersole Eastern Hospital', '東區尤德夫人那打素醫院', 
     '3 Lok Man Road, Chai Wan, Hong Kong', '2595 6111', '2595 6111', 
     22.2566, 114.2386, 'Hong Kong East', 'Public', 'https://www3.ha.org.hk/pyneh/'),
    
    ('TKOH', 'Tseung Kwan O Hospital', '將軍澳醫院', 
     '2 Po Ning Lane, Hang Hau, Tseung Kwan O, New Territories', '2208 0111', '2208 0111', 
     22.2944, 114.2897, 'Kowloon East', 'Public', 'https://www3.ha.org.hk/tkoh/'),
    
    ('NLTH', 'North Lantau Hospital', '北大嶼山醫院', 
     '8 Chung Yan Road, Tung Chung, Lantau Island', '2990 7000', '2990 7000', 
     22.2808, 114.1391, 'New Territories West', 'Public', 'https://www3.ha.org.hk/nlth/'),
    
    ('HKEH', 'Hong Kong Eye Hospital', '香港眼科醫院', 
     '147K Argyle Street, Mongkok, Kowloon', '2762 3000', '2762 3000', 
     22.3166, 114.1686, 'Kowloon Central', 'Public', 'https://www3.ha.org.hk/hkeh/'),
    
    ('HKBH', 'Hong Kong Baptist Hospital', '香港浸信會醫院', 
     '222 Waterloo Road, Kowloon Tong, Kowloon', '2339 8888', '2339 8888', 
     22.3358, 114.1833, 'Kowloon East', 'Private', 'https://www.hkbh.org.hk/'),
    
    ('HKSH', 'Hong Kong Sanatorium & Hospital', '香港養和醫院', 
     '2 Village Road, Happy Valley, Hong Kong', '2572 0211', '2572 0211', 
     22.2708, 114.1833, 'Hong Kong East', 'Private', 'https://www.hksh.com/'),
    
    ('SJSH', 'St. John Hospital', '聖約翰醫院', 
     '2 MacDonnell Road, Mid-Levels, Hong Kong', '2527 8285', '2527 8285', 
     22.2793, 114.1594, 'Hong Kong West', 'Private', 'https://www.sjh.org.hk/'),
    
    ('OLMH', 'Our Lady of Maryknoll Hospital', '聖母醫院', 
     '118 Shatin Pass Road, Wong Tai Sin, Kowloon', '2354 2111', '2354 2111', 
     22.3408, 114.1795, 'Kowloon East', 'Private', 'https://www.olmh.org.hk/')
ON CONFLICT (hospital_code) DO UPDATE SET 
    hospital_name_en = EXCLUDED.hospital_name_en,
    hospital_name_zh = EXCLUDED.hospital_name_zh,
    address_en = EXCLUDED.address_en,
    phone_main = EXCLUDED.phone_main,
    phone_ae = EXCLUDED.phone_ae,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    cluster = EXCLUDED.cluster,
    type = EXCLUDED.type,
    website = EXCLUDED.website,
    updated_at = NOW();

-- Create a view for A&E waiting times with hospital details
CREATE OR REPLACE VIEW ae_waiting_times_with_details AS
SELECT 
    i.id,
    i.title,
    i.body,
    i.severity,
    i.relevance_score,
    i.source_updated_at,
    i.longitude,
    i.latitude,
    -- Extract hospital code from incident ID
    CASE 
        WHEN i.source_slug = 'ha_ae_waiting' THEN 
            REGEXP_REPLACE(i.id, 'ha_ae_waiting_([A-Z]+)_.*', '\1')
        ELSE NULL
    END as hospital_code,
    -- Join hospital information
    h.hospital_name_en,
    h.hospital_name_zh,
    h.address_en,
    h.phone_main,
    h.phone_ae,
    h.cluster,
    h.type,
    h.website,
    -- Extract waiting time information from body
    CASE 
        WHEN i.body ~ 'Current waiting time: ([^.]+)' THEN 
            REGEXP_REPLACE(i.body, '.*Current waiting time: ([^.]+).*', '\1')
        ELSE 'Unknown'
    END as current_wait_time,
    CASE 
        WHEN i.body ~ 'Top wait: ([^.]+)' THEN 
            REGEXP_REPLACE(i.body, '.*Top wait: ([^.]+).*', '\1')
        ELSE 'Unknown'
    END as top_wait_time,
    CASE 
        WHEN i.body ~ 'Last updated: ([^.]+)' THEN 
            REGEXP_REPLACE(i.body, '.*Last updated: ([^.]+).*', '\1')
        ELSE 'Unknown'
    END as last_updated_time
FROM incidents_public i
LEFT JOIN hospital_info h ON (
    CASE 
        WHEN i.source_slug = 'ha_ae_waiting' THEN 
            REGEXP_REPLACE(i.id, 'ha_ae_waiting_([A-Z]+)_.*', '\1')
        ELSE NULL
    END = h.hospital_code
)
WHERE i.category = 'ae' AND i.source_slug = 'ha_ae_waiting'
ORDER BY i.source_updated_at DESC;

-- Add comments
COMMENT ON TABLE hospital_info IS 'Hospital information including contact details and locations';
COMMENT ON VIEW ae_waiting_times_with_details IS 'A&E waiting times with complete hospital information';

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW incidents_public;