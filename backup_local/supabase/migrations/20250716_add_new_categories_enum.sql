-- Migration Part 1: Add new enum values
-- Date: 2025-07-16
-- Purpose: Add new categories to incident_category enum (must be separate transaction)

-- Add new categories to the incident_category enum
ALTER TYPE incident_category ADD VALUE 'top_signals';
ALTER TYPE incident_category ADD VALUE 'environment';

-- This migration only adds the enum values and must be committed
-- before the materialized view can use them