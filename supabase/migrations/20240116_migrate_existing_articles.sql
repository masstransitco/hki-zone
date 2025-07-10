-- Migration: Migrate existing data to unified articles table
-- This script migrates data from articles, perplexity_news tables to articles_unified

-- Migrate from perplexity_news table (AI-generated articles)
INSERT INTO articles_unified (
    title,
    content,
    url,
    source,
    category,
    created_at,
    published_at,
    updated_at,
    summary,
    lede,
    key_points,
    why_it_matters,
    image_url,
    image_metadata,
    status,
    processing_status,
    article_type,
    generation_metadata,
    structured_sources,
    contextual_data,
    author,
    generation_cost,
    features,
    legacy_article_id,
    legacy_table_name
)
SELECT 
    title,
    COALESCE(article_html, '') as content,
    url,
    COALESCE(source, 'Perplexity AI') as source,
    COALESCE(category, 'general') as category,
    created_at,
    created_at as published_at, -- Use created_at as published_at for stable ordering
    updated_at,
    summary,
    lede,
    key_points,
    why_it_matters,
    image_url,
    CASE 
        WHEN image_license IS NOT NULL 
        THEN jsonb_build_object('license', image_license)
        ELSE NULL
    END as image_metadata,
    CASE 
        WHEN article_status = 'ready' THEN 'published'::article_status
        ELSE 'draft'::article_status
    END as status,
    CASE 
        WHEN article_status = 'pending' THEN 'pending'::processing_status
        WHEN article_status = 'enriched' THEN 'processing'::processing_status
        WHEN article_status = 'ready' THEN 'ready'::processing_status
        ELSE 'pending'::processing_status
    END as processing_status,
    'ai_generated'::article_type as article_type,
    jsonb_build_object(
        'model', COALESCE(perplexity_model, 'unknown'),
        'cost', generation_cost,
        'image_prompt', image_prompt,
        'citations', COALESCE(citations, '[]'::jsonb)
    ) as generation_metadata,
    structured_sources,
    contextual_data,
    COALESCE(author, 'AI Generated') as author,
    generation_cost,
    jsonb_build_object(
        'has_image', image_url IS NOT NULL,
        'has_ai_content', true,
        'has_translation', false
    ) as features,
    id::text as legacy_article_id,
    'perplexity_news' as legacy_table_name
FROM perplexity_news
WHERE NOT EXISTS (
    SELECT 1 FROM articles_unified 
    WHERE articles_unified.url = perplexity_news.url
);

-- Migrate from articles table (scraped and AI-enhanced articles)
INSERT INTO articles_unified (
    title,
    content,
    url,
    source,
    category,
    created_at,
    published_at,
    updated_at,
    summary,
    lede,
    image_url,
    image_metadata,
    status,
    processing_status,
    article_type,
    enhancement_metadata,
    author,
    features,
    search_queries,
    legacy_article_id,
    legacy_table_name
)
SELECT 
    title,
    COALESCE(content, '') as content,
    url,
    source,
    COALESCE(category, 'general') as category,
    created_at,
    COALESCE(published_at, created_at) as published_at,
    COALESCE(updated_at, created_at) as updated_at,
    COALESCE(ai_summary, summary) as summary,
    NULL as lede, -- Articles table doesn't have lede
    image_url,
    image_metadata,
    'published'::article_status as status,
    'ready'::processing_status as processing_status,
    CASE 
        WHEN is_ai_enhanced = true THEN 'ai_enhanced'::article_type
        ELSE 'scraped'::article_type
    END as article_type,
    enhancement_metadata,
    author,
    jsonb_build_object(
        'has_image', image_url IS NOT NULL,
        'has_ai_content', is_ai_enhanced = true,
        'has_translation', false
    ) as features,
    CASE 
        WHEN enhancement_metadata->>'searchQueries' IS NOT NULL 
        THEN ARRAY(SELECT jsonb_array_elements_text(enhancement_metadata->'searchQueries'))
        ELSE NULL
    END as search_queries,
    id as legacy_article_id,
    'articles' as legacy_table_name
FROM articles
WHERE NOT EXISTS (
    SELECT 1 FROM articles_unified 
    WHERE articles_unified.url = articles.url
);

-- Log migration results
DO $$
DECLARE
    perplexity_count INTEGER;
    articles_count INTEGER;
    unified_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO perplexity_count FROM perplexity_news;
    SELECT COUNT(*) INTO articles_count FROM articles;
    SELECT COUNT(*) INTO unified_count FROM articles_unified;
    
    RAISE NOTICE 'Migration completed:';
    RAISE NOTICE '  - Perplexity news articles: %', perplexity_count;
    RAISE NOTICE '  - Regular articles: %', articles_count;
    RAISE NOTICE '  - Total in unified table: %', unified_count;
END $$;