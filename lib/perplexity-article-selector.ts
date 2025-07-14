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
  console.log(`DEBUG: Available candidate IDs:`, candidateArticles.slice(0, 5).map(a => a.id));
  
  // Smart mapping: handle both UUID and index-based selections
  const selectedArticles = selectedIds
    .map(selection => {
      // First try direct UUID match
      let article = candidateArticles.find(a => a.id === selection.id);
      
      // If no UUID match, try index-based matching (Perplexity often returns "1", "2", etc.)
      if (!article && /^\d+$/.test(selection.id)) {
        const index = parseInt(selection.id) - 1; // Convert "1" to index 0, "2" to index 1, etc.
        if (index >= 0 && index < candidateArticles.length) {
          article = candidateArticles[index];
          console.log(`DEBUG: Mapped index ${selection.id} to article ${article.id} (${article.title})`);
        }
      }
      
      if (!article) {
        console.log(`DEBUG: Could not find article for selection ID ${selection.id}`);
        return null;
      }
      
      return {
        ...article,
        selection_reason: selection.reason,
        priority_score: selection.score
      };
    })
    .filter(article => article !== null) as SelectedArticle[];

  console.log(`Perplexity selected ${selectedArticles.length} articles for enhancement`);
  
  if (selectedArticles.length === 0 && selectedIds.length > 0) {
    console.error('ERROR: Perplexity selections did not match any candidate article IDs');
    console.error('Selected IDs:', selectedIds.map(s => s.id));
    console.error('Available IDs:', candidateArticles.map(a => a.id));
    
    // Fallback: if no articles selected but we have candidates, pick the most recent ones
    console.log(`FALLBACK: Selecting ${count} most recent articles as fallback`);
    const fallbackArticles = candidateArticles
      .slice(0, count)
      .map(article => ({
        ...article,
        selection_reason: 'Fallback selection - most recent article due to Perplexity ID mismatch',
        priority_score: 75 // Default score for fallback
      }));
    
    console.log(`Fallback selected ${fallbackArticles.length} articles`);
    return fallbackArticles;
  }
  
  return selectedArticles;
}

async function getCandidateArticles(): Promise<CandidateArticle[]> {
  try {
    // Get recent articles that haven't been AI enhanced
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .is('is_ai_enhanced', false) // Only non-enhanced articles
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
  const articleSummaries = candidates.map(article => ({
    id: article.id,
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
ARTICLE_ID: ${article.id}
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

CRITICAL INSTRUCTION: You must copy the exact ARTICLE_ID from above. Do NOT use numbers or indexes.

The ARTICLE_ID field contains long UUID strings like "f4c412f7-337a-42fc-b222-934770921ee7" - copy these EXACTLY.

Return ONLY a JSON array with exactly ${count} selections in this format:
[
  {
    "id": "COPY_THE_EXACT_ARTICLE_ID_UUID_FROM_ABOVE",
    "reason": "Brief explanation why this article was selected",
    "score": 85
  }
]

WRONG: "id": "1" or "id": "2" 
CORRECT: "id": "f4c412f7-337a-42fc-b222-934770921ee7"

You MUST copy and paste the full UUID string from the ARTICLE_ID field above.

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

// Helper function to get selection statistics
export async function getSelectionStatistics(): Promise<any> {
  try {
    const { data: total, error: totalError } = await supabase
      .from('articles')
      .select('id', { count: 'exact' })
      .is('is_ai_enhanced', false);

    const { data: recent, error: recentError } = await supabase
      .from('articles')
      .select('id', { count: 'exact' })
      .is('is_ai_enhanced', false)
      .gte('created_at', getDateDaysAgo(7));

    const { data: bySource, error: sourceError } = await supabase
      .from('articles')
      .select('source')
      .is('is_ai_enhanced', false)
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