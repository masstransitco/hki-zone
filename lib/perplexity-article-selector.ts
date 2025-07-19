import { createClient } from '@supabase/supabase-js';

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

export async function selectArticlesWithPerplexity(count: number = 10): Promise<SelectedArticle[]> {
  console.log(`Starting Perplexity-assisted article selection for ${count} articles...`);

  // 1. Get candidate articles from database
  const candidateArticles = await getCandidateArticles();
  
  if (candidateArticles.length === 0) {
    throw new Error('No candidate articles found for selection');
  }

  console.log(`Found ${candidateArticles.length} candidate articles`);

  // 2. Get recently enhanced topics for deduplication
  const recentlyEnhancedTopics = await getRecentlyEnhancedTopics();
  console.log(`Found ${recentlyEnhancedTopics.length} recently enhanced topics for deduplication`);
  
  // Debug: Show the enhanced topics we're comparing against
  if (recentlyEnhancedTopics.length > 0) {
    console.log('📋 Recently enhanced topics to avoid duplicating:');
    recentlyEnhancedTopics.forEach((topic, index) => {
      console.log(`   ${index + 1}. "${topic.title?.substring(0, 60)}..."`);
    });
  }

  // 3. Filter out articles with similar topics to recently enhanced ones
  const deduplicatedArticles = await filterSimilarTopics(candidateArticles, recentlyEnhancedTopics);
  console.log(`After topic deduplication: ${deduplicatedArticles.length} unique articles remaining`);

  if (deduplicatedArticles.length === 0) {
    console.log('⚠️ All candidate articles are similar to recently enhanced topics');
    throw new Error('No unique articles found after topic deduplication');
  }

  // 4. Create selection prompt for Perplexity using deduplicated articles
  const selectionPrompt = createArticleSelectionPrompt(deduplicatedArticles, count);

  // 5. Call Perplexity API for intelligent selection
  const selectedIds = await callPerplexityForSelection(selectionPrompt);

  // 6. Map selected IDs back to full article objects
  console.log(`DEBUG: Perplexity returned ${selectedIds.length} selections:`, selectedIds.map(s => ({ id: s.id, score: s.score })));
  console.log(`DEBUG: Available deduplicated candidate count: ${deduplicatedArticles.length} articles`);
  
  // Map sequential numbers (1, 2, 3...) back to deduplicated candidate articles
  const selectedArticles = selectedIds
    .map(selection => {
      // Convert sequential ID to array index (1 -> 0, 2 -> 1, etc.)
      if (!/^\d+$/.test(selection.id)) {
        console.log(`DEBUG: Invalid selection ID format: ${selection.id} (expected number)`);
        return null;
      }
      
      const index = parseInt(selection.id) - 1; // Convert "1" to index 0, "2" to index 1, etc.
      
      if (index < 0 || index >= deduplicatedArticles.length) {
        console.log(`DEBUG: Selection ID ${selection.id} out of range (1-${deduplicatedArticles.length})`);
        return null;
      }
      
      const article = deduplicatedArticles[index];
      console.log(`DEBUG: Mapped selection ${selection.id} to article ${article.id} (${article.title.substring(0, 50)}...)`);
      
      return {
        ...article,
        selection_reason: selection.reason,
        priority_score: selection.score
      };
    })
    .filter(article => article !== null) as SelectedArticle[];

  console.log(`Perplexity selected ${selectedArticles.length} articles for enhancement`);
  
  // Mark selected articles to prevent re-selection in future runs
  if (selectedArticles.length > 0) {
    await markArticlesAsSelected(selectedArticles, selectedIds);
  }
  
  if (selectedArticles.length === 0 && selectedIds.length > 0) {
    console.error('ERROR: Perplexity selections did not map to any candidate articles');
    console.error('Selected IDs:', selectedIds.map(s => s.id));
    console.error('Valid range: 1 to', deduplicatedArticles.length);
    
    // Fallback: if no articles selected but we have candidates, pick the most recent ones
    console.log(`FALLBACK: Selecting ${count} most recent articles as fallback`);
    const fallbackArticles = deduplicatedArticles
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
        reason: 'Fallback selection',
        score: 75
      }));
      await markArticlesAsSelected(fallbackArticles, fallbackSelections);
    }
    
    console.log(`Fallback selected ${fallbackArticles.length} articles`);
    return fallbackArticles;
  }
  
  return selectedArticles;
}

