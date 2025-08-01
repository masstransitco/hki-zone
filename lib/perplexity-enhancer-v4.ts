import type { TrilingualResult, EnhancementOptions } from './perplexity-enhancer-v2';
import {
  SearchResult,
  withExponentialBackoff,
  dedupeGlobally,
  getMinSourcesFor,
  safeSearch,
  rankSearchResults,
  extractKeyPhrases,
  EnhancementConfig,
  defaultConfig
} from './enhancement-helpers';

export class PerplexityEnhancerV4 {
  private apiKey: string;
  private baseUrl = 'https://api.perplexity.ai';
  private config: EnhancementConfig;
  
  // Trusted domains for citation validation (max 10 for Perplexity API)
  private readonly TRUSTED_DOMAINS = [
    'news.gov.hk', 'info.gov.hk', 'rthk.hk', 
    'scmp.com', 'hk01.com', 'am730.com.hk',
    'mingpao.com', 'on.cc', 'hket.com', 'thestandard.com.hk'
  ];
  
  constructor(config: Partial<EnhancementConfig> = {}) {
    this.apiKey = process.env.PERPLEXITY_API_KEY || '';
    this.config = { ...defaultConfig, ...config };
    
    if (!this.apiKey) {
      console.warn('PERPLEXITY_API_KEY not configured - AI enhancement features will be limited');
    }
  }
  
  /**
   * Two-phase enhancement: Explicit search followed by augmented generation
   */
  async enhanceTrilingualTwoPhase(
    title: string,
    content: string,
    summary: string,
    options: EnhancementOptions = {}
  ): Promise<TrilingualResult> {
    console.log('🔍 Phase 1: Performing explicit searches...');
    
    // Generate diverse search queries with key phrase extraction
    const searchQueries = this.generateEnhancedSearchQueries(title, content);
    console.log(`   Generated ${searchQueries.length} search queries`);
    
    // Perform searches with error handling and retries
    const allSearchResults = await this.performMultipleSearchesWithRetry(searchQueries.slice(0, 5), options);
    console.log(`   Found ${allSearchResults.length} total search results`);
    
    // Global deduplication and ranking
    const uniqueResults = rankSearchResults(dedupeGlobally(allSearchResults));
    console.log(`   Deduplicated to ${uniqueResults.length} unique sources`);
    
    console.log('\n📝 Phase 2: Generating trilingual content with search context...');
    
    // Calculate dynamic citation requirements
    const minSources = getMinSourcesFor(content);
    const topResults = uniqueResults.slice(0, this.config.maxSearchResults || 10);
    
    // Build enhanced prompt with dynamic requirements
    const enhancedPrompt = this.buildAugmentedTrilingualPrompt(
      title,
      content,
      summary,
      topResults,
      minSources
    );
    
    // Generate trilingual content with retry logic
    const response = await withExponentialBackoff(
      () => this.performTrilingualGeneration(enhancedPrompt, options),
      this.config.maxRetries,
      this.config.baseDelay
    );
    
    const result = this.parseTrilingualResponse(response, title);
    
    // Ensure minimum sources are included
    this.enrichWithSearchResults(result, topResults, minSources);
    
    return result;
  }
  
  /**
   * Generate enhanced search queries using key phrase extraction
   */
  private generateEnhancedSearchQueries(title: string, content: string): string[] {
    const queries: string[] = [];
    
    // Primary topic search
    queries.push(`"${title}" Hong Kong latest news 2025`);
    
    // Extract key phrases from content
    const keyPhrases = extractKeyPhrases(content);
    keyPhrases.forEach(phrase => {
      queries.push(`${phrase} Hong Kong recent updates`);
    });
    
    // Add fallback queries from existing method
    queries.push(...this.generateSearchQueries(title, content));
    
    // Remove duplicates
    return [...new Set(queries)].slice(0, 7);
  }
  
