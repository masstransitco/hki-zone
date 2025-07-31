-- Migration to add new enum values to incident_category
-- This needs to be run manually on the database

-- Add new enum values
ALTER TYPE incident_category ADD VALUE 'gov';
ALTER TYPE incident_category ADD VALUE 'ae';

-- Verify enum values were added
SELECT unnest(enum_range(NULL::incident_category)) as category;