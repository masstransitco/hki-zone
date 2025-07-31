-- Add scraping metadata to incidents table
ALTER TABLE incidents 
ADD COLUMN IF NOT EXISTS last_scraped_at timestamptz;

-- Create index for efficient querying of unscraped content
CREATE INDEX IF NOT EXISTS idx_incidents_scraping 
ON incidents(source_slug, last_scraped_at) 
WHERE source_slug LIKE 'td_notices%' AND (body IS NULL OR body = '');

-- Add comment
COMMENT ON COLUMN incidents.last_scraped_at IS 'Timestamp of when the content was last scraped from the source URL';