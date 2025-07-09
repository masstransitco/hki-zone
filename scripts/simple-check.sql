-- Simple check to see if enhanced fields exist
-- Run this in your Supabase SQL Editor to check current schema

SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'perplexity_news' 
AND column_name IN ('enhanced_title', 'summary', 'key_points', 'why_it_matters', 'structured_sources')
ORDER BY column_name;

-- If this returns empty results, you need to run the migration
-- If it returns 5 rows, the enhanced fields are already added