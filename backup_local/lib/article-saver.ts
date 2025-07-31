import { createClient } from '@supabase/supabase-js';
import { EnhancedArticle } from './perplexity-trilingual-enhancer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export interface SavedArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  language: string;
  quality_score: number;
  created_at: string;
}

export async function saveEnhancedArticles(
  articles: EnhancedArticle[],
  batchId: string
): Promise<SavedArticle[]> {
  console.log(`Saving ${articles.length} enhanced articles to database...`);
  
  const savedArticles: SavedArticle[] = [];
  const errors: string[] = [];
  
  // Process in batches of 5 to avoid overwhelming the database
  const batchSize = 5;
  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);
    
    const promises = batch.map(async (article) => {
      try {
        // Check if article with same URL already exists (now URLs are unique per language)
        const { data: existing } = await supabase
          .from('articles')
          .select('id')
          .eq('url', article.url)
          .single();
        
        if (existing) {
          console.log(`Article already exists: ${article.title} (${article.language})`);
          return null;
        }
        
        // Format the article data for saving - follows same pattern as individual enhancement
        const baseArticleData = {
          title: article.title,
          content: article.content,
          summary: article.summary,
          url: article.url,
          source: article.source,
          category: article.category,
          is_ai_enhanced: true,
          image_url: article.image_url,
          published_at: new Date().toISOString(),
          
          // CRITICAL FIX: Map source_article_id to database original_article_id field
          original_article_id: article.source_article_id || null,
          
          // CRITICAL: Add trilingual tracking as top-level columns for proper sync
          trilingual_batch_id: article.trilingual_batch_id || null,
          language_variant: article.language_variant || null,
          language_order: article.language_order || null,
          quality_score: article.quality_score || null,
          
          // Enhancement metadata (store additional fields here as JSON)
          enhancement_metadata: {
            ...article.enhancement_metadata,
            // Also keep in metadata for backward compatibility
            trilingual_batch_id: article.trilingual_batch_id,
            source_article_id: article.source_article_id,
            language_variant: article.language_variant,
            language_order: article.language_order,
            quality_score: article.quality_score,
            // Store additional enhanced fields in metadata
            key_points: article.key_points,
            why_it_matters: article.why_it_matters,
            structured_sources: article.structured_sources,
            language: article.language,
            enhancedAt: new Date().toISOString(),
            structuredContent: {
              enhancedTitle: article.title,
              enhancedSummary: article.summary,
              keyPoints: article.key_points,
              whyItMatters: article.why_it_matters
            }
          }
        };
        
        // CRITICAL VALIDATION: Ensure original_article_id is set when source_article_id exists
        if (article.source_article_id && !baseArticleData.original_article_id) {
          throw new Error(`CRITICAL: Failed to set original_article_id for enhanced article: ${article.title}. This would create an orphaned article invisible in topics feed.`);
        }
        
        // Log the mapping for verification
        if (article.source_article_id) {
          console.log(`✓ Mapping source_article_id ${article.source_article_id} → original_article_id for: ${article.title}`);
        }
        
        // Insert the article - try with language field first, fallback if it doesn't exist
        let { data, error } = await supabase
          .from('articles')
          .insert([{ ...baseArticleData, language: article.language }])
          .select()
          .single();
        
        // If language column doesn't exist, try without it (same pattern as individual enhancement)
        if (error?.code === '42703' || error?.message?.includes('language')) {
          console.log(`Language column not found, saving without language field for: ${article.title}`);
          const { data: retryData, error: retryError } = await supabase
            .from('articles')
            .insert([baseArticleData])
            .select()
            .single();
          
          data = retryData;
          error = retryError;
        }
        
        if (error) {
          throw error;
        }
        
        if (data) {
          savedArticles.push({
            id: data.id,
            title: data.title,
            url: data.url,
            source: data.source,
            language: data.language,
            quality_score: data.quality_score || 0,
            created_at: data.created_at
          });
          
          console.log(`✓ Saved: ${data.title} (${data.language})`);
        }
        
        return data;
        
      } catch (error) {
        console.error(`Full error details for article "${article.title}":`, error);
        const errorMsg = `Failed to save article "${article.title}" (${article.language}): ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        
        // Log more details about the error
        if (error && typeof error === 'object') {
          console.error('Error code:', (error as any).code);
          console.error('Error details:', (error as any).details);
          console.error('Error hint:', (error as any).hint);
        }
        
        errors.push(errorMsg);
        return null;
      }
    });
    
    await Promise.all(promises);
    
    // Small delay between batches
    if (i + batchSize < articles.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`Successfully saved ${savedArticles.length} out of ${articles.length} articles`);
  
  if (errors.length > 0) {
    console.error('Errors during saving:', errors);
  }
  
  // Log batch summary
  await logBatchSummary(batchId, savedArticles, errors);
  
  return savedArticles;
}

async function logBatchSummary(
  batchId: string,
  savedArticles: SavedArticle[],
  errors: string[]
): Promise<void> {
  try {
    const summary = {
      batch_id: batchId,
      total_saved: savedArticles.length,
      language_breakdown: {
        english: savedArticles.filter(a => a.language === 'en').length,
        traditional_chinese: savedArticles.filter(a => a.language === 'zh-TW').length,
        simplified_chinese: savedArticles.filter(a => a.language === 'zh-CN').length
      },
      errors_count: errors.length,
      errors: errors.slice(0, 5), // Only store first 5 errors
      created_at: new Date().toISOString()
    };
    
    // You could save this to a batch_logs table if needed
    console.log('Batch Summary:', summary);
    
  } catch (error) {
    console.error('Error logging batch summary:', error);
  }
}

// Helper function to update article with enhancement results
export async function updateArticleWithEnhancement(
  articleId: string,
  enhancementData: any
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('articles')
      .update({
        is_ai_enhanced: true,
        enhancement_metadata: enhancementData,
        updated_at: new Date().toISOString()
      })
      .eq('id', articleId);
    
    if (error) {
      console.error(`Error updating article ${articleId}:`, error);
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error(`Error updating article ${articleId}:`, error);
    return false;
  }
}

// Helper function to get batch statistics
export async function getBatchStatistics(batchId: string): Promise<any> {
  try {
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, language, quality_score, created_at')
      .eq('trilingual_batch_id', batchId);
    
    if (error) throw error;
    
    if (!articles || articles.length === 0) {
      return null;
    }
    
    return {
      batchId,
      totalArticles: articles.length,
      languageBreakdown: {
        english: articles.filter(a => a.language === 'en').length,
        traditionalChinese: articles.filter(a => a.language === 'zh-TW').length,
        simplifiedChinese: articles.filter(a => a.language === 'zh-CN').length
      },
      averageQualityScore: articles.reduce((sum, a) => sum + (a.quality_score || 0), 0) / articles.length,
      createdAt: articles[0].created_at
    };
    
  } catch (error) {
    console.error('Error getting batch statistics:', error);
    return null;
  }
}