  /**
   * Perform multiple searches with retry and error handling
   */
  private async performMultipleSearchesWithRetry(
    queries: string[],
    options: EnhancementOptions
  ): Promise<SearchResult[]> {
    const searchPromises = queries.map(async (query, index) => {
      // Stagger requests to avoid rate limiting
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, 200 * index));
      }
      
      return safeSearch(
        (q) => this.performDedicatedSearch(q, options),
        query
      );
    });
    
    const results = await Promise.all(searchPromises);
    return results.flat();
  }
  
  /**
   * Perform a dedicated search using Perplexity's search capabilities
   */
  private async performDedicatedSearch(
    query: string,
    options: EnhancementOptions
  ): Promise<SearchResult[]> {
    const requestBody = {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'You are a search engine. Find and return relevant recent news articles and sources. Include URLs in your response.'
        },
        {
          role: 'user',
          content: `Search for: ${query}. Return the top 5 most relevant and recent results with their URLs.`
        }
      ],
      max_tokens: 1000,
      temperature: 0.1,
      search_recency_filter: options.recencyFilter || 'day',
      return_related_questions: false,
      search_domain_filter: this.TRUSTED_DOMAINS
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Search API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract sources from API response metadata
    const searchResults: SearchResult[] = [];
    
    // Check search_results in response
    if (data.search_results && Array.isArray(data.search_results)) {
      data.search_results.forEach((result: any) => {
        searchResults.push({
          title: result.title || 'Source',
          url: result.url,
          snippet: result.snippet || '',
          domain: this.extractDomain(result.url),
          date: result.date || result.last_updated
        });
      });
    }
    
    // Also check citations
    if (data.citations && Array.isArray(data.citations)) {
      data.citations.forEach((url: string, index: number) => {
        // Avoid duplicates
        if (!searchResults.some(r => r.url === url)) {
          searchResults.push({
            title: `Source ${index + 1}`,
            url: url,
            snippet: '',
            domain: this.extractDomain(url)
          });
        }
      });
    }
    
    // Extract any URLs from the content as fallback
    const content = data.choices[0]?.message?.content || '';
    const urlRegex = /https?:\/\/[^\s\)\]]+/g;
    const contentUrls = content.match(urlRegex) || [];
    
    contentUrls.forEach((url: string) => {
      if (!searchResults.some(r => r.url === url)) {
        searchResults.push({
          title: this.extractTitleFromUrl(url),
          url: url,
          snippet: '',
          domain: this.extractDomain(url)
        });
      }
    });
    
    return searchResults;
  }
  
  
  /**
   * Build prompt with explicit search results and dynamic requirements
   */
  private buildAugmentedTrilingualPrompt(
    title: string,
    content: string,
    summary: string,
    searchResults: SearchResult[],
    minSources: number
  ): string {
    const searchResultsText = searchResults.map((result, index) => 
      `[${index + 1}] ${result.title} (${result.url})${result.snippet ? `: ${result.snippet.substring(0, 100)}...` : ''}`
    ).join('\n');
    
    return `You are an experienced Hong Kong news editor with deep knowledge of local context. Below is an article and ${searchResults.length} search results.

--- ARTICLE ---
Title: ${title}
Summary: ${summary}
Content: ${content}

--- SEARCH RESULTS ---
${searchResultsText}

--- EDITORIAL MISSION ---
Use the search results to uncover deeper context about the people, places, organizations, and events mentioned in the story. Transform surface-level reporting into knowledge-rich journalism by connecting dots that others miss.

--- EDITORIAL STANDARDS ---
CONCISENESS: Maximum 5 key points, each under 25 words
CONTEXTUAL INTELLIGENCE: Mine search results for background on key figures, institutional histories, geographic significance, and historical precedents
KNOWLEDGE VALUE: Reveal insights about relationships, motivations, and broader implications that aren't obvious from the basic story
VOICE: Authoritative but accessible, avoiding generic statements

--- TASK ---
Create enhanced trilingual versions that deliver unique contextual knowledge for Hong Kong readers.

CONTENT REQUIREMENTS:
1. Summary: 2 impactful sentences explaining immediate significance with citations [1]
2. Key Points: Maximum 5 points, prioritize by reader impact:
   - Lead with most consequential development
   - Include specific background on people/organizations from search results
   - Add historical context or precedents where relevant
   - Reveal connections or relationships not apparent in original story
3. Why It Matters: CRITICAL - Use search context to reveal deeper significance:
   - Background on key players and their track records
   - Historical context of similar events/decisions
   - Broader implications for stakeholder relationships
   - Unique insights about motivations, timing, or strategic positioning
4. Citations: Use ${minSources}+ sources, emphasizing those with contextual depth

CITATION RULES:
- Use citations ONLY at the END of sentences, never mid-sentence
- Format: "Complete sentence [1]." or "Complete sentence [1][2]."
- NEVER use patterns like "[1].[1]" or "[1][5].[2]"
- Each citation number should appear only once per sentence

Return ONLY valid JSON:
{
  "en": {
    "title": "8-12 word active title with strong verbs",
    "summary": "First sentence with key impact [1]. Second sentence with significance [2].",
    "content": "<p>Contextually enriched paragraph with background insights [1][2].</p>",
    "key_points": [
      "Most impactful point with specific detail [1]",
      "Second priority point with contextual background [2]", 
      "Third point revealing connections or relationships [3]",
      "Fourth point with historical context or precedent [4]",
      "Fifth point on broader implications [5]"
    ],
    "why_it_matters": "First sentence revealing deeper context about key players or institutional backgrounds [1]. Second sentence on strategic implications that transform this into knowledge-rich insight [2].",
    "citations": [
      {"text": "${searchResults[0]?.title || 'Source 1'}", "url": "${searchResults[0]?.url || ''}"},
      {"text": "${searchResults[1]?.title || 'Source 2'}", "url": "${searchResults[1]?.url || ''}"}
    ]
  },
  "zh_HK": { ... same structure in Traditional Chinese ... },
  "zh_CN": { ... same structure in Simplified Chinese ... }
}`;
  }
  
  /**
   * Generate trilingual content using the enhanced prompt
   */
  private async performTrilingualGeneration(prompt: string, options: EnhancementOptions): Promise<string> {
    const requestBody = {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'You are an expert trilingual news editor. Generate enhanced content incorporating the provided search results with proper citations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: options.maxTokens || 6000,
      temperature: 0.2
    };

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(60000) // 60 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details');
        throw new Error(`Generation API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '{}';
      
      // Validate the response is valid JSON
      try {
        JSON.parse(content);
      } catch (parseError) {
        console.error('Invalid JSON response from generation:', content.substring(0, 200));
        throw new Error('Invalid JSON response from generation API');
      }
      
      return content;
    } catch (error: any) {
      // Add more context to the error
      if (error.name === 'AbortError') {
        throw new Error('Generation request timed out after 60 seconds');
      }
      
      // Log network errors with more detail
      if (error.code === 'UND_ERR_SOCKET' || error.cause?.code === 'UND_ERR_SOCKET') {
        console.error('Socket error in generation:', error.message);
        throw new Error(`Network error during generation: ${error.message}`);
      }
      
      throw error;
    }
  }
  
  /**
   * Ensure the result includes minimum required sources
   */
  private enrichWithSearchResults(
    result: TrilingualResult, 
    searchResults: SearchResult[],
    minSources: number
  ): void {
    ['en', 'zh_HK', 'zh_CN'].forEach(lang => {
      const langResult = result[lang as keyof TrilingualResult];
      
      // Ensure we have at least minSources citations
      if (langResult.citations.length < minSources && searchResults.length > 0) {
        const existingUrls = new Set(langResult.citations.map(c => c.url));
        const additionalSources = searchResults
          .filter(sr => !existingUrls.has(sr.url))
          .slice(0, minSources - langResult.citations.length);
        
        langResult.citations.push(...additionalSources.map(sr => ({
          text: sr.title,
          url: sr.url
        })));
      }
      
      // Log citation coverage
      console.log(`   ${lang}: ${langResult.citations.length} citations (min: ${minSources})`);
    });
  }
  
  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }
  
  /**
   * Generate search queries from title and content
   */
  private generateSearchQueries(title: string, content: string): string[] {
    const queries: string[] = [];
    
    // Primary topic search
    queries.push(`"${title}" Hong Kong latest news 2025`);
    
    // Extract key entities from title
    const titleWords = title.split(' ').filter(word => 
      word.length > 3 && 
      !['news', 'says', 'report', 'reports', 'article'].includes(word.toLowerCase())
    );
    
    if (titleWords.length > 0) {
      queries.push(`${titleWords.slice(0, 3).join(' ')} Hong Kong recent updates`);
    }
    
    // Add context-specific query
    if (content.length > 100) {
      const firstSentence = content.substring(0, 100).split(/[.!?]/)[0];
      queries.push(`${firstSentence} Hong Kong news`);
    }
    
    return queries.slice(0, 5); // Limit to 5 queries
  }
  
  /**
   * Extract title from URL
   */
  private extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      
      // Common Hong Kong news sources
      const domainTitles: { [key: string]: string } = {
        'scmp.com': 'South China Morning Post',
        'hongkongfp.com': 'Hong Kong Free Press',
        'rthk.hk': 'RTHK',
        'news.gov.hk': 'Hong Kong Government News',
        'info.gov.hk': 'Hong Kong Government News',
        'hk01.com': 'HK01',
        'mingpao.com': 'Ming Pao',
        'on.cc': 'Oriental Daily'
      };
      
      return domainTitles[domain] || domain;
    } catch {
      return 'News Source';
    }
  }
  
  /**
   * Parse trilingual response
   */
  private parseTrilingualResponse(content: string, originalTitle: string): TrilingualResult {
    try {
      const parsed = JSON.parse(content);
      
      // Validate structure
      if (!parsed.en || !parsed.zh_HK || !parsed.zh_CN) {
        throw new Error('Missing language versions in response');
      }
      
      // Ensure all required fields exist
      ['en', 'zh_HK', 'zh_CN'].forEach(lang => {
        const version = parsed[lang];
        version.key_points = version.key_points || [];
        version.citations = version.citations || [];
      });
      
      return parsed as TrilingualResult;
    } catch (error) {
      console.error('Failed to parse trilingual response:', error);
      // Return a basic fallback
      return this.createFallbackTrilingualResult(originalTitle);
    }
  }
  
  /**
   * Create fallback trilingual result
   */
  private createFallbackTrilingualResult(title: string): TrilingualResult {
    const fallback = {
      title: title,
      summary: 'Enhanced content is being processed.',
      content: '<p>Enhanced content is being processed.</p>',
      key_points: ['Content is being enhanced'],
      why_it_matters: 'This article is relevant to Hong Kong.',
      citations: []
    };

    return {
      en: { ...fallback },
      zh_HK: {
        ...fallback,
        title: title,
        summary: '增強內容正在處理中。',
        content: '<p>增強內容正在處理中。</p>',
        key_points: ['內容正在增強'],
        why_it_matters: '這篇文章與香港相關。'
      },
      zh_CN: {
        ...fallback,
        title: title,
        summary: '增强内容正在处理中。',
        content: '<p>增强内容正在处理中。</p>',
        key_points: ['内容正在增强'],
        why_it_matters: '这篇文章与香港相关。'
      }
    };
  }
}

// Export singleton with default config
export const perplexityEnhancerV4 = new PerplexityEnhancerV4();