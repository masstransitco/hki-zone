import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

interface HeadlineGenerationOptions {
  count: number;
  categories: string[];
  deduplication: boolean;
}

interface GeneratedHeadline {
  title: string;
  url: string;
  category: string;
  source: string;
  priority?: 'high' | 'medium' | 'low';
}

async function getRecentTitles(days: number = 3): Promise<string[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  try {
    // Get recent titles from articles table
    const { data: articles } = await supabase
      .from('articles')
      .select('title')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    // Get recent titles from perplexity_news table
    const { data: perplexityNews } = await supabase
      .from('perplexity_news')
      .select('title, enhanced_title')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    const titles: string[] = [];
    
    if (articles) {
      titles.push(...articles.map(a => a.title));
    }
    
    if (perplexityNews) {
      perplexityNews.forEach(p => {
        if (p.title) titles.push(p.title);
        if (p.enhanced_title) titles.push(p.enhanced_title);
      });
    }

    return titles;
  } catch (error) {
    console.error('Error fetching recent titles:', error);
    return [];
  }
}

export async function generateHeadlinesBatch(
  options: HeadlineGenerationOptions
): Promise<GeneratedHeadline[]> {
  const { count, categories, deduplication } = options;
  
  try {
    // Get recent titles for deduplication
    let recentTitles: string[] = [];
    if (deduplication) {
      recentTitles = await getRecentTitles(3);
      console.log(`Found ${recentTitles.length} recent titles for deduplication`);
    }

    // Calculate distribution across categories
    const categoryDistribution = calculateCategoryDistribution(count, categories);
    
    // Create the prompt for Perplexity
    const prompt = createHeadlineGenerationPrompt(categoryDistribution, recentTitles);
    
    // Call Perplexity API
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
            content: 'You are a Hong Kong news editor specializing in selecting impactful, relevant headlines. Return ONLY valid JSON arrays.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        top_p: 0.9,
        frequency_penalty: 0.8,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse the JSON response
    let headlines: GeneratedHeadline[];
    try {
      headlines = JSON.parse(content);
    } catch (error) {
      console.error('Failed to parse Perplexity response:', content);
      throw new Error('Invalid response format from Perplexity');
    }

    // Validate and deduplicate headlines
    if (deduplication) {
      headlines = deduplicateHeadlines(headlines, recentTitles);
    }

    // Ensure we have the requested count
    if (headlines.length < count) {
      console.warn(`Only generated ${headlines.length} headlines out of requested ${count}`);
    }

    return headlines.slice(0, count);
    
  } catch (error) {
    console.error('Error generating headlines:', error);
    throw error;
  }
}

function calculateCategoryDistribution(count: number, categories: string[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  
  // Default distribution for 10 articles
  if (count === 10) {
    return {
      'politics': 3,
      'business': 2,
      'tech': 2,
      'health': 1,
      'lifestyle': 1,
      'entertainment': 1
    };
  }
  
  // Even distribution for other counts
  const perCategory = Math.floor(count / categories.length);
  const remainder = count % categories.length;
  
  categories.forEach((category, index) => {
    distribution[category] = perCategory + (index < remainder ? 1 : 0);
  });
  
  return distribution;
}

function createHeadlineGenerationPrompt(
  categoryDistribution: Record<string, number>,
  recentTitles: string[]
): string {
  const distributionText = Object.entries(categoryDistribution)
    .map(([category, count]) => `- ${category}: ${count} headlines`)
    .join('\n');
    
  const avoidTitlesText = recentTitles.length > 0
    ? `\nAvoid these recent titles:\n${recentTitles.slice(0, 30).map(t => `- ${t}`).join('\n')}`
    : '';

  return `Generate ${Object.values(categoryDistribution).reduce((a, b) => a + b, 0)} unique Hong Kong news headlines from today's latest events.

DISTRIBUTION REQUIREMENTS:
${distributionText}

SELECTION CRITERIA:
- Must be newsworthy events from the last 24 hours
- Focus on Hong Kong-specific news or international news with Hong Kong impact
- Prioritize: breaking news, government announcements, economic data, major business news, technology developments
- Ensure diversity across different news sources
- Each headline must be from a credible Hong Kong news source

HEADLINE REQUIREMENTS:
- Chinese titles: Maximum 15 characters, clear and engaging
- English titles: Maximum 15 words, professional journalism style
- Include only URLs from these sources: HKFP, South China Morning Post, The Standard, Sing Tao Daily, HK01, Oriental Daily, RTHK
- Each headline must be unique and not duplicate existing content

QUALITY INDICATORS to prioritize:
- High public interest and impact
- Clear significance to Hong Kong residents
- Verifiable from reliable sources
- Suitable for in-depth AI enhancement
- Recent breaking news or major developments
${avoidTitlesText}

Return a JSON array with exactly ${Object.values(categoryDistribution).reduce((a, b) => a + b, 0)} objects:
[{"category":"category_name","title":"headline text","url":"https://...","source":"source_name","priority":"high|medium|low"}]

Ensure the JSON is valid and contains exactly the requested distribution.`;
}

function deduplicateHeadlines(
  headlines: GeneratedHeadline[],
  recentTitles: string[]
): GeneratedHeadline[] {
  const recentTitleSet = new Set(recentTitles.map(t => t.toLowerCase().trim()));
  
  return headlines.filter(headline => {
    const titleLower = headline.title.toLowerCase().trim();
    
    // Check exact match
    if (recentTitleSet.has(titleLower)) {
      console.log(`Filtering duplicate headline: ${headline.title}`);
      return false;
    }
    
    // Check for very similar titles (80% similarity)
    for (const recentTitle of recentTitles) {
      if (calculateSimilarity(headline.title, recentTitle) > 0.8) {
        console.log(`Filtering similar headline: ${headline.title} (similar to: ${recentTitle})`);
        return false;
      }
    }
    
    return true;
  });
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  const longerLength = longer.length;
  if (longerLength === 0) return 1;
  
  const editDistance = calculateEditDistance(longer, shorter);
  return (longerLength - editDistance) / longerLength;
}

function calculateEditDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}