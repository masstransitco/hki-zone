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
  const sessionId = `selection_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  console.log(`🚀 Starting Perplexity-assisted article selection for ${count} articles (Session: ${sessionId})`);

  // 1. Get candidate articles from database
  const candidateArticles = await getCandidateArticles();
  
  if (candidateArticles.length === 0) {
    throw new Error('No candidate articles found for selection');
  }

  console.log(`📊 Selection Statistics (${sessionId}):`);
  console.log(`   • Found ${candidateArticles.length} candidate articles`);
  console.log(`   • Sources: ${[...new Set(candidateArticles.map(a => a.source))].join(', ')}`);
  console.log(`   • Categories: ${[...new Set(candidateArticles.map(a => a.category))].join(', ')}`);
  console.log(`   • Date range: ${candidateArticles[candidateArticles.length - 1]?.created_at?.substring(0, 10)} to ${candidateArticles[0]?.created_at?.substring(0, 10)}`);

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
  console.log(`🔍 First 5 articles being sent to Perplexity for selection:`);
  deduplicatedArticles.slice(0, 5).forEach((article, index) => {
    console.log(`   ${index + 1}. "${article.title.substring(0, 60)}..." (ID: ${article.id})`);
  });
  
  const selectionPrompt = createArticleSelectionPrompt(deduplicatedArticles, count, recentlyEnhancedTopics);

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
    await markArticlesAsSelected(selectedArticles, selectedIds, sessionId);
  }
  
  if (selectedArticles.length === 0 && selectedIds.length > 0) {
    console.error(`❌ Selection Mapping Error (${sessionId}): Perplexity selections did not map to any candidate articles`);
    console.error('Selected IDs:', selectedIds.map(s => s.id));
    console.error('Valid range: 1 to', deduplicatedArticles.length);
    
    // Fallback: if no articles selected but we have candidates, pick the most recent ones
    console.log(`🔄 Fallback Selection (${sessionId}): Selecting ${count} most recent articles`);
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
      const normalizedTitle = article.title.trim().toLowerCase();
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
      if (article.content_length < 100) {
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
  // Create a concise summary of each article for Perplexity to evaluate
  // Use sequential numbers (1, 2, 3...) instead of UUIDs to avoid corruption
  const articleSummaries = candidates.map((article, index) => {
    // Generate a meaningful preview for the article
    let preview = article.summary || '';
    
    if (!preview && article.content) {
      // Skip past the title if it appears at the start of content
      let contentStart = 0;
      if (article.content.startsWith(article.title)) {
        contentStart = article.title.length;
      }
      
      // Get up to 400 characters for better context, skipping any initial whitespace
      const contentForPreview = article.content.substring(contentStart).trim();
      preview = contentForPreview.substring(0, 400);
      
      // If we have meaningful content, add ellipsis
      if (preview.length > 0 && contentForPreview.length > 400) {
        preview += '...';
      }
      
      // If still no preview, use the first 400 chars of content
      if (!preview || preview.length < 20) {
        preview = article.content.substring(0, 400);
        if (article.content.length > 400) {
          preview += '...';
        }
      }
    }
    
    return {
      sequentialId: index + 1, // 1-based indexing for Perplexity
      title: article.title,
      source: article.source,
      category: article.category,
      summary: preview,
      content_length: article.content_length,
      has_summary: article.has_summary,
      has_image: article.has_image,
      published_hours_ago: Math.round((Date.now() - new Date(article.published_at).getTime()) / (1000 * 60 * 60))
    };
  });

  // Analyze recently enhanced topics for diversity guidance
  const recentTopicAnalysis = analyzeRecentTopics(recentlyEnhancedTopics);
  
  // Debug logging: Show what Perplexity will see
  console.log(`📋 Prompt Preview - First 3 articles as they appear to Perplexity:`);
  articleSummaries.slice(0, 3).forEach(article => {
    console.log(`   ARTICLE_NUMBER: ${article.sequentialId}`);
    console.log(`   Title: ${article.title}`);
    console.log(`   Source: ${article.source} | Category: ${article.category}`);
    console.log(`   Content Length: ${article.content_length} chars`);
    console.log(`   Preview: ${article.summary.substring(0, 150)}...`);
    if (article.content_length < 100) {
      console.log(`   ⚠️ WARNING: Low content length may cause selection issues`);
    }
    console.log(`   ---`);
  });
  
  console.log(`🎯 Topic Diversity Analysis for Selection:`);
  console.log(`   Recently Enhanced: ${recentTopicAnalysis.summary}`);
  console.log(`   Recommended Focus: ${recentTopicAnalysis.recommendations.join(', ')}`);

  return `You are an expert Hong Kong news editor tasked with selecting the ${count} most impactful and enhancement-worthy articles for AI processing.

