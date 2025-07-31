-- SQL script to parse and structure car specifications
-- This script adds parsed specification columns to the articles_unified table
-- and populates them from the existing contextual_data->specs->'規格' field

-- Add new columns for parsed specifications
ALTER TABLE articles_unified 
ADD COLUMN IF NOT EXISTS spec_year INTEGER,
ADD COLUMN IF NOT EXISTS spec_fuel_type TEXT,
ADD COLUMN IF NOT EXISTS spec_seats INTEGER,
ADD COLUMN IF NOT EXISTS spec_engine_cc INTEGER,
ADD COLUMN IF NOT EXISTS spec_transmission TEXT,
ADD COLUMN IF NOT EXISTS spec_formatted_display TEXT;

-- Create a function to parse Chinese/English fuel types
CREATE OR REPLACE FUNCTION parse_fuel_type(fuel_text TEXT) 
RETURNS TEXT AS $$
BEGIN
  IF fuel_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  CASE 
    WHEN fuel_text ILIKE '%柴油%' THEN RETURN 'Diesel';
    WHEN fuel_text ILIKE '%汽油%' THEN RETURN 'Petrol';
    WHEN fuel_text ILIKE '%石油%' THEN RETURN 'Petrol';
    WHEN fuel_text ILIKE '%電動%' THEN RETURN 'Electric';
    WHEN fuel_text ILIKE '%混合%' THEN RETURN 'Hybrid';
    WHEN fuel_text ILIKE '%油電%' THEN RETURN 'Hybrid';
    WHEN fuel_text ILIKE '%hybrid%' THEN RETURN 'Hybrid';
    WHEN fuel_text ILIKE '%electric%' THEN RETURN 'Electric';
    WHEN fuel_text ILIKE '%petrol%' THEN RETURN 'Petrol';
    WHEN fuel_text ILIKE '%diesel%' THEN RETURN 'Diesel';
    ELSE RETURN fuel_text;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Create a function to parse transmission types
CREATE OR REPLACE FUNCTION parse_transmission_type(trans_text TEXT) 
RETURNS TEXT AS $$
BEGIN
  IF trans_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  CASE 
    WHEN trans_text ILIKE '%自動AT%' THEN RETURN 'Auto';
    WHEN trans_text ILIKE '%手動MT%' THEN RETURN 'Manual';
    WHEN trans_text ILIKE '%自動%' THEN RETURN 'Auto';
    WHEN trans_text ILIKE '%手動%' THEN RETURN 'Manual';
    WHEN trans_text ILIKE '%CVT%' THEN RETURN 'CVT';
    WHEN trans_text ILIKE '%AT%' THEN RETURN 'Auto';
    WHEN trans_text ILIKE '%MT%' THEN RETURN 'Manual';
    WHEN trans_text ILIKE '%auto%' THEN RETURN 'Auto';
    WHEN trans_text ILIKE '%manual%' THEN RETURN 'Manual';
    ELSE RETURN trans_text;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Update the parsed specification columns
UPDATE articles_unified 
SET 
  -- Extract year (4 digits)
  spec_year = (
    SELECT CAST(matches[1] AS INTEGER)
    FROM regexp_matches(contextual_data->'specs'->>'規格', '(\d{4})', 'g') AS matches
    LIMIT 1
  ),
  
  -- Extract and parse fuel type
  spec_fuel_type = parse_fuel_type(
    (SELECT matches[1]
     FROM regexp_matches(contextual_data->'specs'->>'規格', '(柴油|汽油|石油|電動|混合|油電|Hybrid|Electric|Petrol|Diesel)', 'gi') AS matches
     LIMIT 1)
  ),
  
  -- Extract seats (number followed by 座)
  spec_seats = (
    SELECT CAST(matches[1] AS INTEGER)
    FROM regexp_matches(contextual_data->'specs'->>'規格', '(\d+)座', 'g') AS matches
    LIMIT 1
  ),
  
  -- Extract engine capacity (number followed by cc)
  spec_engine_cc = (
    SELECT CAST(matches[1] AS INTEGER)
    FROM regexp_matches(contextual_data->'specs'->>'規格', '(\d+)cc', 'g') AS matches
    LIMIT 1
  ),
  
  -- Extract and parse transmission
  spec_transmission = parse_transmission_type(
    (SELECT matches[1]
     FROM regexp_matches(contextual_data->'specs'->>'規格', '(自動AT|手動MT|自動|手動|CVT|AT|MT|Auto|Manual)', 'gi') AS matches
     LIMIT 1)
  )

WHERE category = 'cars' 
  AND contextual_data->'specs'->>'規格' IS NOT NULL;

-- Create formatted display string
UPDATE articles_unified 
SET spec_formatted_display = (
  SELECT string_agg(spec_part, ' • ')
  FROM (
    SELECT spec_part
    FROM (
      VALUES 
        (spec_fuel_type),
        (CASE WHEN spec_seats IS NOT NULL THEN spec_seats::TEXT || ' seats' END),
        (CASE WHEN spec_engine_cc IS NOT NULL THEN spec_engine_cc::TEXT || 'cc' END),
        (spec_transmission)
    ) AS t(spec_part)
    WHERE spec_part IS NOT NULL
    ORDER BY 
      CASE 
        WHEN spec_part = spec_fuel_type THEN 1
        WHEN spec_part LIKE '%seats%' THEN 2
        WHEN spec_part LIKE '%cc%' THEN 3
        WHEN spec_part = spec_transmission THEN 4
        ELSE 5
      END
  ) AS ordered_specs
)
WHERE category = 'cars' 
  AND (spec_fuel_type IS NOT NULL OR spec_seats IS NOT NULL OR spec_engine_cc IS NOT NULL OR spec_transmission IS NOT NULL);

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_articles_unified_car_specs 
ON articles_unified (category, spec_year, spec_fuel_type, spec_seats, spec_engine_cc, spec_transmission) 
WHERE category = 'cars';

-- Show sample results
SELECT 
  title,
  contextual_data->'specs'->>'規格' as original_spec,
  spec_year,
  spec_fuel_type,
  spec_seats,
  spec_engine_cc,
  spec_transmission,
  spec_formatted_display
FROM articles_unified 
WHERE category = 'cars' 
  AND contextual_data->'specs'->>'規格' IS NOT NULL
LIMIT 10;

-- Clean up functions (optional - comment out if you want to keep them)
-- DROP FUNCTION IF EXISTS parse_fuel_type(TEXT);
-- DROP FUNCTION IF EXISTS parse_transmission_type(TEXT);