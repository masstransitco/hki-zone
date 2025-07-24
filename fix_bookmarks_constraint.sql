-- Fix bookmarks foreign key constraint
-- Remove the constraint that points to articles_unified since articles are in the articles table

-- Drop the existing foreign key constraint
ALTER TABLE bookmarks DROP CONSTRAINT IF EXISTS bookmarks_article_id_fkey;

-- We won't add a new constraint since we need to support both articles and articles_unified tables
-- The application code will handle validation

-- Update the database functions if they don't exist
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

-- Update the is_article_bookmarked function
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