**EDITORIAL MISSION**: Create a DIVERSE and ENGAGING collection of enhanced articles that serves Hong Kong readers across different interests and needs.

**RECENTLY ENHANCED TOPIC ANALYSIS**:
${recentTopicAnalysis.analysis}

**DIVERSITY PRIORITIES**:
${recentTopicAnalysis.recommendations.map(rec => `• ${rec}`).join('\n')}

IMPORTANT: Use BOTH the headline AND the preview content to understand what each article is about. The preview provides essential context about the actual story content.

CRITICAL INSTRUCTION TO PREVENT HALLUCINATION:
- Base your selection reasoning SOLELY on the article information provided below
- Do NOT use external knowledge about Hong Kong news or current events
- Do NOT reference news stories that are not in the list below
- If an article has minimal preview content, state that clearly in your reasoning
- Your reasoning must directly relate to the specific article's title and preview text

SELECTION CRITERIA (in order of importance):
1. **TOPIC DIVERSITY**: Prioritize categories that are underrepresented in recent coverage to create a well-rounded collection
2. **Editorial Value**: Stories that would benefit from deeper analysis, context, and multilingual presentation  
3. **News Impact**: High public interest, breaking news, significant developments affecting Hong Kong
4. **Fresh Perspectives**: Unique angles, human interest stories, emerging trends not yet covered
5. **Headline Quality**: Clear, compelling headlines that indicate substantial news value
6. **Source Diversity**: Balanced representation across major Hong Kong news sources
7. **Reader Engagement**: Consider what would interest different demographics and reader segments

NOTE: While content length is not the primary factor, ensure articles have sufficient preview content to understand the story. Articles with very low content (< 100 chars) may lack substance. AI enhancement works best with clear, substantive source material.

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
- Select exactly ${count} articles that will create the most DIVERSE and ENGAGING collection
- AVOID over-represented categories identified in the analysis above
- PRIORITIZE under-represented categories for better topic balance
- Ensure source diversity (avoid selecting too many from same source)
- Consider both English and Chinese language articles
- Think about reader value: "What would make this collection of enhanced articles most valuable to Hong Kong readers?"

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

