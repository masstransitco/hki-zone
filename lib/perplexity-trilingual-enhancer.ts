import { perplexityEnhancerV2 } from './perplexity-enhancer-v2';

export interface SourceArticle {
  id: string;
  title: string;
  url: string;
  category: string;
  source: string;
  content: string;
  summary?: string;
  published_at: string;
  created_at: string;
  image_url?: string;
  author?: string;
  selection_reason?: string;
  priority_score?: number;
}

export interface EnhancedArticle {
  title: string;
  content: string;
  summary: string;
  url: string;
  source: string;
  category: string;
  language: 'en' | 'zh-TW' | 'zh-CN';
  is_ai_enhanced: boolean;
  enhancement_metadata: any;
  trilingual_batch_id: string;
  source_article_id: string;
  language_variant: string;
  language_order: number;
  priority_score: number;
  image_url?: string;
  key_points?: string[];
  why_it_matters?: string;
  structured_sources?: any;
}

interface TrilingualEnhancementResult {
  sourceArticle: SourceArticle;
  enhancedVersions: {
    english: EnhancedArticle;
    traditionalChinese: EnhancedArticle;
    simplifiedChinese: EnhancedArticle;
  };
  processingTime: number;
  totalCost: number;
}

export async function batchEnhanceTrilingualArticles(
  sourceArticles: SourceArticle[],
  batchId: string
): Promise<EnhancedArticle[]> {
  const results: EnhancedArticle[] = [];
  
  console.log(`Starting trilingual enhancement for ${sourceArticles.length} articles`);
  
  // Process each source article sequentially to respect rate limits
  for (let i = 0; i < sourceArticles.length; i++) {
    const sourceArticle = sourceArticles[i];
    console.log(`Processing article ${i + 1}/${sourceArticles.length}: ${sourceArticle.title}`);
    
    try {
      // Add delay between articles (except for the first one)
      if (i > 0) {
        console.log('Rate limiting: waiting 2 seconds before next article...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      const trilingualResult = await enhanceArticleInAllLanguages(sourceArticle, batchId);
      
      // Add all three language versions to results
      results.push(trilingualResult.enhancedVersions.english);
      results.push(trilingualResult.enhancedVersions.traditionalChinese);
      results.push(trilingualResult.enhancedVersions.simplifiedChinese);
      
      console.log(`Successfully enhanced article ${i + 1} in all 3 languages`);
    } catch (error) {
      console.error(`Failed to enhance article ${i + 1}:`, error);
      // Continue with next article on error
    }
  }
  
  console.log(`Trilingual enhancement complete. Total articles: ${results.length}`);
  return results;
}

async function enhanceArticleInAllLanguages(
  sourceArticle: SourceArticle,
  batchId: string
): Promise<TrilingualEnhancementResult> {
  const startTime = Date.now();
  const sourceArticleId = sourceArticle.id;
  
  console.log(`Enhancing "${sourceArticle.title}" (ID: ${sourceArticleId}) in 3 languages...`);
  console.log(`Selection reason: ${sourceArticle.selection_reason || 'Not specified'}`);
  console.log(`Priority score: ${sourceArticle.priority_score || 'Not scored'}`);
  
  // Sequential processing with rate limiting between languages
  
  // 1. English version
  console.log('Creating English version...');
  const englishResult = await perplexityEnhancerV2.enhanceArticle(
    sourceArticle.title,
    sourceArticle.content,
    sourceArticle.summary || '',
    { 
      language: 'en',
      searchDepth: 'high',
      recencyFilter: 'week',
      maxTokens: 2000
    }
  );
  
  const englishVersion: EnhancedArticle = {
    title: englishResult.enhancedTitle || sourceArticle.title,
    content: englishResult.enhancedContent,
    summary: englishResult.enhancedSummary || '',
    url: `${sourceArticle.url}#enhanced-en-${Date.now()}`, // Make URL unique per language
    source: sourceArticle.source,
    category: sourceArticle.category,
    language: 'en',
    is_ai_enhanced: true,
    enhancement_metadata: {
      ...englishResult,
      language: 'en',
      batchId,
      sourceArticleId,
      enhancedAt: new Date().toISOString(),
      // Store AI-generated images in metadata (same as manual enhancement)
      extractedImages: englishResult.extractedImages
    },
    trilingual_batch_id: batchId,
    source_article_id: sourceArticleId,
    language_variant: 'en',
    language_order: 1,
    priority_score: sourceArticle.priority_score || 0,
    image_url: sourceArticle.image_url, // Preserve original article image (same as manual enhancement)
    key_points: englishResult.keyPoints,
    why_it_matters: englishResult.whyItMatters,
    structured_sources: englishResult.sources
  };
  
  // Rate limit between languages
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // 2. Traditional Chinese version
  console.log('Creating Traditional Chinese version...');
  const traditionalChineseResult = await perplexityEnhancerV2.enhanceArticle(
    sourceArticle.title,
    sourceArticle.content,
    sourceArticle.summary || '',
    { 
      language: 'zh-TW',
      searchDepth: 'high',
      recencyFilter: 'week',
      maxTokens: 2000
    }
  );
  
  const traditionalChineseVersion: EnhancedArticle = {
    title: traditionalChineseResult.enhancedTitle || sourceArticle.title,
    content: traditionalChineseResult.enhancedContent,
    summary: traditionalChineseResult.enhancedSummary || '',
    url: `${sourceArticle.url}#enhanced-zh-TW-${Date.now()}`, // Make URL unique per language
    source: sourceArticle.source,
    category: sourceArticle.category,
    language: 'zh-TW',
    is_ai_enhanced: true,
    enhancement_metadata: {
      ...traditionalChineseResult,
      language: 'zh-TW',
      batchId,
      sourceArticleId,
      enhancedAt: new Date().toISOString(),
      // Store AI-generated images in metadata (same as manual enhancement)
      extractedImages: traditionalChineseResult.extractedImages
    },
    trilingual_batch_id: batchId,
    source_article_id: sourceArticleId,
    language_variant: 'zh-TW',
    language_order: 2,
    priority_score: sourceArticle.priority_score || 0,
    image_url: sourceArticle.image_url, // Preserve original article image (same as manual enhancement)
    key_points: traditionalChineseResult.keyPoints,
    why_it_matters: traditionalChineseResult.whyItMatters,
    structured_sources: traditionalChineseResult.sources
  };
  
  // Rate limit between languages
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // 3. Simplified Chinese version
  console.log('Creating Simplified Chinese version...');
  const simplifiedChineseResult = await perplexityEnhancerV2.enhanceArticle(
    sourceArticle.title,
    sourceArticle.content,
    sourceArticle.summary || '',
    { 
      language: 'zh-CN',
      searchDepth: 'high',
      recencyFilter: 'week',
      maxTokens: 2000
    }
  );
  
  const simplifiedChineseVersion: EnhancedArticle = {
    title: simplifiedChineseResult.enhancedTitle || sourceArticle.title,
    content: simplifiedChineseResult.enhancedContent,
    summary: simplifiedChineseResult.enhancedSummary || '',
    url: `${sourceArticle.url}#enhanced-zh-CN-${Date.now()}`, // Make URL unique per language
    source: sourceArticle.source,
    category: sourceArticle.category,
    language: 'zh-CN',
    is_ai_enhanced: true,
    enhancement_metadata: {
      ...simplifiedChineseResult,
      language: 'zh-CN',
      batchId,
      sourceArticleId,
      enhancedAt: new Date().toISOString(),
      // Store AI-generated images in metadata (same as manual enhancement)
      extractedImages: simplifiedChineseResult.extractedImages
    },
    trilingual_batch_id: batchId,
    source_article_id: sourceArticleId,
    language_variant: 'zh-CN',
    language_order: 3,
    priority_score: sourceArticle.priority_score || 0,
    image_url: sourceArticle.image_url, // Preserve original article image (same as manual enhancement)
    key_points: simplifiedChineseResult.keyPoints,
    why_it_matters: simplifiedChineseResult.whyItMatters,
    structured_sources: simplifiedChineseResult.sources
  };
  
  const processingTime = Date.now() - startTime;
  const totalCost = 0.075 * 3; // Estimate $0.075 per article * 3 languages
  
  console.log(`Completed trilingual enhancement in ${Math.round(processingTime / 1000)}s`);
  
  return {
    sourceArticle,
    enhancedVersions: {
      english: englishVersion,
      traditionalChinese: traditionalChineseVersion,
      simplifiedChinese: simplifiedChineseVersion
    },
    processingTime,
    totalCost
  };
}