async function getCandidateArticles(): Promise<CandidateArticle[]> {
  try {
    // Get recent scraped articles that haven't been AI enhanced and haven't been selected before
    const scrapedSources = ['HKFP', 'SingTao', 'HK01', 'ONCC', 'RTHK'];
    
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .is('is_ai_enhanced', false) // Only non-enhanced articles
      .is('selected_for_enhancement', false) // Only articles never selected before
      .in('source', scrapedSources) // Only scraped sources (not AI-generated)
      .gte('created_at', getDateDaysAgo(7)) // Last 7 days
      .not('content', 'is', null) // Must have content
      .order('created_at', { ascending: false })
      .limit(50); // Get up to 50 candidates for Perplexity to choose from

    if (error) throw error;

    if (!articles || articles.length === 0) {
      return [];
    }

    // Transform and enrich articles with metadata
    const candidateArticles: CandidateArticle[] = articles.map(article => ({
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
    }));

    // Filter for quality - only articles with substantial content
    const qualityArticles = candidateArticles.filter(article => 
      article.content_length > 200 && // Minimum content length
      article.title.length > 10 // Reasonable title length
    );

    console.log(`Filtered ${qualityArticles.length} quality scraped articles from ${articles.length} candidates`);
    console.log(`Sources represented: ${[...new Set(qualityArticles.map(a => a.source))].join(', ')}`);
    
    return qualityArticles;

  } catch (error) {
    console.error('Error fetching candidate articles:', error);
    throw new Error('Failed to fetch candidate articles from database');
  }
}

function createArticleSelectionPrompt(candidates: CandidateArticle[], count: number): string {
  // Create a concise summary of each article for Perplexity to evaluate
  // Use sequential numbers (1, 2, 3...) instead of UUIDs to avoid corruption
  const articleSummaries = candidates.map((article, index) => ({
    sequentialId: index + 1, // 1-based indexing for Perplexity
    title: article.title,
    source: article.source,
    category: article.category,
    summary: article.summary || article.content.substring(0, 200) + '...',
    content_length: article.content_length,
    has_summary: article.has_summary,
    has_image: article.has_image,
    published_hours_ago: Math.round((Date.now() - new Date(article.published_at).getTime()) / (1000 * 60 * 60))
  }));

  return `You are an expert Hong Kong news editor tasked with selecting the ${count} most impactful and enhancement-worthy articles for AI processing.

SELECTION CRITERIA (in order of importance):
1. **News Impact**: High public interest, breaking news, significant developments
2. **Enhancement Potential**: Articles that would benefit from deeper analysis, context, and multilingual presentation
3. **Content Quality**: Well-written, substantial content (>300 characters preferred)
4. **Source Diversity**: Balanced representation across major Hong Kong news sources
5. **Category Balance**: Mix of politics, business, tech, lifestyle, health, entertainment
6. **Recency**: Prefer more recent articles (published within last 24-48 hours)

AVAILABLE ARTICLES TO CHOOSE FROM:
${articleSummaries.map((article) => `
ARTICLE_NUMBER: ${article.sequentialId}
Title: ${article.title}
Source: ${article.source} | Category: ${article.category}
Content: ${article.content_length} chars | Has Summary: ${article.has_summary} | Has Image: ${article.has_image}
Published: ${article.published_hours_ago} hours ago
Preview: ${article.summary}
---
`).join('\n')}

SELECTION REQUIREMENTS:
- Select exactly ${count} articles
- Prioritize articles with high news impact and enhancement potential
- Ensure source diversity (avoid selecting too many from same source)
- Balance categories when possible
- Consider both English and Chinese language articles

CRITICAL INSTRUCTION: Use the ARTICLE_NUMBER (simple numbers like 1, 2, 3) in your response.

Return ONLY a JSON array with exactly ${count} selections in this format:
[
  {
    "id": "1",
    "reason": "Brief explanation why this article was selected",
    "score": 85
  },
  {
    "id": "3", 
    "reason": "Brief explanation why this article was selected",
    "score": 82
  }
]

Use only the ARTICLE_NUMBER values (1, 2, 3, etc.) from the list above.

Select the ${count} best articles that would create the most valuable AI-enhanced content for Hong Kong readers across English, Traditional Chinese, and Simplified Chinese.`;
}

