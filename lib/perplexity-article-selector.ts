import { createClient } from '@supabase/supabase-js';
import { deduplicateStories, type DeduplicationResult } from './story-deduplicator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export interface CandidateArticle {
  id: string;
  title: string;
  summary?: string;
  content: string;
  url: string;
  source: string;
  category: string;
  published_at: string;
  created_at: string;
  image_url?: string;
  author?: string;
  content_length: number;
  has_summary: boolean;
  has_image: boolean;
}

export interface SelectedArticle extends CandidateArticle {
  selection_reason: string;
  priority_score: number;
}

// Source diversity quota system
interface TierConfig {
  sources: string[];
  quota: number;
  maxAgeHours: number;
  minQuality: number;
  weight: number;
}

const SOURCE_TIERS: Record<string, TierConfig> = {
  premium: {
    sources: ['HKFP', 'scmp', 'bloomberg', 'TheStandard'],
    quota: 15,        // Higher quota for premium sources
    maxAgeHours: 12,  // Longer time window due to lower frequency
    minQuality: 200,  // Higher content threshold
    weight: 100       // Highest quality weight
  },
  mainstream: {
    sources: ['RTHK', 'SingTao', 'on.cc'],
    quota: 25,        // Moderate quota
    maxAgeHours: 6,   // Standard time window
    minQuality: 100,  // Moderate content threshold
    weight: 80        // Good quality weight
  },
  local: {
    sources: ['HK01', 'am730', 'bastillepost'],
    quota: 12,        // Slightly increased quota for 3 sources
    maxAgeHours: 3,   // Shorter window due to high frequency
    minQuality: 50,   // Lower threshold for Chinese content
    weight: 60        // Moderate quality weight
  }
};

const SOURCE_QUALITY_WEIGHTS: Record<string, number> = {
  'HKFP': 100,        // Premium investigative journalism
  'scmp': 95,         // International quality
  'TheStandard': 92,  // Quality English news
  'bloomberg': 90,    // Financial expertise
  'RTHK': 85,         // Public broadcaster reliability
  'SingTao': 70,      // Mainstream reliability
  'on.cc': 65,        // Popular but mixed quality
  'HK01': 60,         // High volume, variable quality
  'am730': 55,        // Lifestyle focus
  'bastillepost': 58  // Local news focus with opinion pieces
};

// Feature flags for optimization experiments
const FEATURE_FLAGS = {
  DYNAMIC_SCORE_THRESHOLD: process.env.DYNAMIC_SCORE_THRESHOLD !== 'false',
  FLEXIBLE_ARTICLE_COUNT: process.env.FLEXIBLE_ARTICLE_COUNT === 'true',
  BREAKING_NEWS_FAST_LANE: process.env.BREAKING_NEWS_FAST_LANE === 'true',
};

// Breaking news detection keywords
const BREAKING_NEWS_KEYWORDS = [
  'breaking', 'just in', 'developing', 'urgent', 'alert',
  '突發', '快訊', '最新', '緊急', '即時'
];

// Calculate dynamic score threshold based on candidate distribution
function calculateDynamicThreshold(scores: number[]): { threshold: number; method: string } {
  if (!FEATURE_FLAGS.DYNAMIC_SCORE_THRESHOLD || scores.length < 3) {
    return { threshold: 80, method: 'fixed' };
  }

  const sortedScores = [...scores].sort((a, b) => b - a);
  const MIN_THRESHOLD = 65;
  const MAX_THRESHOLD = 85;
  const TARGET_PERCENTILE = 0.3; // Top 30% of candidates

  // Calculate percentile-based threshold
  const targetIndex = Math.floor(scores.length * TARGET_PERCENTILE);
  const percentileThreshold = sortedScores[targetIndex] || sortedScores[sortedScores.length - 1];

  // Calculate median for context
  const medianIndex = Math.floor(scores.length / 2);
  const medianScore = sortedScores[medianIndex];

  // Dynamic threshold: use percentile but clamp to bounds
  let dynamicThreshold = Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, percentileThreshold));

  // In low-quality periods (median < 70), lower the threshold
  if (medianScore < 70) {
    dynamicThreshold = Math.max(MIN_THRESHOLD, dynamicThreshold - 10);
  }

  console.log(`📊 Dynamic threshold calculation:`);
  console.log(`   • Scores: min=${Math.min(...scores)}, median=${medianScore}, max=${Math.max(...scores)}`);
  console.log(`   • Target percentile (top 30%): ${percentileThreshold}`);
  console.log(`   • Dynamic threshold: ${dynamicThreshold} (bounds: ${MIN_THRESHOLD}-${MAX_THRESHOLD})`);

  return { threshold: dynamicThreshold, method: 'dynamic' };
}

// Check if article is breaking news
function isBreakingNews(title: string, content: string): boolean {
  const text = (title + ' ' + content).toLowerCase();
  return BREAKING_NEWS_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
}

// Calculate recency bonus for article (articles < 2 hours get boost)
function getRecencyBonus(createdAt: string): number {
  const hoursAgo = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  if (hoursAgo <= 1) return 10;  // Very fresh: +10
  if (hoursAgo <= 2) return 7;   // Fresh: +7
  if (hoursAgo <= 4) return 3;   // Recent: +3
  return 0;
}

