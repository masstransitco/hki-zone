-- Migration: Create backward compatibility views
-- These views allow existing code to continue working while we migrate to the unified schema

-- Drop existing views if they exist
DROP VIEW IF EXISTS articles_view CASCADE;
DROP VIEW IF EXISTS perplexity_news_view CASCADE;

-- Create view for 'articles' table compatibility
CREATE VIEW articles_view AS
SELECT 
    COALESCE(legacy_article_id, id::text) as id,
    title,
    content,
    summary,
    CASE 
        WHEN article_type = 'ai_enhanced' THEN summary
        ELSE NULL
    END as ai_summary,
    url,
    source,
    author,
    published_at,
    image_url,
    image_metadata,
    category,
    created_at,
    updated_at,
    CASE 
        WHEN article_type = 'ai_enhanced' THEN true
        ELSE false
    END as is_ai_enhanced,
    CASE 
        WHEN article_type = 'ai_enhanced' AND enhancement_metadata->>'originalArticleId' IS NOT NULL
        THEN enhancement_metadata->>'originalArticleId'
        ELSE NULL
    END as original_article_id,
    enhancement_metadata
FROM articles_unified
WHERE article_type IN ('scraped', 'ai_enhanced')
  AND status = 'published';

-- Create view for 'perplexity_news' table compatibility
CREATE VIEW perplexity_news_view AS
SELECT 
    COALESCE(legacy_article_id, id::text)::uuid as id,
    title,
    generation_metadata->>'enhanced_title' as enhanced_title,
    category,
    url,
    created_at,
    updated_at,
    CASE 
        WHEN processing_status = 'ready' THEN 'ready'
        WHEN processing_status = 'processing' THEN 'enriched'
        ELSE 'pending'
    END as article_status,
    CASE 
        WHEN features->>'has_image' = 'true' THEN 'ready'
        ELSE 'pending'
    END as image_status,
    content as article_html,
    lede,
    summary,
    key_points,
    why_it_matters,
    image_url,
    image_metadata->>'license' as image_license,
    generation_metadata->>'image_prompt' as image_prompt,
    source,
    author,
    generation_metadata->>'model' as perplexity_model,
    generation_cost,
    generation_metadata->'citations' as citations,
    structured_sources,
    contextual_data
FROM articles_unified
WHERE article_type = 'ai_generated';

-- Create INSTEAD OF triggers for INSERT operations on views

-- Trigger for articles_view INSERT
CREATE OR REPLACE FUNCTION insert_articles_view()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO articles_unified (
        title, content, url, source, category,
        summary, author, image_url, image_metadata,
        article_type, published_at, enhancement_metadata,
        legacy_article_id, legacy_table_name
    ) VALUES (
        NEW.title, NEW.content, NEW.url, NEW.source, COALESCE(NEW.category, 'general'),
        COALESCE(NEW.ai_summary, NEW.summary), NEW.author, NEW.image_url, NEW.image_metadata,
        CASE WHEN NEW.is_ai_enhanced THEN 'ai_enhanced'::article_type ELSE 'scraped'::article_type END,
        COALESCE(NEW.published_at, NOW()), NEW.enhancement_metadata,
        NEW.id, 'articles'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_view_insert
    INSTEAD OF INSERT ON articles_view
    FOR EACH ROW
    EXECUTE FUNCTION insert_articles_view();

-- Trigger for perplexity_news_view INSERT
CREATE OR REPLACE FUNCTION insert_perplexity_news_view()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO articles_unified (
        title, category, url, source, author,
        content, lede, summary, key_points, why_it_matters,
        image_url, article_type, generation_cost,
        generation_metadata, structured_sources, contextual_data,
        processing_status, legacy_article_id, legacy_table_name,
        published_at
    ) VALUES (
        NEW.title, COALESCE(NEW.category, 'general'), NEW.url, 
        COALESCE(NEW.source, 'Perplexity AI'), COALESCE(NEW.author, 'AI Generated'),
        COALESCE(NEW.article_html, ''), NEW.lede, NEW.summary, NEW.key_points, NEW.why_it_matters,
        NEW.image_url, 'ai_generated'::article_type, NEW.generation_cost,
        jsonb_build_object(
            'model', NEW.perplexity_model,
            'cost', NEW.generation_cost,
            'image_prompt', NEW.image_prompt,
            'citations', COALESCE(NEW.citations, '[]'::jsonb),
            'enhanced_title', NEW.enhanced_title
        ),
        NEW.structured_sources, NEW.contextual_data,
        CASE 
            WHEN NEW.article_status = 'ready' THEN 'ready'::processing_status
            WHEN NEW.article_status = 'enriched' THEN 'processing'::processing_status
            ELSE 'pending'::processing_status
        END,
        NEW.id::text, 'perplexity_news',
        COALESCE(NEW.created_at, NOW())
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER perplexity_news_view_insert
    INSTEAD OF INSERT ON perplexity_news_view
    FOR EACH ROW
    EXECUTE FUNCTION insert_perplexity_news_view();

-- Create UPDATE triggers for views

-- Trigger for articles_view UPDATE
CREATE OR REPLACE FUNCTION update_articles_view()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE articles_unified SET
        title = NEW.title,
        content = NEW.content,
        summary = COALESCE(NEW.ai_summary, NEW.summary),
        author = NEW.author,
        image_url = NEW.image_url,
        image_metadata = NEW.image_metadata,
        enhancement_metadata = NEW.enhancement_metadata,
        updated_at = NOW()
    WHERE legacy_article_id = OLD.id AND legacy_table_name = 'articles';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_view_update
    INSTEAD OF UPDATE ON articles_view
    FOR EACH ROW
    EXECUTE FUNCTION update_articles_view();

-- Trigger for perplexity_news_view UPDATE
CREATE OR REPLACE FUNCTION update_perplexity_news_view()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE articles_unified SET
        title = NEW.title,
        content = COALESCE(NEW.article_html, content),
        lede = NEW.lede,
        summary = NEW.summary,
        key_points = NEW.key_points,
        why_it_matters = NEW.why_it_matters,
        image_url = NEW.image_url,
        generation_metadata = generation_metadata || jsonb_build_object(
            'enhanced_title', NEW.enhanced_title,
            'image_prompt', NEW.image_prompt
        ),
        structured_sources = NEW.structured_sources,
        contextual_data = NEW.contextual_data,
        processing_status = CASE 
            WHEN NEW.article_status = 'ready' THEN 'ready'::processing_status
            WHEN NEW.article_status = 'enriched' THEN 'processing'::processing_status
            ELSE 'pending'::processing_status
        END,
        features = jsonb_set(features, '{has_image}', to_jsonb(NEW.image_url IS NOT NULL)),
        updated_at = NOW()
    WHERE (legacy_article_id = NEW.id::text AND legacy_table_name = 'perplexity_news')
       OR (id = NEW.id::uuid AND article_type = 'ai_generated');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER perplexity_news_view_update
    INSTEAD OF UPDATE ON perplexity_news_view
    FOR EACH ROW
    EXECUTE FUNCTION update_perplexity_news_view();

-- Grant permissions on views
GRANT SELECT ON articles_view TO anon, authenticated;
GRANT SELECT ON perplexity_news_view TO anon, authenticated;
GRANT ALL ON articles_view TO service_role;
GRANT ALL ON perplexity_news_view TO service_role;

-- Add helpful comments
COMMENT ON VIEW articles_view IS 'Backward compatibility view for the original articles table';
COMMENT ON VIEW perplexity_news_view IS 'Backward compatibility view for the original perplexity_news table';