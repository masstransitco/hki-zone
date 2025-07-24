-- Migration: Create bookmarks table for user article bookmarks
-- This migration creates a bookmarks table to allow users to save articles for later reading

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
    -- Core fields
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    article_id UUID NOT NULL, -- We'll add the foreign key constraint separately to handle both tables
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure unique bookmarks per user per article
    UNIQUE(user_id, article_id)
);

-- Create indexes for performance
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_article_id ON bookmarks(article_id);
CREATE INDEX idx_bookmarks_created_at ON bookmarks(created_at DESC);
CREATE INDEX idx_bookmarks_user_created ON bookmarks(user_id, created_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_bookmarks_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bookmarks_updated_at 
    BEFORE UPDATE ON bookmarks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_bookmarks_updated_at_column();

-- Add RLS policies
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- Policy for users to manage their own bookmarks
CREATE POLICY "Users can manage their own bookmarks" ON bookmarks
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy for service role to manage all bookmarks (for admin operations)
CREATE POLICY "Service role can manage all bookmarks" ON bookmarks
    FOR ALL
    USING (auth.role() = 'service_role');

-- Create helper functions for bookmark operations

-- Function to check if an article is bookmarked by a user
CREATE OR REPLACE FUNCTION is_article_bookmarked(
    check_user_id UUID,
    check_article_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM bookmarks 
        WHERE user_id = check_user_id 
        AND article_id = check_article_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to toggle bookmark (add if doesn't exist, remove if exists)
CREATE OR REPLACE FUNCTION toggle_bookmark(
    bookmark_user_id UUID,
    bookmark_article_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    bookmark_exists BOOLEAN;
BEGIN
    -- Check if bookmark exists
    SELECT EXISTS (
        SELECT 1 FROM bookmarks 
        WHERE user_id = bookmark_user_id 
        AND article_id = bookmark_article_id
    ) INTO bookmark_exists;
    
    IF bookmark_exists THEN
        -- Remove bookmark
        DELETE FROM bookmarks 
        WHERE user_id = bookmark_user_id 
        AND article_id = bookmark_article_id;
        RETURN FALSE; -- Bookmark removed
    ELSE
        -- Add bookmark
        INSERT INTO bookmarks (user_id, article_id) 
        VALUES (bookmark_user_id, bookmark_article_id);
        RETURN TRUE; -- Bookmark added
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's bookmarked articles with pagination (works with both tables)
CREATE OR REPLACE FUNCTION get_user_bookmarks(
    bookmark_user_id UUID,
    page_offset INTEGER DEFAULT 0,
    page_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    bookmark_id UUID,
    bookmark_created_at TIMESTAMPTZ,
    article_id UUID,
    article_title TEXT,
    article_summary TEXT,
    article_content TEXT,
    article_url TEXT,
    article_source TEXT,
    article_category TEXT,
    article_published_at TIMESTAMPTZ,
    article_image_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- Try articles_unified first
    SELECT 
        b.id as bookmark_id,
        b.created_at as bookmark_created_at,
        a.id as article_id,
        a.title as article_title,
        a.summary as article_summary,
        a.content as article_content,
        a.url as article_url,
        a.source as article_source,
        a.category as article_category,
        a.published_at as article_published_at,
        a.image_url as article_image_url
    FROM bookmarks b
    INNER JOIN articles_unified a ON b.article_id = a.id
    WHERE b.user_id = bookmark_user_id
    AND a.status = 'published'
    
    UNION ALL
    
    -- Then try regular articles table
    SELECT 
        b.id as bookmark_id,
        b.created_at as bookmark_created_at,
        a.id as article_id,
        a.title as article_title,
        a.summary as article_summary,
        a.content as article_content,
        a.url as article_url,
        a.source as article_source,
        a.category as article_category,
        a.created_at as article_published_at, -- articles table uses created_at instead of published_at
        a.image_url as article_image_url
    FROM bookmarks b
    INNER JOIN articles a ON b.article_id = a.id
    WHERE b.user_id = bookmark_user_id
    -- Regular articles table doesn't have status column
    
    ORDER BY bookmark_created_at DESC
    LIMIT page_limit
    OFFSET page_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE bookmarks IS 'User bookmarks for saving articles for later reading';
COMMENT ON COLUMN bookmarks.user_id IS 'Reference to the user who bookmarked the article';
COMMENT ON COLUMN bookmarks.article_id IS 'Reference to the bookmarked article';
COMMENT ON COLUMN bookmarks.created_at IS 'When the article was bookmarked';
COMMENT ON FUNCTION is_article_bookmarked IS 'Check if a specific article is bookmarked by a user';
COMMENT ON FUNCTION toggle_bookmark IS 'Add or remove bookmark - returns TRUE if added, FALSE if removed';
COMMENT ON FUNCTION get_user_bookmarks IS 'Get paginated list of user bookmarks with article details';