interface PerplexityResponse {
  id: string
  model: string
  object: string
  created: number
  choices: {
    index: number
    finish_reason: string
    message: {
      role: string
      content: string
    }
  }[]
}

interface EnhancementResult {
  enhancedContent: string
  sources: string[]
  searchQueries: string[]
  relatedTopics: string[]
}

interface EnhancementOptions {
  searchDepth?: 'high' | 'medium' | 'low'
  recencyFilter?: 'hour' | 'day' | 'week' | 'month'
  domainFilter?: string[]
  maxTokens?: number
}

class PerplexityEnhancer {
  private apiKey: string
  private baseUrl = 'https://api.perplexity.ai'
  
  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || ''
    if (!this.apiKey) {
      console.warn('PERPLEXITY_API_KEY not configured - AI enhancement features will be limited')
    }
  }

  async enhanceArticle(
    title: string,
    content: string,
    summary: string,
    options: EnhancementOptions = {}
  ): Promise<EnhancementResult> {
    if (!this.apiKey) {
      throw new Error('Perplexity API key not configured')
    }

    const searchQueries = this.generateSearchQueries(title, content)
    const enhancedContent = await this.performEnhancement(
      title,
      content,
      summary,
      searchQueries,
      options
    )

    return {
      enhancedContent: enhancedContent.content,
      sources: enhancedContent.sources,
      searchQueries,
      relatedTopics: enhancedContent.relatedTopics
    }
  }

  private generateSearchQueries(title: string, content: string): string[] {
    const queries: string[] = []
    
    // Primary topic search
    queries.push(`"${title}" latest news developments 2025`)
    
    // Extract key entities and topics from title
    const titleWords = title.split(' ').filter(word => 
      word.length > 3 && 
      !['news', 'says', 'report', 'reports', 'article'].includes(word.toLowerCase())
    )
    
    if (titleWords.length > 0) {
      queries.push(`${titleWords.slice(0, 3).join(' ')} Hong Kong recent updates`)
    }

    // Context and background search
    queries.push(`background context "${title}" Hong Kong`)
    
    // Expert analysis search
    queries.push(`expert analysis opinion "${title.split(' ').slice(0, 4).join(' ')}"`)

    return queries.slice(0, 3) // Limit to 3 queries to manage API costs
  }

  private async performEnhancement(
    title: string,
    content: string,
    summary: string,
    searchQueries: string[],
    options: EnhancementOptions
  ): Promise<{content: string, sources: string[], relatedTopics: string[]}> {
    const searchResults: string[] = []
    const allSources: Set<string> = new Set()

    // Perform searches for each query
    for (const query of searchQueries) {
      try {
        const result = await this.performSearch(query, options)
        searchResults.push(result.content)
        result.sources.forEach(source => allSources.add(source))
        
        // Rate limiting - wait 1.5 seconds between requests
        await new Promise(resolve => setTimeout(resolve, 1500))
      } catch (error) {
        console.error(`Search failed for query: ${query}`, error)
        // Continue with other queries even if one fails
      }
    }

    // Combine original content with search results
    const enhancementPrompt = this.buildEnhancementPrompt(
      title,
      content,
      summary,
      searchResults
    )

    try {
      const enhancedResult = await this.performSearch(enhancementPrompt, {
        ...options,
        maxTokens: options.maxTokens || 2000
      })

      return {
        content: enhancedResult.content,
        sources: Array.from(allSources),
        relatedTopics: this.extractRelatedTopics(enhancedResult.content)
      }
    } catch (error) {
      console.error('Enhancement generation failed:', error)
      throw new Error('Failed to generate enhanced content')
    }
  }

  private async performSearch(
    query: string,
    options: EnhancementOptions
  ): Promise<{content: string, sources: string[]}> {
    if (!this.apiKey) {
      throw new Error('Perplexity API key not configured')
    }

    const requestBody = {
      model: 'sonar-pro',
      messages: [
        {
          role: 'system',
          content: 'You are a professional news analyst. Provide accurate, well-sourced information with clear citations.'
        },
        {
          role: 'user',
          content: query
        }
      ],
      max_tokens: options.maxTokens || 1000,
      temperature: 0.3,
      search_recency_filter: options.recencyFilter || 'month',
      return_related_questions: false,
      ...(options.domainFilter && { search_domain_filter: options.domainFilter })
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Perplexity API error: ${response.status} - ${errorText}`)
    }

    const data: PerplexityResponse = await response.json()
    const content = data.choices[0]?.message?.content || ''
    
    // Extract sources from citations in the content
    const sources = this.extractSources(content)

    return { content, sources }
  }

  private buildEnhancementPrompt(
    title: string,
    content: string,
    summary: string,
    searchResults: string[]
  ): string {
    return `Please enhance this Hong Kong news article with additional context and depth based on the research provided:

ORIGINAL ARTICLE:
Title: ${title}
Summary: ${summary}
Content: ${content}

ADDITIONAL RESEARCH:
${searchResults.join('\n\n---\n\n')}

Please create an enhanced version of this article that:
1. Integrates the original content with the additional research
2. Provides broader context and background information
3. Includes relevant expert perspectives and analysis
4. Adds factual depth while maintaining journalistic integrity
5. Clearly distinguishes between original reporting and additional context
6. Maintains focus on Hong Kong perspectives and relevance

Structure the enhanced article with clear sections and maintain professional news writing standards. Include proper attribution for any additional information used.`
  }

  private extractSources(content: string): string[] {
    const sources: string[] = []
    
    // Look for common citation patterns
    const urlPattern = /https?:\/\/[^\s\)\"]+/g
    const urls = content.match(urlPattern) || []
    sources.push(...urls)

    // Look for source mentions like "according to [source]"
    const sourcePattern = /according to ([^,\.\n]+)/gi
    const sourceMentions = content.match(sourcePattern) || []
    sources.push(...sourceMentions.map(mention => mention.replace(/according to /i, '')))

    // Remove duplicates and clean up
    return Array.from(new Set(sources)).slice(0, 10) // Limit to 10 sources
  }

  private extractRelatedTopics(content: string): string[] {
    // Simple topic extraction - could be enhanced with NLP
    const topics: string[] = []
    
    // Look for topic indicators
    const topicIndicators = ['regarding', 'concerning', 'about', 'related to', 'involving']
    const sentences = content.split(/[.!?]/)
    
    for (const sentence of sentences) {
      for (const indicator of topicIndicators) {
        const index = sentence.toLowerCase().indexOf(indicator)
        if (index !== -1) {
          const topicPart = sentence.substring(index + indicator.length).trim()
          const firstWords = topicPart.split(' ').slice(0, 3).join(' ')
          if (firstWords.length > 5) {
            topics.push(firstWords)
          }
        }
      }
    }

    return Array.from(new Set(topics)).slice(0, 5) // Limit to 5 topics
  }

  // Utility method to check if API is configured
  isConfigured(): boolean {
    return !!this.apiKey
  }

  // Utility method to estimate cost (rough approximation)
  estimateEnhancementCost(contentLength: number): string {
    const estimatedTokens = Math.ceil(contentLength / 4) * 3 // Rough token estimate
    const estimatedCost = (estimatedTokens / 1000) * 0.02 // Rough cost estimate
    return `~$${estimatedCost.toFixed(4)}`
  }
}

// Export singleton instance
export const perplexityEnhancer = new PerplexityEnhancer()

// Export interface for use in other files
export type { EnhancementResult, EnhancementOptions }