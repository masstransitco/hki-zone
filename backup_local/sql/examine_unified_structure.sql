-- Examine the unified articles table structure and data

-- 1. Check the table structure
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'articles_unified'
ORDER BY 
    ordinal_position;

-- 2. Sample AI-generated (perplexity) articles to see data structure
SELECT 
    id,
    title,
    article_type,
    status,
    processing_status,
    published_at,
    created_at,
    updated_at,
    -- Content fields
    summary,
    lede,
    key_points,
    why_it_matters,
    -- Metadata
    generation_metadata,
    structured_sources,
    contextual_data,
    features,
    -- Legacy tracking
    legacy_article_id,
    legacy_table_name
FROM 
    articles_unified
WHERE 
    article_type = 'ai_generated'
ORDER BY 
    published_at DESC
LIMIT 3;

-- 3. Check if the backward compatibility view works
SELECT 
    id,
    title,
    article_status,
    image_status,
    key_points,
    structured_sources
FROM 
    perplexity_news_view
LIMIT 3;

-- 4. Verify article IDs format (important for bottom sheet)
SELECT 
    id,
    legacy_article_id,
    article_type,
    title
FROM 
    articles_unified
WHERE 
    article_type = 'ai_generated'
LIMIT 5;

-- 5. Check if content is properly stored
SELECT 
    id,
    title,
    LENGTH(content) as content_length,
    SUBSTRING(content, 1, 100) as content_preview
FROM 
    articles_unified
WHERE 
    article_type = 'ai_generated'
    AND content IS NOT NULL
LIMIT 3;