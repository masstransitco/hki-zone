-- Since td_special feeds return 404, let's deactivate them
-- We can reactivate if we find the correct URLs later

UPDATE gov_feeds_unified 
SET active = false 
WHERE base_slug = 'td_special';

-- Add a comment about why it's deactivated
COMMENT ON COLUMN gov_feeds_unified.active IS 'Whether the feed is active. td_special deactivated due to 404 errors on all language URLs.';