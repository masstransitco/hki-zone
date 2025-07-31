import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export interface HeadlineScore {
  contentQuality: number;      // 0-25 points
  sourceReliability: number;   // 0-25 points  
  recency: number;            // 0-25 points
  uniqueness: number;         // 0-25 points
  total: number;              // 0-100 points
}

export interface ScoredHeadline {
  id?: string;
  title: string;
  url: string;
  category: string;
  source: string;
  content?: string;
  qualityScore: number;
  scoreBreakdown: HeadlineScore;
  priority?: 'high' | 'medium' | 'low';
}

const MIN_SCORE_THRESHOLD = 60; // Only enhance articles scoring 60+

// Reliable news sources with their reliability scores
const SOURCE_RELIABILITY_SCORES: Record<string, number> = {
  'HKFP': 25,
  'South China Morning Post': 24,
  'SCMP': 24,
  'The Standard': 22,
  'Sing Tao Daily': 21,
  'SingTao': 21,
  'HK01': 20,
  'Oriental Daily': 19,
  'ONCC': 19,
  'on.cc': 19,
  'RTHK': 25,
  'Ming Pao': 23,
  'Apple Daily': 20,
  'default': 15
};

// Category importance weights
const CATEGORY_WEIGHTS: Record<string, number> = {
  'politics': 1.2,
  'business': 1.1,
  'tech': 1.1,
  'health': 1.0,
  'lifestyle': 0.9,
  'entertainment': 0.8,
  'default': 1.0
};

export async function scoreAndFilterHeadlines(
  headlines: any[]
): Promise<ScoredHeadline[]> {
  console.log(`Scoring ${headlines.length} headlines for quality...`);
  
  const scoredHeadlines: ScoredHeadline[] = [];
  
  for (const headline of headlines) {
    try {
      // Fetch additional content if available
      const content = await fetchArticleContent(headline.url);
      
      // Calculate quality score
      const scoreBreakdown = calculateQualityScore(headline, content);
      const totalScore = scoreBreakdown.total;
      
      // Apply category weight
      const categoryWeight = CATEGORY_WEIGHTS[headline.category] || CATEGORY_WEIGHTS.default;
      const weightedScore = Math.round(totalScore * categoryWeight);
      
      const scoredHeadline: ScoredHeadline = {
        ...headline,
        content,
        qualityScore: weightedScore,
        scoreBreakdown
      };
      
      if (weightedScore >= MIN_SCORE_THRESHOLD) {
        scoredHeadlines.push(scoredHeadline);
        console.log(`✓ Qualified: "${headline.title}" (Score: ${weightedScore})`);
      } else {
        console.log(`✗ Filtered: "${headline.title}" (Score: ${weightedScore})`);
      }
      
    } catch (error) {
      console.error(`Error scoring headline "${headline.title}":`, error);
      // Skip headlines that fail scoring
    }
  }
  
  // Sort by quality score descending
  scoredHeadlines.sort((a, b) => b.qualityScore - a.qualityScore);
  
  console.log(`Qualified ${scoredHeadlines.length} out of ${headlines.length} headlines`);
  
  return scoredHeadlines;
}

function calculateQualityScore(headline: any, content?: string): HeadlineScore {
  // 1. Content Quality (0-25 points)
  let contentQuality = 0;
  
  // Title quality
  if (headline.title && headline.title.length > 10) {
    contentQuality += 10;
  }
  
  // Has content
  if (content && content.length > 200) {
    contentQuality += 10;
  }
  
  // Priority indicator
  if (headline.priority === 'high') {
    contentQuality += 5;
  } else if (headline.priority === 'medium') {
    contentQuality += 3;
  }
  
  // 2. Source Reliability (0-25 points)
  const sourceReliability = SOURCE_RELIABILITY_SCORES[headline.source] || 
                           SOURCE_RELIABILITY_SCORES.default;
  
  // 3. Recency (0-25 points)
  let recency = 25; // Assume all generated headlines are recent
  
  // 4. Uniqueness (0-25 points)
  let uniqueness = 20; // Base uniqueness score
  
  // Bonus for specific categories
  if (['politics', 'business', 'tech'].includes(headline.category)) {
    uniqueness += 5;
  }
  
  const total = contentQuality + sourceReliability + recency + uniqueness;
  
  return {
    contentQuality,
    sourceReliability,
    recency,
    uniqueness,
    total
  };
}

async function fetchArticleContent(url: string): Promise<string | undefined> {
  try {
    // First check if we already have this article in our database
    const { data: existingArticle } = await supabase
      .from('articles')
      .select('content, summary')
      .eq('url', url)
      .single();
    
    if (existingArticle && existingArticle.content) {
      return existingArticle.content;
    }
    
    // For scoring purposes, we'll return undefined if not in database
    // The actual content will be fetched during enhancement
    return undefined;
    
  } catch (error) {
    console.error(`Error fetching content for ${url}:`, error);
    return undefined;
  }
}

// Helper function to check if an article already exists
export async function checkArticleExists(url: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('articles')
      .select('id')
      .eq('url', url)
      .single();
    
    return !!data && !error;
  } catch (error) {
    return false;
  }
}

// Helper function to get article quality metrics
export async function getArticleQualityMetrics(articleId: string): Promise<any> {
  try {
    const { data: article } = await supabase
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .single();
    
    if (!article) return null;
    
    return {
      hasContent: !!article.content && article.content.length > 200,
      hasSummary: !!article.summary && article.summary.length > 50,
      hasImage: !!article.image_url,
      contentLength: article.content?.length || 0,
      summaryLength: article.summary?.length || 0,
      isAiEnhanced: article.is_ai_enhanced || false,
      source: article.source,
      category: article.category,
      publishedAt: article.published_at
    };
  } catch (error) {
    console.error('Error getting article metrics:', error);
    return null;
  }
}