async function callPerplexityForSelection(prompt: string): Promise<Array<{id: string, reason: string, score: number}>> {
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
            content: 'You are an expert Hong Kong news editor. Analyze the provided articles and return ONLY valid JSON with your selections. Do not include any explanatory text outside the JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for more focused selection
        top_p: 0.9,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse the JSON response
    let selections: Array<{id: string, reason: string, score: number}>;
    try {
      selections = JSON.parse(content);
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

    // Validate each selection has required fields
    const validSelections = selections.filter(selection => 
      selection.id && 
      selection.reason && 
      typeof selection.score === 'number'
    );

    if (validSelections.length !== selections.length) {
      console.warn(`Some selections were invalid. Using ${validSelections.length} valid selections.`);
    }

    console.log(`Perplexity selected ${validSelections.length} articles for enhancement`);
    
    return validSelections;
    
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

// Mark selected articles to prevent re-selection in future runs
async function markArticlesAsSelected(
  selectedArticles: SelectedArticle[], 
  originalSelections: Array<{id: string, reason: string, score: number}>
): Promise<void> {
  console.log(`Marking ${selectedArticles.length} articles as selected to prevent re-selection...`);
  
  for (let i = 0; i < selectedArticles.length; i++) {
    const article = selectedArticles[i];
    const selection = originalSelections[i];
    
    try {
      const { error } = await supabase
        .from('articles')
        .update({ 
          selected_for_enhancement: true,
          selection_metadata: {
            selected_at: new Date().toISOString(),
            selection_reason: article.selection_reason,
            priority_score: article.priority_score,
            perplexity_selection_id: selection?.id || `${i + 1}`,
            selection_session: Date.now() // To group selections from same session
          }
        })
        .eq('id', article.id);
      
      if (error) {
        console.error(`Failed to mark article ${article.id} as selected:`, error);
      } else {
        console.log(`✓ Marked article "${article.title}" as selected`);
      }
    } catch (error) {
      console.error(`Error marking article ${article.id} as selected:`, error);
    }
  }
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
      .gte('created_at', getDateDaysAgo(7));

    const { data: bySource, error: sourceError } = await supabase
      .from('articles')
      .select('source')
      .is('is_ai_enhanced', false)
      .is('selected_for_enhancement', false)
      .gte('created_at', getDateDaysAgo(7));

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
      lastWeekOnly: true
    };

  } catch (error) {
    console.error('Error getting selection statistics:', error);
    return null;
  }
}

// Get recently enhanced topics for deduplication
async function getRecentlyEnhancedTopics(): Promise<Array<{ title: string, summary?: string, created_at: string }>> {
  try {
    const { data: recentEnhanced, error } = await supabase
      .from('articles')
      .select('title, summary, created_at')
      .eq('is_ai_enhanced', true)
      .gte('created_at', getDateDaysAgo(2)) // Last 48 hours
      .order('created_at', { ascending: false })
      .limit(20); // Check last 20 enhanced articles

    if (error) throw error;

    return recentEnhanced || [];
  } catch (error) {
    console.error('Error fetching recently enhanced topics:', error);
    return []; // Return empty array on error to avoid blocking selection
  }
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

  if (!process.env.PERPLEXITY_API_KEY) {
    console.log('⚠️ Perplexity API key not available for topic deduplication, skipping...');
    return candidateArticles;
  }

  try {
    console.log('🔍 Using simple title-based similarity detection (temporary)...');
    
    // Temporary simple similarity check based on keywords
    const typhoonKeywords = ['typhoon', '風球', '颱風', '台风', 'signal', '韋帕', 'wipha', '八號', '8號', 'no. 8', 'no.8'];
    
    // Check if any recently enhanced topics contain typhoon keywords
    const hasTyphoonEnhanced = recentlyEnhancedTopics.some(topic => 
      typhoonKeywords.some(keyword => 
        topic.title?.toLowerCase().includes(keyword.toLowerCase())
      )
    );
    
    if (hasTyphoonEnhanced) {
      console.log('⚠️ Found enhanced typhoon articles, filtering out typhoon candidates...');
      
      // Filter out typhoon-related candidate articles
      const uniqueArticles = candidateArticles.filter(article => {
        const isTyphoon = typhoonKeywords.some(keyword => 
          article.title?.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (isTyphoon) {
          console.log(`   ⚠️ Filtered out typhoon article: "${article.title.substring(0, 50)}..."`);
        }
        
        return !isTyphoon;
      });
      
      console.log(`✅ Simple deduplication complete: ${candidateArticles.length} → ${uniqueArticles.length} unique articles`);
      return uniqueArticles;
    } else {
      console.log('✅ No typhoon articles found in recently enhanced, keeping all candidates');
      return candidateArticles;
    }

  } catch (error) {
    console.error('Error in topic similarity detection:', error);
    console.log('Proceeding without topic deduplication to avoid blocking selection...');
    return candidateArticles; // Return all candidates if similarity detection fails
  }
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

DO NOT consider similar if:
- Different but related events (different typhoons, different accidents)
- Same general topic but different specific stories (different housing projects, different tech developments)
- Same category but unrelated content (different health news, different business news)

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
    
    // Parse the JSON response
    let similarIds: string[];
    try {
      similarIds = JSON.parse(content);
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