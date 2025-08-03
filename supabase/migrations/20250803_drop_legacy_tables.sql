-- Migration to drop legacy government feeds tables
-- Created: 2025-08-03
-- Purpose: Clean up legacy tables after migration to government_signals system

-- Drop the legacy incidents_unified table and its indexes/triggers
DROP TRIGGER IF EXISTS update_incidents_unified_updated_at ON incidents_unified;
DROP INDEX IF EXISTS idx_incidents_unified_published;
DROP INDEX IF EXISTS idx_incidents_unified_feed;
DROP INDEX IF EXISTS idx_incidents_unified_category;
DROP INDEX IF EXISTS idx_incidents_unified_enrichment;
DROP TABLE IF EXISTS incidents_unified CASCADE;

-- Drop the legacy gov_feeds_unified table and its triggers
DROP TRIGGER IF EXISTS update_gov_feeds_unified_updated_at ON gov_feeds_unified;
DROP TABLE IF EXISTS gov_feeds_unified CASCADE;

-- Add comment about the migration
COMMENT ON SCHEMA public IS 'Legacy government feeds tables (incidents_unified, gov_feeds_unified) dropped on 2025-08-03. New system uses government_signals and government_feed_sources tables.';