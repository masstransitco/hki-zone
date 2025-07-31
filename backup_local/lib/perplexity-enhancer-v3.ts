import { PerplexityEnhancerV2 } from './perplexity-enhancer-v2';

interface SearchResult {
  content: string;
  sources: Array<{
    url: string;
    title: string;
    domain: string;
    snippet: string;
  }>;
}

export class PerplexityEnhancerV3 extends PerplexityEnhancerV2 {
  
  async enhanceTrilingualWithSearch(
    title: string,
    content: string,
    summary: string,
    options: any = {}
  ) {
    // Step 1: Perform dedicated search
    console.log('🔍 Step 1: Performing web search...');
    const searchQuery = `"${title}" Hong Kong latest news updates 2025 current developments`;
    
    const searchResults = await this.performWebSearch(searchQuery, options);
    console.log(`   Found ${searchResults.sources.length} sources`);
    
    // Step 2: Build enhanced prompt with search context
    const enhancedPrompt = this.buildEnhancedTrilingualPrompt(
      title,
      content,
      summary,
      searchResults
    );
    
    // Step 3: Generate trilingual content with search context
    console.log('📝 Step 2: Generating trilingual content with search context...');
    const response = await this.performTrilingualGeneration(enhancedPrompt, options);
    
    // Step 4: Parse and enrich with sources
    const result = this.parseTrilingualResponse(response, title);
    
    // Ensure all sources are included
    if (searchResults.sources.length > 0) {
      result.en.citations = searchResults.sources.map(s => ({
        text: s.title || s.snippet,
        url: s.url
      }));
      result.zh_HK.citations = result.en.citations;
      result.zh_CN.citations = result.en.citations;
    }
    
    return result;
  }
  
  private async performWebSearch(query: string, options: any): Promise<SearchResult> {
    const requestBody = {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'Search for recent information and return relevant sources with URLs.'
        },
        {
          role: 'user',
          content: query
        }
      ],
      max_tokens: 1000,
      temperature: 0.1,
      search_recency_filter: 'day',
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
    const content = data.choices[0]?.message?.content || '';
    
    // Extract sources from response
    const sources = this.extractSourcesFromContent(content);
    
    return { content, sources };
  }
  
  private extractSourcesFromContent(content: string): SearchResult['sources'] {
    const sources: SearchResult['sources'] = [];
    
    // Look for URLs in the content
    const urlRegex = /https?:\/\/[^\s\)]+/g;
    const urls = content.match(urlRegex) || [];
    
    urls.forEach((url, index) => {
      try {
        const urlObj = new URL(url);
        sources.push({
          url: url,
          title: `Source ${index + 1}`,
          domain: urlObj.hostname.replace('www.', ''),
          snippet: ''
        });
      } catch (e) {
        // Invalid URL, skip
      }
    });
    
    return sources;
  }
  
  private buildEnhancedTrilingualPrompt(
    title: string,
    content: string,
    summary: string,
    searchResults: SearchResult
  ): string {
    return `Based on this search context and recent information:

${searchResults.content}

Sources found:
${searchResults.sources.map((s, i) => `[${i + 1}] ${s.url}`).join('\n')}

Now generate enhanced versions of this article in THREE languages (English, Traditional Chinese, Simplified Chinese).

ORIGINAL ARTICLE:
Title: ${title}
Summary: ${summary}
Content: ${content}

REQUIREMENTS:
- Include citations [1], [2], etc. from the sources above
- Reference recent developments from the search results
- Each language version must have proper citations

Return ONLY a valid JSON object with this EXACT structure:
{
  "en": {
    "title": "8-12 word title with active verb",
    "summary": "Exactly 2 sentences with citations [1]",
    "content": "Enhanced content with citations",
    "key_points": ["Point with citation [1]", "Point with citation [2]", ...],
    "why_it_matters": "2 sentences about significance with citations",
    "citations": [{"text": "Source description", "url": "https://..."}, ...]
  },
  "zh_HK": { ... same structure ... },
  "zh_CN": { ... same structure ... }
}`;
  }
  
  private async performTrilingualGeneration(prompt: string, options: any): Promise<string> {
    const requestBody = {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'You are an HKI Senior News Editor. Generate trilingual enhanced content with proper citations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: options.maxTokens || 2500,
      temperature: 0.2
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
      throw new Error(`Generation API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '{}';
  }
}

export const perplexityEnhancerV3 = new PerplexityEnhancerV3();