Select the ${count} articles that would create the most DIVERSE, VALUABLE, and ENGAGING collection of AI-enhanced content for Hong Kong readers. Think about variety, balance, and collective impact rather than just individual article strength.`;
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
            content: 'You are an expert Hong Kong news editor. Analyze the provided articles and return ONLY valid JSON with your selections. CRITICAL: Base your selection reasoning ONLY on the article titles and preview content provided. Do NOT use any external knowledge about Hong Kong news. If an article has minimal content, acknowledge that in your reasoning. Do not include any explanatory text outside the JSON.'
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
    
    // Debug: Log raw response for reasoning validation
    console.log(`🔍 Raw Perplexity Response for Validation:`, content.substring(0, 500) + '...');
    
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
    
    // Debug: Log the full response to understand what Perplexity returned
    console.log(`📝 Full Perplexity selections:`, JSON.stringify(validSelections, null, 2));
    
    // Validate reasoning consistency (log warnings for mismatches)
    validSelections.forEach((selection, index) => {
      console.log(`🔍 Selection ${index + 1} Validation:`)
      console.log(`   Selected ID: ${selection.id}`)
      console.log(`   Selection Score: ${selection.score}`)
      console.log(`   Reason Preview: "${selection.reason.substring(0, 100)}..."`)
      
      // Check for common hallucination indicators
      const reasoningLower = selection.reason.toLowerCase()
      const financialKeywords = ['hang seng', 'index', 'stock', 'market', '恆生指數', '股市', '股票']
      const weatherKeywords = ['typhoon', 'wipha', '風球', '颱風', 'signal', 'weather', 'storm', '橙色預警']
      
      const containsFinancialKeywords = financialKeywords.some(keyword => reasoningLower.includes(keyword))
      const containsWeatherKeywords = weatherKeywords.some(keyword => reasoningLower.includes(keyword))
      
      if (containsFinancialKeywords) {
        console.warn(`⚠️ REASONING VALIDATION WARNING: Selection ${selection.id} reasoning mentions financial/stock market topics`)
        console.warn(`   Verify this matches the actual article content`)
      }
      
      if (containsWeatherKeywords) {
        console.warn(`⚠️ REASONING VALIDATION WARNING: Selection ${selection.id} reasoning contains weather/typhoon keywords`)
        console.warn(`   Many typhoon articles may already be enhanced - verify this is the correct topic`)
      }
      
      // Additional warning if reason seems generic or possibly hallucinated
      if (selection.reason.includes('business development') && selection.reason.includes('gap in') && selection.reason.includes('coverage')) {
        console.warn(`⚠️ POSSIBLE HALLUCINATION: Selection reasoning appears to be generic/templated`)
        console.warn(`   Double-check that the selected article actually matches the stated reason`)
      }
    })
    
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
  originalSelections: Array<{id: string, reason: string, score: number}>,
  sessionId: string
): Promise<void> {
  console.log(`🔐 Marking ${selectedArticles.length} articles as selected to prevent re-selection (${sessionId})...`);
  
  for (let i = 0; i < selectedArticles.length; i++) {
    const article = selectedArticles[i];
    // Find the matching selection based on the article's stored reason and score
    const selection = originalSelections.find(sel => 
      sel.reason === article.selection_reason && 
      sel.score === article.priority_score
    ) || originalSelections[i]; // Fallback to index if no match found
    
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
            selection_session: sessionId, // Track session for grouping and debugging
            selection_method: 'perplexity_ai',
            deduplication_stats: {
              candidates_before_dedup: selectedArticles.length + i, // approximation for logging
              candidates_after_dedup: selectedArticles.length,
              ai_powered_dedup: process.env.PERPLEXITY_API_KEY ? true : false
            }
          }
        })
        .eq('id', article.id);
      
      if (error) {
        console.error(`❌ Failed to mark article ${article.id} as selected:`, error);
      } else {
        console.log(`   ✓ [${sessionId}] Marked "${article.title.substring(0, 40)}..." as selected`);
      }
    } catch (error) {
      console.error(`❌ Error marking article ${article.id} as selected:`, error);
    }
  }
  
  console.log(`✅ Article marking complete (${sessionId}): ${selectedArticles.length} articles marked as selected`);
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
      .gte('created_at', getDateDaysAgo(7)) // Extended to 7 days to match candidate selection window
      .order('created_at', { ascending: false })
      .limit(50); // Increased limit to account for longer time window

    if (error) throw error;

    console.log(`📊 Deduplication check: Found ${recentEnhanced?.length || 0} enhanced articles in last 7 days`);
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
    console.log('⚠️ Perplexity API key not available for topic deduplication, using fallback keyword filtering...');
    return applyFallbackKeywordFiltering(candidateArticles, recentlyEnhancedTopics);
  }

  try {
    console.log('🔍 Using AI-powered topic similarity detection via Perplexity...');
    
    // Use AI-powered similarity detection for comprehensive topic coverage
    const similarityPrompt = createTopicSimilarityPrompt(candidateArticles, recentlyEnhancedTopics);
    const similarArticleIds = await callPerplexityForSimilarity(similarityPrompt);
    
    if (similarArticleIds.length === 0) {
      console.log('✅ No similar topics found, keeping all candidate articles');
      return candidateArticles;
    }
    
    console.log(`🔍 AI detected ${similarArticleIds.length} similar articles to filter out`);
    
    // Filter out articles identified as similar by AI
    const uniqueArticles = candidateArticles.filter((article, index) => {
      const sequentialId = (index + 1).toString(); // Convert to 1-based string
      const isSimilar = similarArticleIds.includes(sequentialId);
      
      if (isSimilar) {
        console.log(`   ⚠️ AI filtered out similar article: "${article.title.substring(0, 60)}..."`);
      }
      
      return !isSimilar;
    });
    
    console.log(`✅ AI-powered deduplication complete: ${candidateArticles.length} → ${uniqueArticles.length} unique articles`);
    return uniqueArticles;

  } catch (error) {
    console.error('❌ Error in AI topic similarity detection:', error);
    console.log('📋 Falling back to keyword-based filtering...');
    return applyFallbackKeywordFiltering(candidateArticles, recentlyEnhancedTopics);
  }
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