-- Add soft delete support to articles table
ALTER TABLE articles 
ADD COLUMN deleted_at TIMESTAMPTZ NULL;

-- Create index for efficient filtering of non-deleted articles
CREATE INDEX idx_articles_deleted_at ON articles(deleted_at);

-- Add comment for documentation
COMMENT ON COLUMN articles.deleted_at IS 'Timestamp when the article was soft-deleted. NULL means the article is active.';