export async function selectArticlesWithPerplexity(count: number = 10): Promise<SelectedArticle[]> {
  const sessionId = `selection_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  console.log(`🚀 Starting Perplexity-assisted article selection for ${count} articles (Session: ${sessionId})`);

  // 1. Get candidate articles from database using diversity quotas
  console.log(`🔍 Fetching candidate articles with source diversity...`);
  let candidateArticles = await getCandidateArticlesWithDiversity();
  
  if (candidateArticles.length === 0) {
    console.log(`❌ No candidate articles found. Checking why...`);
    // Debug: Check what's available in the database
    const debugInfo = await debugArticleAvailability();
    console.log('Debug info:', debugInfo);
    throw new Error('No candidate articles found for selection');
  }

  console.log(`📊 Selection Statistics (${sessionId}):`);
  console.log(`   • Found ${candidateArticles.length} candidate articles from last 6 hours`);
  console.log(`   • Sources: ${[...new Set(candidateArticles.map(a => a.source))].join(', ')}`);
  console.log(`   • Categories: ${[...new Set(candidateArticles.map(a => a.category))].join(', ')}`);
  console.log(`   • Date range: ${candidateArticles[candidateArticles.length - 1]?.created_at?.substring(0, 16)} to ${candidateArticles[0]?.created_at?.substring(0, 16)}`);
  console.log(`   • Time window: Last 6 hours (recent news priority)`);

  // 1.5 NEW: Deduplicate stories from different sources using embeddings + NLP
  let deduplicationResult: DeduplicationResult | null = null;
  
  // Check if embeddings deduplication is enabled
  const enableStoryDedup = process.env.ENABLE_STORY_DEDUP !== 'false';
  
  if (enableStoryDedup && candidateArticles.length > 5) {
    console.log(`\n🧬 Cross-Source Story Deduplication (${sessionId}):`);
    console.log(`   • Running advanced deduplication using embeddings + NLP...`);
    
    try {
      deduplicationResult = await deduplicateStories(candidateArticles, sessionId);
      candidateArticles = deduplicationResult.uniqueArticles;
      
      // Log deduplication statistics
      if (deduplicationResult.duplicatesRemoved > 0) {
        console.log(`   ✅ Deduplication successful:`);
        console.log(`      • Original articles: ${deduplicationResult.stats.originalCount}`);
        console.log(`      • Unique stories: ${deduplicationResult.stats.uniqueStories}`);
        console.log(`      • Duplicates removed: ${deduplicationResult.duplicatesRemoved}`);
        console.log(`      • Average cluster size: ${deduplicationResult.stats.averageClusterSize.toFixed(1)}`);
        console.log(`      • Largest cluster: ${deduplicationResult.stats.largestCluster} articles`);
      } else {
        console.log(`   • No cross-source duplicates found`);
      }
    } catch (error) {
      console.error(`   ⚠️ Cross-source deduplication failed:`, error);
      console.log(`   • Continuing with original ${candidateArticles.length} articles`);
      // Continue with original articles if deduplication fails
    }
  } else if (!enableStoryDedup) {
    console.log(`   • Cross-source deduplication disabled (ENABLE_STORY_DEDUP=false)`);
  } else {
    console.log(`   • Skipping cross-source deduplication (too few articles: ${candidateArticles.length})`);
  }

  // 2. Get recently enhanced topics for deduplication
  const recentlyEnhancedTopics = await getRecentlyEnhancedTopics();
  console.log(`🔍 Deduplication Check (${sessionId}):`);
  console.log(`   • Found ${recentlyEnhancedTopics.length} recently enhanced topics for comparison`);
  
  // Enhanced logging: Show the enhanced topics we're comparing against
  if (recentlyEnhancedTopics.length > 0) {
    console.log('📋 Recently enhanced topics to avoid duplicating:');
    recentlyEnhancedTopics.forEach((topic, index) => {
      const date = new Date(topic.created_at).toLocaleDateString();
      console.log(`   ${index + 1}. [${date}] "${topic.title?.substring(0, 60)}..."`);
    });
  }

  // 3. Filter out articles with similar topics to recently enhanced ones
  const beforeDedup = candidateArticles.length;
  const deduplicatedArticles = await filterSimilarTopics(candidateArticles, recentlyEnhancedTopics);
  const afterDedup = deduplicatedArticles.length;
  const filteredCount = beforeDedup - afterDedup;
  
  console.log(`📈 Deduplication Results (${sessionId}):`);
  console.log(`   • Before deduplication: ${beforeDedup} articles`);
  console.log(`   • After deduplication: ${afterDedup} articles`);
  console.log(`   • Filtered out: ${filteredCount} articles (${Math.round(filteredCount / beforeDedup * 100)}%)`);
  console.log(`   • Deduplication effectiveness: ${filteredCount > 0 ? 'ACTIVE' : 'NO DUPLICATES FOUND'}`);

  if (deduplicatedArticles.length === 0) {
    console.log(`❌ Selection Failed (${sessionId}): All candidate articles are similar to recently enhanced topics`);
    throw new Error('No unique articles found after topic deduplication');
  }

  // 4. Create selection prompt for Perplexity using deduplicated articles
  console.log(`🔍 First 5 articles being sent to Perplexity for selection (newest first):`);
  deduplicatedArticles.slice(0, 5).forEach((article, index) => {
    const timeAgo = getTimeAgo(new Date(article.created_at));
    console.log(`   ${index + 1}. [${timeAgo}] "${article.title.substring(0, 60)}..." (ID: ${article.id})`);
  });
  
  // Add debug to show last 5 articles
  console.log(`📅 Last 5 articles in the list (oldest):`);
  deduplicatedArticles.slice(-5).forEach((article, index) => {
    const timeAgo = getTimeAgo(new Date(article.created_at));
    const actualIndex = deduplicatedArticles.length - 5 + index;
    console.log(`   ${actualIndex + 1}. [${timeAgo}] "${article.title.substring(0, 60)}..." (ID: ${article.id})`);
  });
  
  // Limit candidates to top 15 by content quality + recency to reduce token usage
  const topCandidates = deduplicatedArticles
    .sort((a, b) => {
      // Sort by content length + recency score
      const aScore = a.content_length + (24 - getHoursAgo(new Date(a.created_at))) * 10;
      const bScore = b.content_length + (24 - getHoursAgo(new Date(b.created_at))) * 10;
      return bScore - aScore;
    })
    .slice(0, 15);
  
  console.log(`🎯 Sending top ${topCandidates.length} candidates to Perplexity (from ${deduplicatedArticles.length} available)`);
  
  const selectionPrompt = createArticleSelectionPrompt(topCandidates, count, recentlyEnhancedTopics);

  // 5. Call Perplexity API for intelligent selection
  const selectedIds = await callPerplexityForSelection(selectionPrompt);

  // 6. Map selected IDs back to full article objects
  console.log(`DEBUG: Perplexity returned ${selectedIds.length} selections`);
  console.log(`DEBUG: Available top candidate count: ${topCandidates.length} articles`);
  
  // Map sequential numbers (01, 02, 03...) back to top candidate articles
  const selectedArticles = selectedIds
    .map(selection => {
      // Remove leading zeros from ID
      const numericId = selection.id.replace(/^0+/, '') || '0';
      
      if (!/^\d+$/.test(numericId)) {
        console.log(`DEBUG: Invalid selection ID format: ${selection.id} (expected number)`);
        return null;
      }
      
      const index = parseInt(numericId) - 1; // Convert "1" to index 0, "2" to index 1, etc.
      
      if (index < 0 || index >= topCandidates.length) {
        console.log(`DEBUG: Selection ID ${selection.id} out of range (1-${topCandidates.length})`);
        return null;
      }
      
      const article = topCandidates[index];
      console.log(`DEBUG: Mapped selection ${selection.id} to article ${article.id} (${article.title.substring(0, 50)}...)`);
      
      // Generate selection reason from rubric scores
      const scoreBreakdown = `I:${selection.I || 0} N:${selection.N || 0} D:${selection.D || 0} S:${selection.S || 0} U:${selection.U || 0}`;
      const reason = `Selected with score ${selection.score} (${scoreBreakdown}) - High ${selection.I >= 4 ? 'impact' : selection.U >= 4 ? 'underserved topic' : selection.N >= 4 ? 'novelty' : 'value'} for HK readers`;
      
      return {
        ...article,
        selection_reason: reason,
        priority_score: selection.score
      };
    })
    .filter(article => article !== null) as SelectedArticle[];

  console.log(`Perplexity selected ${selectedArticles.length} articles for enhancement`);
  
  // Mark selected articles to prevent re-selection in future runs
  if (selectedArticles.length > 0) {
    await markArticlesAsSelected(selectedArticles, selectedIds, sessionId, deduplicationResult);
  }
  
  if (selectedArticles.length === 0 && selectedIds.length > 0) {
    console.error(`❌ Selection Mapping Error (${sessionId}): Perplexity selections did not map to any candidate articles`);
    console.error('Selected IDs:', selectedIds.map(s => s.id));
    console.error('Valid range: 1 to', topCandidates.length);
    
    // Fallback: if no articles selected but we have candidates, pick the most recent ones
    console.log(`🔄 Fallback Selection (${sessionId}): Selecting ${count} most recent articles`);
    const fallbackArticles = topCandidates
      .slice(0, count)
      .map((article, index) => ({
        ...article,
        selection_reason: 'Fallback selection - most recent article due to Perplexity selection mapping failure',
        priority_score: 75 // Default score for fallback
      }));
    
    // Mark fallback articles as selected too
    if (fallbackArticles.length > 0) {
      const fallbackSelections = fallbackArticles.map((_, index) => ({
        id: `fallback-${index + 1}`,
        I: 3, N: 3, D: 3, S: 3, U: 3, // Average scores for fallback
        score: 75
      }));
      await markArticlesAsSelected(fallbackArticles, fallbackSelections, sessionId);
    }
    
    console.log(`✅ Fallback Complete (${sessionId}): Selected ${fallbackArticles.length} articles`);
    return fallbackArticles;
  }

  // Final selection summary
  console.log(`✅ Selection Complete (${sessionId}):`);
  console.log(`   • Successfully selected: ${selectedArticles.length} articles`);
  console.log(`   • AI selection accuracy: ${Math.round(selectedArticles.length / selectedIds.length * 100)}%`);
  console.log(`   • Selected articles:`);
  selectedArticles.forEach((article, index) => {
    console.log(`     ${index + 1}. [${article.source}] "${article.title.substring(0, 50)}..." (Score: ${article.priority_score})`);
  });
  
  return selectedArticles;
}

async function getCandidateArticles(): Promise<CandidateArticle[]> {
  try {
    // Get recent scraped articles that haven't been AI enhanced and haven't been selected before
    const scrapedSources = ['HKFP', 'SingTao', 'HK01', 'on.cc', 'RTHK', 'am730', 'scmp', 'bloomberg', 'TheStandard', 'bastillepost'];  // Note: am730, scmp, bloomberg, and bastillepost are lowercase in database
    
    // First, get recently selected article titles to avoid re-selecting similar content
    const { data: recentlySelected } = await supabase
      .from('articles')
      .select('title, selection_metadata')
      .eq('selected_for_enhancement', true)
      .gte('created_at', getDateDaysAgo(1)) // Check last 1 day only to avoid being too restrictive
      .order('created_at', { ascending: false })
      .limit(100);
      
    const recentTitles = new Set((recentlySelected || []).map(a => 
      a.title.trim().toLowerCase().replace(/\s+/g, ' ').substring(0, 50)
    ));
    
    console.log(`📋 Found ${recentTitles.size} recently selected article titles to avoid`);
    
    // First, get articles that have been selected but not enhanced for over 4 hours
    const fourHoursAgo = getDateHoursAgo(4);
    const { data: staleSelections } = await supabase
      .from('articles')
      .select('id')
      .eq('selected_for_enhancement', true)
      .eq('is_ai_enhanced', false)
      .lt('selection_metadata->selected_at', fourHoursAgo)
      .limit(20);
    
    if (staleSelections && staleSelections.length > 0) {
      console.log(`🔄 Found ${staleSelections.length} stale selections (selected >4 hours ago but not enhanced)`);
      // Reset these articles to allow re-selection
      const staleIds = staleSelections.map(a => a.id);
      await supabase
        .from('articles')
        .update({ 
          selected_for_enhancement: false,
          selection_metadata: null 
        })
        .in('id', staleIds);
      console.log(`   ✅ Reset stale selections to allow re-selection`);
    }

    // Enhanced candidate selection with additional safety checks
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .is('is_ai_enhanced', false) // Only non-enhanced articles
      .is('selected_for_enhancement', false) // Only articles never selected before (or reset)
      .in('source', scrapedSources) // Only scraped sources (not AI-generated)
      .gte('created_at', getDateHoursAgo(6)) // Last 6 hours - focus on recent news
      .not('content', 'is', null) // Must have content
      .is('enhancement_metadata->source_article_status', null) // Exclude already processed source articles
      .order('created_at', { ascending: false })
      .limit(50) // Get up to 50 candidates for Perplexity to choose from

    if (error) throw error;

    if (!articles || articles.length === 0) {
      return [];
    }

    // Transform and enrich articles with metadata
    const candidateArticles: CandidateArticle[] = articles
      .map(article => ({
        id: article.id,
        title: article.title,
        summary: article.summary,
        content: article.content,
        url: article.url,
        source: article.source,
        category: article.category || 'general',
        published_at: article.published_at,
        created_at: article.created_at,
        image_url: article.image_url,
        author: article.author,
        content_length: article.content?.length || 0,
        has_summary: !!(article.summary && article.summary.length > 50),
        has_image: !!article.image_url
      }))
      .filter(article => {
        // Filter out articles with similar titles to recently selected ones
        const normalizedTitle = article.title.trim().toLowerCase().replace(/\s+/g, ' ').substring(0, 50);
        if (recentTitles.has(normalizedTitle)) {
          console.log(`     ⚠️ Filtered "${article.title.substring(0, 50)}..." - similar article recently selected`);
          return false;
        }
        
        // Additional safety check: exclude articles that may have enhancement metadata indicating processing
        if (article.enhancement_metadata?.source_article_status === 'enhanced_children_created') {
          console.log(`     ⚠️ Filtered "${article.title.substring(0, 50)}..." - already processed (has enhanced children)`);
          return false;
        }
        
        return true;
      });

    // Enhanced quality filtering with detailed logging
    console.log(`📊 Content Quality Analysis:`);
    console.log(`   • Initial candidates: ${candidateArticles.length}`);
    
    // Analyze content lengths for logging
    const contentLengths = candidateArticles.map(a => a.content_length).sort((a, b) => b - a);
    console.log(`   • Content length range: ${contentLengths[0]} to ${contentLengths[contentLengths.length - 1]} characters`);
    console.log(`   • Median content length: ${contentLengths[Math.floor(contentLengths.length / 2)]} characters`);
    
    // Count articles by content length thresholds
    const over200 = candidateArticles.filter(a => a.content_length > 200).length;
    const over100 = candidateArticles.filter(a => a.content_length > 100).length;
    const over50 = candidateArticles.filter(a => a.content_length > 50).length;
    
    console.log(`   • Articles > 200 chars: ${over200} (${Math.round(over200/candidateArticles.length*100)}%)`);
    console.log(`   • Articles > 100 chars: ${over100} (${Math.round(over100/candidateArticles.length*100)}%)`);
    console.log(`   • Articles > 50 chars: ${over50} (${Math.round(over50/candidateArticles.length*100)}%)`);
    
    // Source distribution analysis
    const sourceBreakdown = candidateArticles.reduce((acc: any, article) => {
      if (!acc[article.source]) acc[article.source] = { count: 0, avgLength: 0, lengths: [] };
      acc[article.source].count++;
      acc[article.source].lengths.push(article.content_length);
      return acc;
    }, {});
    
    console.log(`   • Source breakdown:`);
    Object.entries(sourceBreakdown).forEach(([source, data]: [string, any]) => {
      const avgLength = Math.round(data.lengths.reduce((a: number, b: number) => a + b, 0) / data.lengths.length);
      console.log(`     - ${source}: ${data.count} articles, avg ${avgLength} chars`);
    });

    // CRITICAL: Title-based deduplication to prevent same article from multiple URLs
    console.log(`🔍 Title-based deduplication analysis:`);
    const titleMap = new Map();
    candidateArticles.forEach(article => {
      // Normalize title more aggressively
      const normalizedTitle = article.title
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .replace(/[^\w\s\u4e00-\u9fff]/g, '') // Remove special chars but keep Chinese
        .substring(0, 50); // Use first 50 chars to catch minor variations
        
      if (!titleMap.has(normalizedTitle)) {
        titleMap.set(normalizedTitle, []);
      }
      titleMap.get(normalizedTitle).push(article);
    });

    const duplicateTitles = Array.from(titleMap.entries()).filter(([title, articles]) => articles.length > 1);
    console.log(`   • Found ${duplicateTitles.length} titles with multiple URLs`);
    
    if (duplicateTitles.length > 0) {
      console.log(`   • Duplicate titles to resolve:`);
      duplicateTitles.forEach(([title, articles]) => {
        console.log(`     - "${title.substring(0, 50)}..." (${articles.length} versions)`);
        articles.forEach((article, index) => {
          console.log(`       ${index + 1}. Content: ${article.content_length} chars | URL: ${article.url.substring(0, 80)}...`);
        });
      });
    }

    // Deduplicate by title - keep the version with the most content
    const deduplicatedCandidates = Array.from(titleMap.entries()).map(([title, articles]) => {
      if (articles.length === 1) {
        return articles[0];
      }
      
      // Keep the article with the most content, or most recent if content is equal
      const bestArticle = articles.reduce((best, current) => {
        if (current.content_length > best.content_length) {
          return current;
        } else if (current.content_length === best.content_length) {
          // If content length is equal, prefer more recent
          return new Date(current.created_at) > new Date(best.created_at) ? current : best;
        }
        return best;
      });
      
      const filtered = articles.filter(a => a.id !== bestArticle.id);
      console.log(`   ⚠️ Removed ${filtered.length} duplicate(s) for "${title.substring(0, 40)}..."`);
      filtered.forEach(article => {
        console.log(`     - Removed: ${article.content_length} chars | ${article.url.substring(0, 60)}...`);
      });
      console.log(`     ✅ Kept: ${bestArticle.content_length} chars | ${bestArticle.url.substring(0, 60)}...`);
      
      return bestArticle;
    });
    
    console.log(`📈 Title Deduplication Results:`);
    console.log(`   • Before deduplication: ${candidateArticles.length} articles`);
    console.log(`   • After deduplication: ${deduplicatedCandidates.length} articles`);
    console.log(`   • Removed: ${candidateArticles.length - deduplicatedCandidates.length} duplicate titles`);

    // Use deduplicated candidates for further filtering
    const candidatesForQualityCheck = deduplicatedCandidates;
    
    // Additional URL-based deduplication
    console.log(`🔗 URL-based deduplication analysis:`);
    const urlMap = new Map();
    candidatesForQualityCheck.forEach(article => {
      // Normalize URL for comparison
      const normalizedUrl = article.url
        .toLowerCase()
        .replace(/^https?:\/\/(www\.)?/, '') // Remove protocol and www
        .replace(/\/$/, '') // Remove trailing slash
        .replace(/[?#].*$/, ''); // Remove query params and fragments
        
      if (!urlMap.has(normalizedUrl)) {
        urlMap.set(normalizedUrl, []);
      }
      urlMap.get(normalizedUrl).push(article);
    });
    
    const duplicateUrls = Array.from(urlMap.entries()).filter(([url, articles]) => articles.length > 1);
    if (duplicateUrls.length > 0) {
      console.log(`   • Found ${duplicateUrls.length} duplicate URLs after normalization`);
      duplicateUrls.forEach(([url, articles]) => {
        console.log(`     - URL: ${url}`);
        articles.forEach(article => {
          console.log(`       ${article.id}: ${article.title.substring(0, 40)}...`);
        });
      });
    }

    // Headline-based selection - focus on title quality for Perplexity selection
    const qualityArticles = candidatesForQualityCheck.filter(article => {
      // Only filter out articles with clearly problematic titles
      if (!article.title || article.title.length < 5) {
        console.log(`     ❌ Filtered "${article.title}" - title too short or missing`);
        return false;
      }
      
      // Filter out obvious test/spam articles by title patterns
      const titleLower = article.title.toLowerCase();
      if (titleLower.includes('test') || titleLower.includes('測試') || titleLower === 'title') {
        console.log(`     ❌ Filtered "${article.title}" - appears to be test content`);
        return false;
      }
      
      // CRITICAL: Filter out articles with insufficient content to prevent AI hallucination
      if (article.content_length < 50) {
        console.log(`     ⚠️ Filtered "${article.title.substring(0, 50)}..." - insufficient content (${article.content_length} chars) may cause AI hallucination`);
        return false;
      }
      
      // Accept articles that pass all filters
      console.log(`     ✅ Accepted "${article.title.substring(0, 50)}..." (${article.content_length} chars) - content meets minimum threshold`);
      return true;
    });

    console.log(`📈 Quality Filtering Results:`);
    console.log(`   • Passed quality filters: ${qualityArticles.length} of ${candidatesForQualityCheck.length} (${Math.round(qualityArticles.length/candidatesForQualityCheck.length*100)}%)`);
    console.log(`   • Sources represented: ${[...new Set(qualityArticles.map(a => a.source))].join(', ')}`);
    
    if (qualityArticles.length > 0) {
      console.log(`   • Average content length: ${Math.round(qualityArticles.reduce((sum, a) => sum + a.content_length, 0) / qualityArticles.length)} characters`);
    }
    
    // Note: No fallback needed - headline-based selection should provide sufficient candidates
    
    return qualityArticles;

  } catch (error) {
    console.error('Error fetching candidate articles:', error);
    throw new Error('Failed to fetch candidate articles from database');
  }
}

// NEW: Source diversity quota system implementation
async function getCandidateArticlesWithDiversity(): Promise<CandidateArticle[]> {
  try {
    console.log(`🎯 Using source diversity quota system for balanced selection`);
    const allCandidates: CandidateArticle[] = [];
    
    // Step 1: Collect candidates from each tier with their quotas
    for (const [tierName, config] of Object.entries(SOURCE_TIERS)) {
      const tierCandidates = await getTierCandidates(tierName, config);
      console.log(`📊 ${tierName} tier: ${tierCandidates.length}/${config.quota} articles (${config.sources.join(', ')})`);
      allCandidates.push(...tierCandidates);
    }
    
    if (allCandidates.length === 0) {
      console.log(`⚠️ No candidates found across all tiers, falling back to original method...`);
      return await getCandidateArticles();
    }
    
    // Step 2: Apply quality-weighted sorting
    const sortedCandidates = allCandidates.sort((a, b) => {
      const aScore = calculateQualityScore(a);
      const bScore = calculateQualityScore(b);
      return bScore - aScore;
    });
    
    // Step 3: Apply same deduplication as original system
    const deduplicatedCandidates = await applyDeduplication(sortedCandidates);
    
    console.log(`✅ Diversity system results:`);
    console.log(`   • Total collected: ${allCandidates.length} articles`);
    console.log(`   • After deduplication: ${deduplicatedCandidates.length} articles`);
    console.log(`   • Source distribution: ${getSourceDistribution(deduplicatedCandidates)}`);
    
    return deduplicatedCandidates;
    
  } catch (error) {
    console.error('❌ Error in diversity system, falling back to original method:', error);
    return await getCandidateArticles();
  }
}

async function getTierCandidates(tierName: string, config: TierConfig): Promise<CandidateArticle[]> {
  // Get recently selected article titles to avoid re-selecting similar content  
  const { data: recentlySelected } = await supabase
    .from('articles')
    .select('title, selection_metadata')
    .eq('selected_for_enhancement', true)
    .gte('created_at', getDateDaysAgo(1))
    .order('created_at', { ascending: false })
    .limit(100);
    
  const recentTitles = new Set((recentlySelected || []).map(a => 
    a.title.trim().toLowerCase().replace(/\s+/g, ' ').substring(0, 50)
  ));
  
  // Reset stale selections (selected >4 hours ago but not enhanced)
  const fourHoursAgo = getDateHoursAgo(4);
  const { data: staleSelections } = await supabase
    .from('articles')
    .select('id')
    .eq('selected_for_enhancement', true)
    .eq('is_ai_enhanced', false)
    .lt('selection_metadata->selected_at', fourHoursAgo)
    .in('source', config.sources)
    .limit(20);
  
  if (staleSelections && staleSelections.length > 0) {
    const staleIds = staleSelections.map(a => a.id);
    await supabase
      .from('articles')
      .update({ 
        selected_for_enhancement: false,
        selection_metadata: null 
      })
      .in('id', staleIds);
    console.log(`   🔄 Reset ${staleSelections.length} stale selections in ${tierName} tier`);
  }

  // Get tier-specific candidates
  const { data: articles, error } = await supabase
    .from('articles')
    .select('*')
    .is('is_ai_enhanced', false)
    .is('selected_for_enhancement', false)
    .in('source', config.sources)
    .gte('created_at', getDateHoursAgo(config.maxAgeHours))
    .not('content', 'is', null)
    .is('enhancement_metadata->source_article_status', null)
    .order('created_at', { ascending: false })
    .limit(config.quota);

  if (error) {
    console.error(`❌ Error fetching ${tierName} candidates:`, error);
    return [];
  }

  if (!articles || articles.length === 0) {
    console.log(`   ⚠️ No articles found for ${tierName} tier`);
    return [];
  }

  // Transform and filter articles
  const candidateArticles: CandidateArticle[] = articles
    .map(article => ({
      id: article.id,
      title: article.title,
      summary: article.summary,
      content: article.content,
      url: article.url,
      source: article.source,
      category: article.category || 'general',
      published_at: article.published_at,
      created_at: article.created_at,
      image_url: article.image_url,
      author: article.author,
      content_length: article.content?.length || 0,
      has_summary: !!(article.summary && article.summary.length > 50),
      has_image: !!article.image_url
    }))
    .filter(article => {
      // Apply tier-specific quality threshold
      if (article.content_length < config.minQuality) {
        console.log(`     ⚠️ ${tierName}: Filtered "${article.title.substring(0, 50)}..." - insufficient content (${article.content_length} < ${config.minQuality} chars)`);
        return false;
      }
      
      // Filter out articles with similar titles to recently selected ones
      const normalizedTitle = article.title.trim().toLowerCase().replace(/\s+/g, ' ').substring(0, 50);
      if (recentTitles.has(normalizedTitle)) {
        console.log(`     ⚠️ ${tierName}: Filtered "${article.title.substring(0, 50)}..." - similar article recently selected`);
        return false;
      }
      
      // Filter out test articles
      const titleLower = article.title.toLowerCase();
      if (titleLower.includes('test') || titleLower.includes('測試') || titleLower === 'title') {
        console.log(`     ❌ ${tierName}: Filtered "${article.title}" - appears to be test content`);
        return false;
      }
      
      console.log(`     ✅ ${tierName}: Accepted "${article.title.substring(0, 50)}..." (${article.content_length} chars)`);
      return true;
    });

  return candidateArticles;
}

function calculateQualityScore(article: CandidateArticle): number {
  const recencyScore = getRecencyScore(article.created_at);
  const contentScore = getContentScore(article.content_length);
  const sourceScore = SOURCE_QUALITY_WEIGHTS[article.source] || 50;
  
  return (
    recencyScore * 0.3 +      // 30% - Still value freshness
    contentScore * 0.4 +      // 40% - Content quality is key  
    sourceScore * 0.3         // 30% - Source reputation
  );
}

function getRecencyScore(createdAt: string): number {
  const hoursAgo = getHoursAgo(new Date(createdAt));
  if (hoursAgo < 1) return 100;
  if (hoursAgo < 3) return 90;
  if (hoursAgo < 6) return 80;
  if (hoursAgo < 12) return 70;
  if (hoursAgo < 24) return 60;
  return 50;
}

function getContentScore(contentLength: number): number {
  if (contentLength >= 2000) return 100;
  if (contentLength >= 1000) return 90;
  if (contentLength >= 500) return 80;
  if (contentLength >= 200) return 70;
  if (contentLength >= 100) return 60;
  if (contentLength >= 50) return 50;
  return 20;
}

async function applyDeduplication(candidates: CandidateArticle[]): Promise<CandidateArticle[]> {
  // Apply the same deduplication logic as the original system
  // 1. Title-based deduplication
  const titleMap = new Map();
  candidates.forEach(article => {
    const normalizedTitle = article.title
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\u4e00-\u9fff]/g, '')
      .substring(0, 50);
      
    if (!titleMap.has(normalizedTitle)) {
      titleMap.set(normalizedTitle, []);
    }
    titleMap.get(normalizedTitle).push(article);
  });

  const deduplicatedCandidates = Array.from(titleMap.entries()).map(([title, articles]) => {
    if (articles.length === 1) {
      return articles[0];
    }
    
    // Keep the article with the highest quality score
    return articles.reduce((best, current) => {
      const bestScore = calculateQualityScore(best);
      const currentScore = calculateQualityScore(current);
      return currentScore > bestScore ? current : best;
    });
  });
  
  // 2. Topic similarity filtering (get recently enhanced topics)
  const recentlyEnhancedTopics = await getRecentlyEnhancedTopics();
  const finalCandidates = await filterSimilarTopics(deduplicatedCandidates, recentlyEnhancedTopics);
  
  return finalCandidates;
}

function getSourceDistribution(articles: CandidateArticle[]): string {
  const distribution: Record<string, number> = {};
  articles.forEach(article => {
    distribution[article.source] = (distribution[article.source] || 0) + 1;
  });
  
  return Object.entries(distribution)
    .map(([source, count]) => `${source}:${count}`)
    .join(', ');
}

// Convert recent topics to CSV format for better LLM parsing
function analyzeRecentTopicsAsCSV(recentlyEnhancedTopics: Array<{ title: string, summary?: string, created_at: string }>): string {
  if (!recentlyEnhancedTopics || recentlyEnhancedTopics.length === 0) {
    return '#RECENT_COVERAGE,General,0,Politics,0,Business,0,Technology,0,Sports,0,Health,0,Lifestyle,0,Weather,0';
  }

  // Categorize recent topics by type
  const categories: Record<string, number> = {
    'General': 0,
    'Politics': 0,
    'Business': 0,
    'Technology': 0,
    'Sports': 0,
    'Health': 0,
    'Lifestyle': 0,
    'Weather': 0,
    'Crime': 0,
    'Education': 0,
    'Transport': 0,
    'Housing': 0
  };

  const categoryKeywords: Record<string, string[]> = {
    'Weather': ['typhoon', 'wipha', '風球', '颱風', '台风', 'signal', 'weather', 'storm', '橙色預警', '深圳', 'warning', '暴雨'],
    'Politics': ['陳茂波', 'government', '政府', 'policy', '政策', '行政長官', 'chief executive', 'legco', '立法會'],
    'Technology': ['創科', 'innovation', 'tech', 'ai', '人工智能', 'startup', '科技', 'digital'],
    'Sports': ['足球', 'football', 'soccer', '運動', 'sport', '比賽', 'match', '聯賽', 'league'],
    'Health': ['健康', 'health', '醫療', 'medical', '癌症', 'cancer', '疫苗', 'vaccine'],
    'Business': ['經濟', 'economy', 'business', '股票', 'stock', 'market', '銀行', 'bank', '金融'],
    'Lifestyle': ['生活', 'lifestyle', '飲食', 'food', '旅遊', 'travel', '時尚', 'fashion'],
    'Crime': ['警察', 'police', '罪案', 'crime', '逮捕', 'arrest', '偷竊', 'theft'],
    'Education': ['教育', 'education', '學校', 'school', '大學', 'university', '學生', 'student'],
    'Transport': ['交通', 'transport', '港鐵', 'mtr', '巴士', 'bus', '機場', 'airport'],
    'Housing': ['房屋', 'housing', '樓價', 'property', '公屋', 'public housing', '租金', 'rent']
  };

  // Count topics
  recentlyEnhancedTopics.forEach(topic => {
    const content = (topic.title + ' ' + (topic.summary || '')).toLowerCase();
    let categorized = false;
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => content.includes(keyword.toLowerCase()))) {
        categories[category]++;
        categorized = true;
        break;
      }
    }
    
    if (!categorized) {
      categories['General']++;
    }
  });

  // Create CSV format
  const csvParts = ['#RECENT_COVERAGE'];
  Object.entries(categories)
    .filter(([_, count]) => count > 0)
    .sort(([_, a], [__, b]) => b - a)
    .forEach(([category, count]) => {
      csvParts.push(`${category},${count}`);
    });

  return csvParts.join(',');
}

// Analyze recently enhanced topics to provide diversity guidance
function analyzeRecentTopics(recentlyEnhancedTopics: Array<{ title: string, summary?: string, created_at: string }>): {
  analysis: string;
  summary: string;
  recommendations: string[];
} {
  if (!recentlyEnhancedTopics || recentlyEnhancedTopics.length === 0) {
    return {
      analysis: "No recently enhanced articles to analyze.",
      summary: "Fresh start",
      recommendations: ["Focus on high-impact news across all categories"]
    };
  }

  // Categorize recent topics by type
  const categories = {
    weather: 0,
    politics: 0,
    technology: 0,
    sports: 0,
    health: 0,
    business: 0,
    lifestyle: 0,
    entertainment: 0,
    international: 0,
    other: 0
  };

  const topicKeywords = {
    weather: ['typhoon', 'wipha', '風球', '颱風', '台风', 'signal', 'weather', 'storm', '橙色預警', '深圳', 'warning', '暴雨'],
    politics: ['陳茂波', 'government', '政府', 'policy', '政策', '行政長官', 'chief executive', 'legco', '立法會'],
    technology: ['創科', 'innovation', 'tech', 'ai', '人工智能', 'startup', '科技', 'digital'],
    sports: ['足球', 'football', 'soccer', '運動', 'sport', '比賽', 'match', '聯賽', 'league'],
    health: ['健康', 'health', '醫療', 'medical', '癌症', 'cancer', '疫苗', 'vaccine'],
    business: ['經濟', 'economy', 'business', '股票', 'stock', 'market', '銀行', 'bank', '金融'],
    lifestyle: ['生活', 'lifestyle', '飲食', 'food', '旅遊', 'travel', '時尚', 'fashion'],
    entertainment: ['娛樂', 'entertainment', '電影', 'movie', '音樂', 'music', '明星', 'celebrity'],
    international: ['國際', 'international', '美國', 'america', '中國', 'china', '世界', 'world']
  };

  // Analyze each recent topic
  recentlyEnhancedTopics.forEach(topic => {
    const content = (topic.title + ' ' + (topic.summary || '')).toLowerCase();
    let categorized = false;
    
    for (const [category, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => content.includes(keyword.toLowerCase()))) {
        categories[category as keyof typeof categories]++;
        categorized = true;
        break;
      }
    }
    
    if (!categorized) {
      categories.other++;
    }
  });

  // Generate recommendations based on analysis
  const sortedCategories = Object.entries(categories)
    .filter(([_, count]) => count > 0)
    .sort(([_, a], [__, b]) => b - a);

  const overRepresented = sortedCategories.slice(0, 2);
  const underRepresented = Object.keys(categories).filter(cat => categories[cat as keyof typeof categories] === 0);

  const recommendations = [];
  
  if (overRepresented.length > 0 && overRepresented[0][1] > 3) {
    recommendations.push(`AVOID ${overRepresented[0][0].toUpperCase()} topics (${overRepresented[0][1]} recent articles)`);
  }
  
  if (underRepresented.length > 0) {
    const priorityCategories = underRepresented.slice(0, 3);
    recommendations.push(`PRIORITIZE ${priorityCategories.join(', ').toUpperCase()} content for diversity`);
  }
  
  recommendations.push("SEEK unique angles and fresh perspectives");
  recommendations.push("BALANCE local Hong Kong focus with broader regional interest");

  const analysis = `Recent Coverage Analysis (${recentlyEnhancedTopics.length} articles):
${sortedCategories.map(([cat, count]) => `- ${cat.charAt(0).toUpperCase() + cat.slice(1)}: ${count} articles`).join('\n')}

Coverage Gaps: ${underRepresented.length > 0 ? underRepresented.join(', ') : 'None identified'}
Oversaturated: ${overRepresented.length > 0 && overRepresented[0][1] > 3 ? overRepresented[0][0] : 'None'}`;

  const summary = sortedCategories.length > 0 
    ? `${sortedCategories[0][0]} heavy (${sortedCategories[0][1]}), gaps in ${underRepresented.slice(0, 2).join(', ')}`
    : "Balanced coverage";

  return { analysis, summary, recommendations };
}

function createArticleSelectionPrompt(candidates: CandidateArticle[], count: number, recentlyEnhancedTopics: Array<{ title: string, summary?: string, created_at: string }> = []): string {
  // Create compact one-liner format for each article
  const articleRows = candidates.map((article, index) => {
    const id = String(index + 1).padStart(2, '0');
    const category = (article.category || 'General').substring(0, 12).padEnd(12);
    const source = article.source.substring(0, 8).padEnd(8);
    const wordCount = Math.round(article.content_length / 5) + 'w'; // Approximate word count
    const hasImg = article.has_image ? 'Y' : 'N';
    const timeAgo = getTimeAgo(new Date(article.created_at)).padEnd(7); // Add time info
    const title = article.title.substring(0, 60) + (article.title.length > 60 ? '...' : '');
    
    return `[${id}] | ${timeAgo} | ${category} | ${source} | ${wordCount.padStart(5)} | img:${hasImg} | "${title}"`;
  });

  // Analyze recently enhanced topics and create CSV format
  const topicCounts = analyzeRecentTopicsAsCSV(recentlyEnhancedTopics);
  
  // Debug logging
  console.log(`📋 Compact format preview - First 3 articles:`);
  articleRows.slice(0, 3).forEach(row => console.log(`   ${row}`));
  console.log(`📊 Recent coverage: ${topicCounts}`);

  return `SYSTEM: You are HKI's **Front-Page Curator**. Select stories that maximize *reader value* and *topic diversity* for Hong Kong audiences.

SCORING RUBRIC (rate each 1-5, then calculate total):
A. Impact on HK (I) - How directly this affects HK residents/economy/policy
B. Novelty/Un-dup (N) - How fresh/unique vs recent coverage  
C. Depth of source (D) - Word count & content richness
D. Source diversity (S) - Variety across your final selection
E. Under-served topic (U) - Fills gap in recent coverage

Formula: I×4 + N×3 + D×2 + S×1 + U×5 = Score (0-100)

FRESHNESS PRIORITY: Articles are listed newest first. When scores are tied, ALWAYS select newer articles (lower ID numbers = fresher news).

RECENT TOPIC COVERAGE (last 24h):
${topicCounts}
Prioritize categories with the lowest counts above.

AVAILABLE ARTICLES (ordered newest to oldest):
ID  | Time    | Category     | Source   | Words | Img | Title
${articleRows.join('\n')}

TASK: Select exactly ${count} articles with the highest scores.

HARD RULES (reject if violated):
• At least 3 distinct sources across final set (if possible)
• No more than 1 article per category unless unavoidable  
• All IDs must exist in the list above
• Every selection must score ≥80 (high quality threshold)
• If fewer than ${count} articles score ≥80, return only those that qualify
• Return ONLY the JSON array - no extra text

OUTPUT FORMAT:
[
  {"id":"01", "I":5, "N":4, "D":3, "S":4, "U":5, "score":86},
  {"id":"03", "I":4, "N":5, "D":4, "S":3, "U":4, "score":79}
]

Select ${count} articles now:`;
}

async function callPerplexityForSelection(prompt: string): Promise<Array<{id: string, I?: number, N?: number, D?: number, S?: number, U?: number, score: number}>> {
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'You are HKI\'s Front-Page Curator. Score each article using the rubric (I×4 + N×3 + D×2 + S×1 + U×5). Return ONLY a JSON array with scored selections. No extra text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2, // Lower temperature for more consistent selection
        top_p: 0.9,
        max_tokens: 1000 // Reduced from 2000 - sufficient for 3 selections
      })
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Debug: Log raw response for reasoning validation
    console.log(`🔍 Raw Perplexity Response for Validation:`, content.substring(0, 500) + '...');
    
    // Parse the JSON response - strip markdown code blocks if present
    let selections: Array<{id: string, I?: number, N?: number, D?: number, S?: number, U?: number, score: number}>;
    try {
      // Strip markdown code blocks (```json ... ``` or ``` ... ```)
      let jsonContent = content.trim();
      if (jsonContent.startsWith('```')) {
        // Remove opening ``` or ```json
        jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, '');
        // Remove closing ```
        jsonContent = jsonContent.replace(/\n?```\s*$/, '');
      }
      selections = JSON.parse(jsonContent.trim());
    } catch (error) {
      console.error('Failed to parse Perplexity selection response:', content);
      throw new Error('Invalid response format from Perplexity');
    }

    // Validate selections
    if (!Array.isArray(selections)) {
      throw new Error('Perplexity response is not an array');
    }

    if (selections.length === 0) {
      throw new Error('Perplexity did not select any articles');
    }

    // First pass: validate basic structure
    const structurallyValid = selections.filter(selection =>
      selection.id &&
      typeof selection.score === 'number'
    );

    // Calculate dynamic threshold based on all scores
    const allScores = structurallyValid.map(s => s.score);
    const { threshold, method } = calculateDynamicThreshold(allScores);

    console.log(`🎯 Score threshold: ${threshold} (method: ${method})`);

    // Apply threshold with recency consideration
    const validSelections = structurallyValid.filter(selection => {
      // Hard floor: never accept below 60
      if (selection.score < 60) {
        console.log(`   ⚠️ Rejected ${selection.id}: score ${selection.score} below hard floor (60)`);
        return false;
      }

      // Dynamic threshold check
      if (selection.score >= threshold) {
        return true;
      }

      // Borderline case (within 5 points): log but still filter
      if (selection.score >= threshold - 5) {
        console.log(`   ⚠️ Borderline rejection ${selection.id}: score ${selection.score} (threshold: ${threshold})`);
      }

      return false;
    });

    if (validSelections.length !== structurallyValid.length) {
      console.warn(`Filtered out ${structurallyValid.length - validSelections.length} selections (below dynamic threshold ${threshold}).`);
    }

    // Apply flexible article count if enabled
    let finalSelections = validSelections;
    if (FEATURE_FLAGS.FLEXIBLE_ARTICLE_COUNT) {
      // Allow up to 5 articles if they all score >= 85
      const highQuality = validSelections.filter(s => s.score >= 85);
      if (highQuality.length > 3) {
        finalSelections = highQuality.slice(0, 5);
        console.log(`📈 Flexible count: Expanded to ${finalSelections.length} high-quality articles (scores >= 85)`);
      }
    }

    console.log(`Perplexity selected ${finalSelections.length} articles for enhancement`);

    // Debug: Log the scored selections
    console.log(`📝 Scored selections:`, finalSelections.map(s => ({
      id: s.id,
      scores: `I:${s.I || '?'} N:${s.N || '?'} D:${s.D || '?'} S:${s.S || '?'} U:${s.U || '?'}`,
      total: s.score
    })));

    return finalSelections;
    
  } catch (error) {
    console.error('Error calling Perplexity for selection:', error);
    throw new Error('Failed to get article selections from Perplexity');
  }
}

function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function getDateHoursAgo(hours: number): string {
  const date = new Date();
  date.setTime(date.getTime() - (hours * 60 * 60 * 1000)); // Use setTime instead of setHours to handle date boundaries correctly
  return date.toISOString();
}

function getHoursAgo(date: Date): number {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  return Math.floor(diffInMs / (1000 * 60 * 60));
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffMins < 1440) {
    const hours = Math.floor(diffMins / 60);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diffMins / 1440);
    return `${days}d ago`;
  }
}

// AI Category Assignment using OpenAI
async function assignAICategories(selectedArticles: SelectedArticle[], sessionId: string): Promise<(SelectedArticle & { ai_category?: string; category_confidence?: number })[]> {
  console.log(`🤖 Assigning AI categories to ${selectedArticles.length} selected articles (${sessionId})...`);
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️ OpenAI API key not configured, skipping AI category assignment');
    return selectedArticles.map(article => ({ ...article, ai_category: article.category }));
  }

  const AVAILABLE_CATEGORIES = [
    'Top Stories',
    'Tech & Science', 
    'Finance',
    'Arts & Culture',
    'Sports',
    'Entertainment',
    'Politics',
    'Local',
    'International',
    'General'
  ];

  try {
    // Prepare articles for categorization
    const articlesForCategorization = selectedArticles.map((article, index) => ({
      id: index + 1,
      title: article.title,
      summary: article.summary || article.content.substring(0, 200) + '...',
      current_category: article.category
    }));

    const categorizationPrompt = `You are an expert news categorizer for a Hong Kong news platform. Categorize each article into the most appropriate category from the available options.

AVAILABLE CATEGORIES:
${AVAILABLE_CATEGORIES.map(cat => `- ${cat}`).join('\n')}

CATEGORIZATION GUIDELINES:
- **Top Stories**: Breaking news, major government announcements, significant Hong Kong developments, major accidents/incidents
- **Tech & Science**: Technology companies, AI/innovation, scientific research, startup news, digital transformation
- **Finance**: Stock market, economy, business mergers, banking, property market, cryptocurrency, economic policy
- **Arts & Culture**: Museums, art exhibitions, cultural events, books, traditional culture, heritage, festivals
- **Sports**: All sports coverage, Olympics, local teams, athlete profiles, sports events
- **Entertainment**: Movies, TV shows, celebrities, music, gaming, lifestyle trends, social media
- **Politics**: Government policy, political parties, elections, legislative council, political figures, political protests
- **Local**: Hong Kong-specific news, local community events, district news, local infrastructure, local social issues
- **International**: Global news, foreign affairs, international relations, overseas developments affecting Hong Kong
- **General**: Miscellaneous news that doesn't fit other categories, human interest stories, general announcements

ARTICLES TO CATEGORIZE:
${articlesForCategorization.map(article => `
ID: ${article.id}
Title: ${article.title}
Summary: ${article.summary}
Current Category: ${article.current_category}
---`).join('\n')}

TASK: Return a JSON array with categorizations. Include confidence scores (1-10) for quality assessment.

FORMAT:
[
  {"id": 1, "category": "Tech & Science", "confidence": 9, "reason": "Article about AI innovation in Hong Kong"},
  {"id": 2, "category": "Finance", "confidence": 8, "reason": "Stock market analysis"}
]

Return ONLY the JSON array:`;

    console.log(`📝 Sending ${selectedArticles.length} articles to OpenAI for categorization...`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert news categorizer. Return ONLY valid JSON arrays with article categorizations.'
          },
          {
            role: 'user',
            content: categorizationPrompt
          }
        ],
        temperature: 0.3, // Lower temperature for consistent categorization
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    let categorizations: Array<{id: number, category: string, confidence: number, reason?: string}>;
    try {
      categorizations = JSON.parse(content);
    } catch (error) {
      console.error('❌ Failed to parse OpenAI categorization response:', content);
      throw new Error('Invalid categorization response format');
    }

    // Validate and apply categorizations
    const articlesWithCategories = selectedArticles.map((article, index) => {
      const categorization = categorizations.find(cat => cat.id === index + 1);
      
      if (categorization && AVAILABLE_CATEGORIES.includes(categorization.category)) {
        console.log(`   ✓ "${article.title.substring(0, 40)}..." → ${categorization.category} (confidence: ${categorization.confidence})`);
        return {
          ...article,
          ai_category: categorization.category,
          category_confidence: categorization.confidence
        };
      } else {
        console.warn(`   ⚠️ "${article.title.substring(0, 40)}..." → keeping original category: ${article.category}`);
        return {
          ...article,
          ai_category: article.category, // Fallback to original
          category_confidence: 5 // Default confidence
        };
      }
    });

    const successfulCategorizations = articlesWithCategories.filter(a => a.ai_category !== a.category).length;
    console.log(`✅ AI categorization complete (${sessionId}): ${successfulCategorizations}/${selectedArticles.length} articles recategorized`);

    return articlesWithCategories;

  } catch (error) {
    console.error(`❌ Error in AI categorization (${sessionId}):`, error);
    console.log(`🔄 Falling back to original categories for all articles`);
    
    // Fallback: return articles with original categories
    return selectedArticles.map(article => ({
      ...article,
      ai_category: article.category,
      category_confidence: 5
    }));
  }
}

// Mark selected articles to prevent re-selection in future runs and assign AI categories
async function markArticlesAsSelected(
  selectedArticles: SelectedArticle[], 
  originalSelections: Array<{id: string, I?: number, N?: number, D?: number, S?: number, U?: number, score: number}>,
  sessionId: string,
  deduplicationResult?: DeduplicationResult | null
): Promise<void> {
  console.log(`🔐 Marking ${selectedArticles.length} articles as selected and assigning AI categories (${sessionId})...`);
  
  // First, assign AI categories to all selected articles
  const articlesWithCategories = await assignAICategories(selectedArticles, sessionId);
  
  for (let i = 0; i < articlesWithCategories.length; i++) {
    const article = articlesWithCategories[i];
    // Find the matching selection based on the article's stored reason and score
    const selection = originalSelections.find(sel => 
      sel.reason === article.selection_reason && 
      sel.score === article.priority_score
    ) || originalSelections[i]; // Fallback to index if no match found
    
    // Find which cluster this article belonged to (if deduplication was run)
    let clusterInfo = null;
    if (deduplicationResult) {
      const cluster = deduplicationResult.clusters.find(c => 
        c.articles.some(a => a.id === article.id)
      );
      if (cluster && cluster.articles.length > 1) {
        clusterInfo = {
          cluster_id: cluster.clusterId,
          cluster_size: cluster.articles.length,
          sources_in_cluster: cluster.articles.map(a => a.source),
          average_similarity: cluster.averageSimilarity
        };
      }
    }
    
    try {
      const { error } = await supabase
        .from('articles')
        .update({ 
          selected_for_enhancement: true,
          category: article.ai_category || article.category, // Use AI category if available
          selection_metadata: {
            selected_at: new Date().toISOString(),
            selection_reason: article.selection_reason,
            priority_score: article.priority_score,
            perplexity_selection_id: selection?.id || `${i + 1}`,
            selection_session: sessionId, // Track session for grouping and debugging
            selection_method: 'perplexity_ai',
            // Add deduplication statistics if available
            deduplication_stats: deduplicationResult ? {
              original_count: deduplicationResult.stats.originalCount,
              unique_stories: deduplicationResult.stats.uniqueStories,
              duplicates_removed: deduplicationResult.duplicatesRemoved,
              cluster_info: clusterInfo
            } : null,
            ai_category_assigned: article.ai_category || null,
            category_confidence: article.category_confidence || null
          }
        })
        .eq('id', article.id);
      
      if (error) {
        console.error(`❌ Failed to mark article ${article.id} as selected:`, error);
      } else {
        console.log(`   ✓ [${sessionId}] Marked "${article.title.substring(0, 40)}..." as selected with category: ${article.ai_category || article.category}`);
      }
    } catch (error) {
      console.error(`❌ Error marking article ${article.id} as selected:`, error);
    }
  }
  
  console.log(`✅ Article marking complete (${sessionId}): ${articlesWithCategories.length} articles marked as selected with AI categories`);
}

// Helper function to get selection statistics
export async function getSelectionStatistics(): Promise<any> {
  try {
    const { data: total, error: totalError } = await supabase
      .from('articles')
      .select('id', { count: 'exact' })
      .is('is_ai_enhanced', false)
      .is('selected_for_enhancement', false);

    const { data: recent, error: recentError } = await supabase
      .from('articles')
      .select('id', { count: 'exact' })
      .is('is_ai_enhanced', false)
      .is('selected_for_enhancement', false)
      .gte('created_at', getDateHoursAgo(6));

    const { data: bySource, error: sourceError } = await supabase
      .from('articles')
      .select('source')
      .is('is_ai_enhanced', false)
      .is('selected_for_enhancement', false)
      .gte('created_at', getDateHoursAgo(6));

    if (totalError || recentError || sourceError) {
      throw new Error('Failed to get statistics');
    }

    const sourceBreakdown = bySource?.reduce((acc: any, article: any) => {
      acc[article.source] = (acc[article.source] || 0) + 1;
      return acc;
    }, {}) || {};

    return {
      totalCandidates: total?.length || 0,
      recentCandidates: recent?.length || 0,
      sourceBreakdown,
      timeWindow: '6 hours',
      lastWeekOnly: false
    };

  } catch (error) {
    console.error('Error getting selection statistics:', error);
    return null;
  }
}

// Get recently enhanced topics for deduplication
// Reduced from 7 days to 4 days to allow revisiting important ongoing stories
async function getRecentlyEnhancedTopics(): Promise<Array<{ title: string, summary?: string, created_at: string, category?: string }>> {
  try {
    // Use 4-day window for general topics (reduced from 7)
    // This allows important developing stories to be re-covered after 4 days
    const DEDUP_WINDOW_DAYS = parseInt(process.env.TOPIC_DEDUP_DAYS || '4', 10);

    const { data: recentEnhanced, error } = await supabase
      .from('articles')
      .select('title, summary, created_at, category')
      .eq('is_ai_enhanced', true)
      .gte('created_at', getDateDaysAgo(DEDUP_WINDOW_DAYS))
      .order('created_at', { ascending: false })
      .limit(40); // Reduced limit to match shorter window

    if (error) throw error;

    console.log(`📊 Deduplication check: Found ${recentEnhanced?.length || 0} enhanced articles in last ${DEDUP_WINDOW_DAYS} days`);
    return recentEnhanced || [];
  } catch (error) {
    console.error('Error fetching recently enhanced topics:', error);
    return []; // Return empty array on error to avoid blocking selection
  }
}

// Helper function to normalize titles for comparison
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Calculate Jaccard similarity between two strings
function calculateJaccardSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(text2.split(' ').filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

// Calculate keyword overlap between texts
function calculateKeywordOverlap(text1: string, text2: string): number {
  // Extract important keywords (longer words, numbers, proper nouns)
  const extractKeywords = (text: string): Set<string> => {
    const words = text.toLowerCase().split(/\W+/);
    return new Set(words.filter(w => 
      w.length > 4 || // Longer words
      /\d/.test(w) || // Contains numbers
      /^[A-Z]/.test(text.split(/\W+/).find(orig => orig.toLowerCase() === w) || '') // Was capitalized
    ));
  };
  
  const keywords1 = extractKeywords(text1);
  const keywords2 = extractKeywords(text2);
  
  if (keywords1.size === 0 || keywords2.size === 0) return 0;
  
  const overlap = [...keywords1].filter(k => keywords2.has(k)).length;
  return overlap / Math.min(keywords1.size, keywords2.size);
}

// Filter out articles with similar topics to recently enhanced ones
async function filterSimilarTopics(
  candidateArticles: CandidateArticle[], 
  recentlyEnhancedTopics: Array<{ title: string, summary?: string, created_at: string }>
): Promise<CandidateArticle[]> {
  
  if (recentlyEnhancedTopics.length === 0) {
    console.log('No recently enhanced topics to compare against');
    return candidateArticles;
  }

  console.log('🔍 Using deterministic topic similarity detection...');
  
  // Use combined approach: Jaccard similarity + keyword matching
  const uniqueArticles = candidateArticles.filter((article) => {
    // Check similarity against all recently enhanced topics
    const isSimilar = recentlyEnhancedTopics.some(enhancedTopic => {
      // 1. Jaccard similarity on normalized titles
      const titleSimilarity = calculateJaccardSimilarity(
        normalizeTitle(article.title),
        normalizeTitle(enhancedTopic.title)
      );
      
      // 2. Keyword overlap check
      const keywordOverlap = calculateKeywordOverlap(
        article.title + ' ' + (article.summary || ''),
        enhancedTopic.title + ' ' + (enhancedTopic.summary || '')
      );
      
      // Combined similarity score
      const combinedScore = (titleSimilarity * 0.6) + (keywordOverlap * 0.4);
      
      // Consider similar if combined score > 0.5 (50% similarity)
      if (combinedScore > 0.5) {
        console.log(`   ⚠️ Filtered out similar article: "${article.title.substring(0, 60)}..." (similarity: ${Math.round(combinedScore * 100)}%)`);
        return true;
      }
      
      return false;
    });
    
    return !isSimilar;
  });
  
  console.log(`✅ Deterministic deduplication complete: ${candidateArticles.length} → ${uniqueArticles.length} unique articles`);
  
  // If deterministic approach filtered out too many articles, fall back to keyword filtering
  if (uniqueArticles.length < 5 && candidateArticles.length > 10) {
    console.log('📋 Too few articles after deduplication, applying relaxed keyword filtering...');
    return applyFallbackKeywordFiltering(candidateArticles, recentlyEnhancedTopics);
  }
  
  return uniqueArticles;
}

// Fallback keyword-based filtering for when AI is unavailable
function applyFallbackKeywordFiltering(
  candidateArticles: CandidateArticle[], 
  recentlyEnhancedTopics: Array<{ title: string, summary?: string, created_at: string }>
): CandidateArticle[] {
  console.log('🔍 Using fallback keyword-based similarity detection...');
  
  // Extended keyword sets for common Hong Kong news topics
  const topicKeywords = {
    typhoon: ['typhoon', '風球', '颱風', '台风', 'signal', '韋帕', 'wipha', '八號', '8號', 'no. 8', 'no.8', 'hurricane', 'storm', '橙色預警', '黃色預警', '深圳', 'shenzhen', '預警生效', 'warning', '暴雨', 'heavy rain'],
    covid: ['covid', 'coronavirus', '新冠', '疫情', 'pandemic', 'vaccine', '疫苗', 'quarantine', 'isolation'],
    politics: ['chief executive', '行政長官', 'legco', '立法會', 'government', '政府', 'policy', '政策', 'election', '選舉'],
    economy: ['economy', '經濟', 'gdp', 'inflation', '通脹', 'stock', '股票', 'market', '市場', 'bank', '銀行'],
    property: ['property', '物業', 'housing', '房屋', 'hdb', '公屋', 'price', '價格', 'rent', '租金'],
    transport: ['mtr', '港鐵', 'airport', '機場', 'traffic', '交通', 'delay', '延誤', 'service', '服務']
  };
  
  // Check which topic categories have been recently enhanced
  const enhancedTopics = new Set<string>();
  
  for (const topic of recentlyEnhancedTopics) {
    const title = topic.title?.toLowerCase() || '';
    const summary = topic.summary?.toLowerCase() || '';
    const content = title + ' ' + summary;
    
    for (const [category, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => content.includes(keyword.toLowerCase()))) {
        enhancedTopics.add(category);
      }
    }
  }
  
  if (enhancedTopics.size === 0) {
    console.log('✅ No matching topic categories found in recently enhanced articles');
    return candidateArticles;
  }
  
  console.log(`📋 Found enhanced topic categories: ${Array.from(enhancedTopics).join(', ')}`);
  
  // Filter out candidate articles that match enhanced topic categories
  const uniqueArticles = candidateArticles.filter(article => {
    const articleContent = (article.title + ' ' + (article.summary || '')).toLowerCase();
    
    for (const category of enhancedTopics) {
      const keywords = topicKeywords[category as keyof typeof topicKeywords];
      if (keywords.some(keyword => articleContent.includes(keyword.toLowerCase()))) {
        console.log(`   ⚠️ Filtered out ${category} article: "${article.title.substring(0, 50)}..."`);
        return false;
      }
    }
    
    return true;
  });
  
  console.log(`✅ Keyword-based deduplication complete: ${candidateArticles.length} → ${uniqueArticles.length} unique articles`);
  return uniqueArticles;
}

function createTopicSimilarityPrompt(
  candidates: CandidateArticle[], 
  recentTopics: Array<{ title: string, summary?: string, created_at: string }>
): string {
  
  const candidateList = candidates.map((article, index) => ({
    sequentialId: index + 1,
    title: article.title,
    summary: article.summary || article.content.substring(0, 150) + '...',
    source: article.source,
    category: article.category
  }));

  const recentTopicsList = recentTopics.map(topic => ({
    title: topic.title,
    summary: topic.summary || 'No summary available',
    enhancedDate: new Date(topic.created_at).toLocaleDateString()
  }));

  return `You are an expert at identifying topic similarity in Hong Kong news articles. Your task is to identify which candidate articles cover the SAME or VERY SIMILAR topics as recently enhanced articles.

RECENTLY ENHANCED TOPICS (to avoid duplicating):
${recentTopicsList.map((topic, index) => `
${index + 1}. "${topic.title}"
   Summary: ${topic.summary}
   Enhanced: ${topic.enhancedDate}
---`).join('\n')}

CANDIDATE ARTICLES (to check for similarity):
${candidateList.map((article) => `
ARTICLE_ID: ${article.sequentialId}
Title: ${article.title}
Source: ${article.source} | Category: ${article.category}
Summary: ${article.summary}
---`).join('\n')}

SIMILARITY CRITERIA:
- Same specific event (e.g., multiple articles about the same typhoon signal change)
- Same specific incident (e.g., same accident, same arrest, same policy announcement)
- Same specific government decision or policy
- Same specific company news or financial development
- Same specific sports event or entertainment news
- **WEATHER EVENTS**: Any coverage of the same typhoon/storm system, even if focusing on different regions (Hong Kong, Shenzhen, Guangdong, etc.)

DO NOT consider similar if:
- Different but related events (different typhoons, different accidents)
- Same general topic but different specific stories (different housing projects, different tech developments)
- Same category but unrelated content (different health news, different business news)

**SPECIAL WEATHER RULE**: If recently enhanced articles cover Typhoon Wipha (韋帕), consider ALL Wipha-related articles as similar, regardless of geographic focus (Hong Kong, Shenzhen, regional warnings, etc.)

CRITICAL INSTRUCTION: Return ONLY a JSON array containing the ARTICLE_ID numbers of candidate articles that are SIMILAR to recently enhanced topics.

Return format:
["1", "3", "7"]

If no candidates are similar to recent topics, return an empty array: []

Only include ARTICLE_ID numbers from the candidate list above.`;
}

async function callPerplexityForSimilarity(prompt: string): Promise<string[]> {
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at topic similarity detection. Return ONLY valid JSON arrays with article IDs that have similar topics to recently enhanced articles.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2, // Low temperature for consistent similarity detection
        top_p: 0.9,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse the JSON response - strip markdown code blocks if present
    let similarIds: string[];
    try {
      // Strip markdown code blocks (```json ... ``` or ``` ... ```)
      let jsonContent = content.trim();
      if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, '');
        jsonContent = jsonContent.replace(/\n?```\s*$/, '');
      }
      similarIds = JSON.parse(jsonContent.trim());
    } catch (error) {
      console.error('Failed to parse Perplexity similarity response:', content);
      return []; // Return empty array if parsing fails
    }

    // Validate that it's an array of strings
    if (!Array.isArray(similarIds)) {
      console.warn('Perplexity similarity response is not an array:', similarIds);
      return [];
    }

    const validIds = similarIds.filter(id => typeof id === 'string' && /^\d+$/.test(id));
    
    if (validIds.length !== similarIds.length) {
      console.warn(`Some similarity IDs were invalid. Using ${validIds.length} valid IDs.`);
    }

    console.log(`Found ${validIds.length} similar articles to filter out`);
    return validIds;
    
  } catch (error) {
    console.error('❌ Error calling Perplexity for similarity detection:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      status: error?.status,
      response: error?.response
    });
    return []; // Return empty array on error to avoid blocking selection
  }
}

// Debug function to understand why no articles are available
async function debugArticleAvailability() {
  const scrapedSources = ['HKFP', 'SingTao', 'HK01', 'on.cc', 'RTHK', 'am730', 'scmp', 'bloomberg', 'TheStandard'];
  const sixHoursAgo = getDateHoursAgo(6);
  
  const { count: totalCount } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .in('source', scrapedSources)
    .gte('created_at', sixHoursAgo);
    
  const { count: withContentCount } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .in('source', scrapedSources)
    .gte('created_at', sixHoursAgo)
    .not('content', 'is', null);
    
  const { count: notSelectedCount } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .in('source', scrapedSources)
    .gte('created_at', sixHoursAgo)
    .not('content', 'is', null)
    .eq('selected_for_enhancement', false);
    
  const { count: notEnhancedCount } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .in('source', scrapedSources)
    .gte('created_at', sixHoursAgo)
    .not('content', 'is', null)
    .eq('selected_for_enhancement', false)
    .eq('is_ai_enhanced', false);
  
  return {
    sixHoursAgo,
    totalInLastSixHours: totalCount,
    withContent: withContentCount,
    notSelected: notSelectedCount,
    notEnhanced: notEnhancedCount,
    sources: scrapedSources
  };
}