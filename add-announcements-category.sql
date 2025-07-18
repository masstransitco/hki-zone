-- Add announcements category to the incident_category enum
ALTER TYPE incident_category ADD VALUE 'announcements';

-- Update all government sources to be categorized as announcements
UPDATE incidents SET category = 'announcements' 
WHERE source_slug IN (
  'td_press', 'chp_press', 'hkma_press', 'hkma_speeches', 
  'hkma_guidelines', 'hkma_circulars', 'news_gov_top',
  'chp_guidelines', 'chp_disease', 'chp_ncd'
);

-- Refresh materialized view if it exists
REFRESH MATERIALIZED VIEW IF EXISTS incidents_public;