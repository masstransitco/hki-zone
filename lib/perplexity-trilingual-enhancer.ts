import { perplexityEnhancerV2, type TrilingualResult } from './perplexity-enhancer-v2';
import { perplexityEnhancerV4 } from './perplexity-enhancer-v4';

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
  const failedArticles: { article: SourceArticle; error: any }[] = [];
  
  console.log(`Starting trilingual enhancement for ${sourceArticles.length} articles`);
  
  // Process each source article sequentially to respect rate limits
  for (let i = 0; i < sourceArticles.length; i++) {
    const sourceArticle = sourceArticles[i];
    console.log(`\nProcessing article ${i + 1}/${sourceArticles.length}: ${sourceArticle.title}`);
    
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
      
      console.log(`✅ Successfully enhanced article ${i + 1} in all 3 languages`);
    } catch (error) {
      console.error(`❌ Failed to enhance article ${i + 1}:`, error);
      failedArticles.push({ article: sourceArticle, error });
      
      // Log specific error details
      if (error instanceof Error) {
        console.error(`   Error type: ${error.name}`);
        console.error(`   Error message: ${error.message}`);
        if ('code' in error) {
          console.error(`   Error code: ${(error as any).code}`);
        }
      }
      
      // Continue with next article on error
      console.log('   Continuing with next article...');
    }
  }
  
  // Log summary
  console.log(`\nTrilingual enhancement complete:`);
  console.log(`  Total articles processed: ${sourceArticles.length}`);
  console.log(`  Successfully enhanced: ${results.length / 3} articles (${results.length} versions)`);
  console.log(`  Failed: ${failedArticles.length} articles`);
  
  if (failedArticles.length > 0) {
    console.log('\nFailed articles:');
    failedArticles.forEach(({ article, error }) => {
      console.log(`  - ${article.title} (${article.id})`);
      console.log(`    Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    });
  }
  
  return results;
}

async function enhanceArticleInAllLanguages(
  sourceArticle: SourceArticle,
  batchId: string
): Promise<TrilingualEnhancementResult> {
  const startTime = Date.now();
  const sourceArticleId = sourceArticle.id;
  const timestamp = Date.now();
  
  console.log(`Enhancing "${sourceArticle.title}" (ID: ${sourceArticleId}) in 3 languages...`);
  console.log(`Selection reason: ${sourceArticle.selection_reason || 'Not specified'}`);
  console.log(`Priority score: ${sourceArticle.priority_score || 'Not scored'}`);
  
  // Use two-phase trilingual enhancement for better search results
  console.log('Using two-phase approach: search + augmented generation...');
  let trilingualResult;
  try {
    // Use V4 for two-phase approach if available, fallback to V2
    if (perplexityEnhancerV4 && typeof perplexityEnhancerV4.enhanceTrilingualTwoPhase === 'function') {
      trilingualResult = await perplexityEnhancerV4.enhanceTrilingualTwoPhase(
        sourceArticle.title,
        sourceArticle.content,
        sourceArticle.summary || '',
        { 
          searchDepth: 'high', // Always use high for better results
          recencyFilter: 'day',
          maxTokens: 6000 // Increased to prevent truncation with multiple articles
        }
      );
    } else {
      // Fallback to one-shot V2 approach
      console.log('Falling back to one-shot enhancement...');
      trilingualResult = await perplexityEnhancerV2.enhanceTrilingual(
        sourceArticle.title,
        sourceArticle.content,
        sourceArticle.summary || '',
        { 
          searchDepth: sourceArticle.content.length < 200 ? 'high' : 'low',
          recencyFilter: 'day',
          maxTokens: 3000
        }
      );
    }
  } catch (error) {
    console.error('Error in trilingual enhancement:', error);
    throw new Error(`Trilingual enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Convert trilingual result to enhanced articles
  const enhancedAt = new Date().toISOString();
  
  // Helper function to format content with structure and citations
  const formatContent = (lang: typeof trilingualResult.en, addCitations: boolean = true) => {
    // Add citation references to key points
    const keyPointsWithCitations = lang.key_points.map((point, idx) => {
      // Check if point already has a citation, if not add one
      const citationMatch = point.match(/\[\d+\]$/);
      if (citationMatch || !addCitations) {
        return point;
      }
      // Add citation reference if we have citations
      return lang.citations && lang.citations.length > idx ? `${point}[${idx + 1}]` : point;
    });

    // Format key points with markdown style
    const keyPointsList = keyPointsWithCitations.map(point => {
      // Check if point contains a comma followed by descriptive text
      const commaIndex = point.indexOf('，');
      const colonIndex = point.indexOf('：');
      
      // If there's a comma, bold only the first part
      if (commaIndex > 0 && commaIndex < point.length - 10) {
        const mainPoint = point.substring(0, commaIndex);
        const description = point.substring(commaIndex);
        return `• **${mainPoint}**${description}`;
      }
      // If there's a colon, bold only the first part
      else if (colonIndex > 0 && colonIndex < point.length - 10) {
        const mainPoint = point.substring(0, colonIndex);
        const description = point.substring(colonIndex);
        return `• **${mainPoint}**${description}`;
      }
      // For English, check for comma
      else if (point.includes(', ') && point.indexOf(', ') < point.length - 10) {
        const commaPos = point.indexOf(', ');
        const mainPoint = point.substring(0, commaPos);
        const description = point.substring(commaPos);
        return `• **${mainPoint}**${description}`;
      }
      // Default: bold the entire point
      return `• **${point}**`;
    }).join('\n');

    // Build formatted content
    const formattedSummary = `**Summary**\n${lang.summary}${addCitations && lang.citations?.length ? '[1]' : ''}`;
    const formattedKeyPoints = `\n\n**Key Points**\n${keyPointsList}`;
    const formattedWhyItMatters = `\n\n**Why It Matters**\n${lang.why_it_matters}${addCitations && lang.citations?.length > 1 ? '[2]' : ''}`;
    
    return `${formattedSummary}${formattedKeyPoints}${formattedWhyItMatters}`;
  };
  
  // Helper function to convert citations to source format
  const convertCitations = (citations: Array<{text: string; url: string}>) => {
    if (!citations || !Array.isArray(citations)) return [];
    
    return citations.map((cite, index) => {
      try {
        return {
          url: cite.url || '',
          title: cite.text || `Source ${index + 1}`,
          domain: cite.url ? new URL(cite.url).hostname.replace('www.', '') : 'unknown',
          snippet: cite.text || '',
          accessedAt: enhancedAt
        };
      } catch (error) {
        console.warn(`Invalid citation URL: ${cite.url}`);
        return {
          url: cite.url || '',
          title: cite.text || `Source ${index + 1}`,
          domain: 'unknown',
          snippet: cite.text || '',
          accessedAt: enhancedAt
        };
      }
    });
  };
  
  // Helper function to generate citations text
  const generateCitationsText = (sources: Array<{url: string; title: string; domain: string}>) => {
    if (!sources || sources.length === 0) return '';
    
    const citationsList = sources.map((source, index) => 
      `${index + 1}. [${source.title}](${source.url}) - ${source.domain}`
    ).join('\n\n');
    
    return `\n\n## Sources\n\n${citationsList}\n\n`;
  };
  
  // Convert sources for all languages
  const enSources = convertCitations(trilingualResult.en.citations);
  const zhHKSources = convertCitations(trilingualResult.zh_HK.citations);
  const zhCNSources = convertCitations(trilingualResult.zh_CN.citations);
  
  // 1. English version
  const englishVersion: EnhancedArticle = {
    title: trilingualResult.en.title,
    content: formatContent(trilingualResult.en),
    summary: trilingualResult.en.summary,
    url: `${sourceArticle.url}#enhanced-en-${timestamp}`,
    source: sourceArticle.source,
    category: sourceArticle.category,
    language: 'en',
    is_ai_enhanced: true,
    enhancement_metadata: {
      enhancedTitle: trilingualResult.en.title,
      enhancedSummary: trilingualResult.en.summary,
      enhancedContent: formatContent(trilingualResult.en),
      keyPoints: trilingualResult.en.key_points,
      whyItMatters: trilingualResult.en.why_it_matters,
      sources: enSources,
      language: 'en',
      trilingual_batch_id: batchId,
      source_article_id: sourceArticleId,
      enhanced_at: enhancedAt,
      one_shot_generation: true,
      batchId: batchId,
      citationsText: generateCitationsText(enSources),
      structuredContent: {
        keyPoints: trilingualResult.en.key_points,
        whyItMatters: trilingualResult.en.why_it_matters,
        enhancedTitle: trilingualResult.en.title,
        enhancedSummary: trilingualResult.en.summary
      },
      structured_sources: enSources,
      extractedImages: [],
      relatedTopics: [],
      searchQueries: [],
      language_order: 1,
      language_variant: 'en',
      key_points: trilingualResult.en.key_points,
      why_it_matters: trilingualResult.en.why_it_matters
    },
    trilingual_batch_id: batchId,
    source_article_id: sourceArticleId,
    language_variant: 'en',
    language_order: 1,
    priority_score: sourceArticle.priority_score || 0,
    image_url: sourceArticle.image_url
  };
  
  // 2. Traditional Chinese version
  const traditionalChineseVersion: EnhancedArticle = {
    title: trilingualResult.zh_HK.title,
    content: formatContent(trilingualResult.zh_HK, false),
    summary: trilingualResult.zh_HK.summary,
    url: `${sourceArticle.url}#enhanced-zh-TW-${timestamp}`,
    source: sourceArticle.source,
    category: sourceArticle.category,
    language: 'zh-TW',
    is_ai_enhanced: true,
    enhancement_metadata: {
      enhancedTitle: trilingualResult.zh_HK.title,
      enhancedSummary: trilingualResult.zh_HK.summary,
      enhancedContent: formatContent(trilingualResult.zh_HK, false),
      keyPoints: trilingualResult.zh_HK.key_points,
      whyItMatters: trilingualResult.zh_HK.why_it_matters,
      sources: zhHKSources,
      language: 'zh-TW',
      trilingual_batch_id: batchId,
      source_article_id: sourceArticleId,
      enhanced_at: enhancedAt,
      one_shot_generation: true,
      batchId: batchId,
      citationsText: generateCitationsText(zhHKSources),
      structuredContent: {
        keyPoints: trilingualResult.zh_HK.key_points,
        whyItMatters: trilingualResult.zh_HK.why_it_matters,
        enhancedTitle: trilingualResult.zh_HK.title,
        enhancedSummary: trilingualResult.zh_HK.summary
      },
      structured_sources: zhHKSources,
      extractedImages: [],
      relatedTopics: [],
      searchQueries: [],
      language_order: 2,
      language_variant: 'zh-TW',
      key_points: trilingualResult.zh_HK.key_points,
      why_it_matters: trilingualResult.zh_HK.why_it_matters
    },
    trilingual_batch_id: batchId,
    source_article_id: sourceArticleId,
    language_variant: 'zh-TW',
    language_order: 2,
    priority_score: sourceArticle.priority_score || 0,
    image_url: sourceArticle.image_url
  };
  
  // 3. Simplified Chinese version
  const simplifiedChineseVersion: EnhancedArticle = {
    title: trilingualResult.zh_CN.title,
    content: formatContent(trilingualResult.zh_CN, false),
    summary: trilingualResult.zh_CN.summary,
    url: `${sourceArticle.url}#enhanced-zh-CN-${timestamp}`,
    source: sourceArticle.source,
    category: sourceArticle.category,
    language: 'zh-CN',
    is_ai_enhanced: true,
    enhancement_metadata: {
      enhancedTitle: trilingualResult.zh_CN.title,
      enhancedSummary: trilingualResult.zh_CN.summary,
      enhancedContent: formatContent(trilingualResult.zh_CN, false),
      keyPoints: trilingualResult.zh_CN.key_points,
      whyItMatters: trilingualResult.zh_CN.why_it_matters,
      sources: zhCNSources,
      language: 'zh-CN',
      trilingual_batch_id: batchId,
      source_article_id: sourceArticleId,
      enhanced_at: enhancedAt,
      one_shot_generation: true,
      batchId: batchId,
      citationsText: generateCitationsText(zhCNSources),
      structuredContent: {
        keyPoints: trilingualResult.zh_CN.key_points,
        whyItMatters: trilingualResult.zh_CN.why_it_matters,
        enhancedTitle: trilingualResult.zh_CN.title,
        enhancedSummary: trilingualResult.zh_CN.summary
      },
      structured_sources: zhCNSources,
      extractedImages: [],
      relatedTopics: [],
      searchQueries: [],
      language_order: 3,
      language_variant: 'zh-CN',
      key_points: trilingualResult.zh_CN.key_points,
      why_it_matters: trilingualResult.zh_CN.why_it_matters
    },
    trilingual_batch_id: batchId,
    source_article_id: sourceArticleId,
    language_variant: 'zh-CN',
    language_order: 3,
    priority_score: sourceArticle.priority_score || 0,
    image_url: sourceArticle.image_url
  };
  
  const processingTime = Date.now() - startTime;
  const totalCost = 0.025; // Reduced from $0.075 x 3 to ~$0.025 for one-shot
  
  console.log(`Completed trilingual enhancement in ${Math.round(processingTime / 1000)}s`);
  console.log(`Estimated cost: $${totalCost.toFixed(3)} (66% reduction)`);
  
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