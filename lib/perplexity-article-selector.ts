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

  // 2. Create selection prompt for Perplexity
  const selectionPrompt = createArticleSelectionPrompt(candidateArticles, count);

  // 3. Call Perplexity API for intelligent selection
  const selectedIds = await callPerplexityForSelection(selectionPrompt);

  // 4. Map selected IDs back to full article objects
  console.log(`DEBUG: Perplexity returned ${selectedIds.length} selections:`, selectedIds.map(s => ({ id: s.id, score: s.score })));
  console.log(`DEBUG: Available candidate count: ${candidateArticles.length} articles`);
  
  // Map sequential numbers (1, 2, 3...) back to candidate articles
  const selectedArticles = selectedIds
    .map(selection => {
      // Convert sequential ID to array index (1 -> 0, 2 -> 1, etc.)
      if (!/^\d+$/.test(selection.id)) {
        console.log(`DEBUG: Invalid selection ID format: ${selection.id} (expected number)`);
        return null;
      }
      
      const index = parseInt(selection.id) - 1; // Convert "1" to index 0, "2" to index 1, etc.
      
      if (index < 0 || index >= candidateArticles.length) {
        console.log(`DEBUG: Selection ID ${selection.id} out of range (1-${candidateArticles.length})`);
        return null;
      }
      
      const article = candidateArticles[index];
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
    console.error('Valid range: 1 to', candidateArticles.length);
    
    // Fallback: if no articles selected but we have candidates, pick the most recent ones
    console.log(`FALLBACK: Selecting ${count} most recent articles as fallback`);
    const fallbackArticles = candidateArticles
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
    // Get recent articles that haven't been AI enhanced and haven't been selected before
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .is('is_ai_enhanced', false) // Only non-enhanced articles
      .is('selected_for_enhancement', false) // Only articles never selected before
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

    console.log(`Filtered ${qualityArticles.length} quality articles from ${articles.length} candidates`);
    
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