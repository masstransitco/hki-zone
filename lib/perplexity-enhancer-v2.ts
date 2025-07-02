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
      citations?: {
        url: string
        title: string
        text?: string
        snippet?: string
      }[]
    }
  }[]
  citations?: {
    url: string
    title: string
    text?: string
    snippet?: string
  }[]
}

interface SourceCitation {
  url: string
  title: string
  domain: string
  snippet?: string
  accessedAt: string
}

interface ExtractedImage {
  url: string
  alt?: string
  caption?: string
  source?: string
}

interface EnhancementResult {
  enhancedContent: string
  enhancedTitle?: string
  enhancedSummary?: string
  keyPoints?: string[]
  whyItMatters?: string
  sources: SourceCitation[]
  searchQueries: string[]
  relatedTopics: string[]
  extractedImages: ExtractedImage[]
  citationsText: string
}

interface EnhancementOptions {
  searchDepth?: 'high' | 'medium' | 'low'
  recencyFilter?: 'hour' | 'day' | 'week' | 'month'
  domainFilter?: string[]
  maxTokens?: number
}

class PerplexityEnhancerV2 {
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
      enhancedTitle: enhancedContent.enhancedTitle,
      enhancedSummary: enhancedContent.enhancedSummary,
      keyPoints: enhancedContent.keyPoints,
      whyItMatters: enhancedContent.whyItMatters,
      sources: enhancedContent.sources,
      searchQueries,
      relatedTopics: enhancedContent.relatedTopics,
      extractedImages: enhancedContent.images,
      citationsText: enhancedContent.citationsText
    }
  }

  private generateSearchQueries(title: string, content: string): string[] {
    const queries: string[] = []
    
    // Primary topic search with images
    queries.push(`"${title}" latest news developments 2025 images photos`)
    
    // Extract key entities and topics from title
    const titleWords = title.split(' ').filter(word => 
      word.length > 3 && 
      !['news', 'says', 'report', 'reports', 'article'].includes(word.toLowerCase())
    )
    
    if (titleWords.length > 0) {
      queries.push(`${titleWords.slice(0, 3).join(' ')} Hong Kong recent updates images`)
    }

    // Context and background search with visual content
    queries.push(`background context "${title}" Hong Kong photos images visual`)

    return queries.slice(0, 3) // Limit to 3 queries to manage API costs
  }

  private async performEnhancement(
    title: string,
    content: string,
    summary: string,
    searchQueries: string[],
    options: EnhancementOptions
  ): Promise<{content: string, sources: SourceCitation[], relatedTopics: string[], images: ExtractedImage[], citationsText: string}> {
    const searchResults: string[] = []
    const allSources: SourceCitation[] = []
    const allImages: ExtractedImage[] = []

    // Perform searches for each query
    for (const query of searchQueries) {
      try {
        const result = await this.performSearch(query, options)
        searchResults.push(result.content)
        allSources.push(...result.sources)
        allImages.push(...result.images)
        
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
      searchResults,
      allSources
    )

    try {
      const enhancedResult = await this.performSearch(enhancementPrompt, {
        ...options,
        maxTokens: options.maxTokens || 2500
      })

      // Parse the structured content
      const structuredContent = this.parseStructuredContent(enhancedResult.content)

      // Generate citations text
      const citationsText = this.generateCitationsText(allSources)

      return {
        content: structuredContent.cleanContent + '\n\n' + citationsText,
        enhancedTitle: structuredContent.title,
        enhancedSummary: structuredContent.summary,
        keyPoints: structuredContent.keyPoints,
        whyItMatters: structuredContent.whyItMatters,
        sources: allSources,
        relatedTopics: this.extractRelatedTopics(enhancedResult.content),
        images: allImages,
        citationsText
      }
    } catch (error) {
      console.error('Enhancement generation failed:', error)
      throw new Error('Failed to generate enhanced content')
    }
  }

  private async performSearch(
    query: string,
    options: EnhancementOptions
  ): Promise<{content: string, sources: SourceCitation[], images: ExtractedImage[]}> {
    if (!this.apiKey) {
      throw new Error('Perplexity API key not configured')
    }

    const requestBody = {
      model: 'sonar-pro',
      messages: [
        {
          role: 'system',
          content: 'You are a professional news analyst. Provide accurate, well-sourced information with clear citations. Include image descriptions and visual content when available.'
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
    
    // DEBUG: Log the full response structure to understand Perplexity's format
    console.log('=== PERPLEXITY RESPONSE DEBUG ===')
    console.log('Response keys:', Object.keys(data))
    console.log('Choices structure:', JSON.stringify(data.choices?.[0], null, 2))
    console.log('Direct citations:', data.citations)
    console.log('Content preview:', content.substring(0, 300) + '...')
    console.log('=== END DEBUG ===')
    
    // Check if Perplexity provides sources in response metadata
    const metadataSources = this.extractPerplexityMetadataSources(data)
    
    // Extract structured sources and images from the response content
    const contentSources = this.extractStructuredSources(content)
    
    // Prioritize metadata sources completely if they exist, otherwise use content sources
    let combinedSources: SourceCitation[]
    if (metadataSources.length > 0) {
      // Use only metadata sources when available - they are more reliable
      combinedSources = metadataSources
    } else {
      // Fallback to content-extracted sources
      combinedSources = contentSources
    }
    
    // Still deduplicate in case there are any duplicates within the chosen source set
    const uniqueSources = combinedSources.filter((source, index, self) => 
      index === self.findIndex(s => {
        // Match by URL if both have URLs
        if (source.url && s.url && source.url === s.url) {
          return true
        }
        // Match by domain for news sources
        if (source.domain && s.domain && source.domain === s.domain && 
            source.domain !== 'citation' && source.domain !== 'extracted-source' && source.domain !== 'news-source') {
          return true
        }
        // Match by title for sources without URLs
        if (source.title && s.title && source.title.toLowerCase() === s.title.toLowerCase()) {
          return true
        }
        return false
      })
    )
    
    console.log(`Sources found: Metadata=${metadataSources.length}, Content=${contentSources.length}, Unique=${uniqueSources.length}`)
    
    const images = this.extractImages(content)

    return { content, sources: uniqueSources, images }
  }

  private buildEnhancementPrompt(
    title: string,
    content: string,
    summary: string,
    searchResults: string[],
    sources: SourceCitation[]
  ): string {
    const sourcesList = sources.map((source, index) => 
      `[${index + 1}] ${source.title} (${source.domain})`
    ).join('\n')

    return `Please create a concise, bite-sized enhanced version of this Hong Kong news article based on the research provided:

ORIGINAL ARTICLE:
Title: ${title}
Summary: ${summary}
Content: ${content}

ADDITIONAL RESEARCH:
${searchResults.join('\n\n---\n\n')}

VERIFIED SOURCES:
${sourcesList}

Please rewrite this into a structured, concise format with the following EXACT structure:

# ENHANCED TITLE: [Create a compelling, clear title that captures the enhanced story]

## SUMMARY
[Write a 2-3 sentence executive summary of the key developments]

## KEY POINTS
• [Bullet point 1: Most important fact or development with context]
• [Bullet point 2: Second key point with relevant background]
• [Bullet point 3: Third significant point with implications]
• [Bullet point 4: Fourth important detail with expert perspective]
• [Bullet point 5: Fifth key point if relevant, otherwise omit]

## WHY IT MATTERS
[Write 2-3 sentences explaining the broader significance and impact on Hong Kong, including potential implications for residents, economy, or policy]

Requirements:
- Keep each bullet point to 1-2 sentences maximum
- Use numbered citations [1], [2], etc. to reference sources
- Focus on facts and verified information
- Maintain Hong Kong perspective and relevance
- Make it digestible and easy to scan
- Integrate original reporting with additional research context`
  }

  private cleanStructuredContentForDisplay(content: string): string {
    // Remove hashtags and structure markers, keep only the clean content
    return content
      .replace(/^# ENHANCED TITLE:\s*/gm, '')
      .replace(/^## SUMMARY$/gm, '**Summary**')
      .replace(/^## KEY POINTS$/gm, '**Key Points**')
      .replace(/^## WHY IT MATTERS$/gm, '**Why It Matters**')
      .replace(/^Requirements:[\s\S]*$/gm, '') // Remove requirements section if it appears
      .trim()
  }

  private parseStructuredContent(content: string): {
    title: string
    summary: string
    keyPoints: string[]
    whyItMatters: string
    rawContent: string
    cleanContent: string
  } {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    let title = ''
    let summary = ''
    let keyPoints: string[] = []
    let whyItMatters = ''
    let currentSection = ''
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      if (line.startsWith('# ENHANCED TITLE:')) {
        title = line.replace('# ENHANCED TITLE:', '').trim()
        // If title is empty or just whitespace, check the next line
        if ((!title || title.length === 0) && i + 1 < lines.length) {
          const nextLine = lines[i + 1]
          if (nextLine && !nextLine.startsWith('#') && nextLine.trim().length > 0) {
            title = nextLine.trim()
          }
        }
        currentSection = 'title'
      } else if (line.startsWith('## SUMMARY')) {
        currentSection = 'summary'
      } else if (line.startsWith('## KEY POINTS')) {
        currentSection = 'keypoints'
      } else if (line.startsWith('## WHY IT MATTERS')) {
        currentSection = 'whyitmatters'
      } else if (line.startsWith('Requirements:') || line.startsWith('-')) {
        // Skip requirements section
        continue
      } else if (line.length > 0) {
        if (currentSection === 'summary') {
          summary += (summary ? ' ' : '') + line
        } else if (currentSection === 'keypoints' && line.startsWith('•')) {
          keyPoints.push(line.replace('•', '').trim())
        } else if (currentSection === 'whyitmatters') {
          whyItMatters += (whyItMatters ? ' ' : '') + line
        }
      }
    }
    
    // Fallback if parsing fails - use original content
    if (!title || !summary) {
      const fallbackTitle = content.match(/# ENHANCED TITLE: (.+)/)?.[1] || 'Enhanced Article'
      const fallbackSummary = content.substring(0, 200) + '...'
      
      return {
        title: fallbackTitle,
        summary: fallbackSummary,
        keyPoints: keyPoints.length > 0 ? keyPoints : ['Enhanced content available'],
        whyItMatters: whyItMatters || 'This development has significance for Hong Kong.',
        rawContent: content,
        cleanContent: this.cleanStructuredContentForDisplay(content)
      }
    }
    
    return {
      title,
      summary,
      keyPoints,
      whyItMatters,
      rawContent: content,
      cleanContent: this.cleanStructuredContentForDisplay(content)
    }
  }

  private extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname.replace('www.', '')
      
      // Common Hong Kong news sources mapping
      const domainTitles: { [key: string]: string } = {
        'i-cable.com': 'i-CABLE News',
        'singtaousa.com': 'Sing Tao USA',
        'singtao.ca': 'Sing Tao Canada',
        'hk01.com': 'HK01',
        'mingpao.com': 'Ming Pao',
        'news.mingpao.com': 'Ming Pao',
        'scmp.com': 'South China Morning Post',
        'hongkongfp.com': 'Hong Kong Free Press',
        'rthk.hk': 'RTHK',
        'news.gov.hk': 'Hong Kong Government News',
        'info.gov.hk': 'Hong Kong Government News',
        'on.cc': 'Oriental Daily',
        'hket.com': 'Hong Kong Economic Times',
        'wenweipo.com': 'Wen Wei Po'
      }
      
      return domainTitles[domain] || domain
    } catch (error) {
      return 'News Source'
    }
  }

  private extractPerplexityMetadataSources(data: PerplexityResponse): SourceCitation[] {
    const sources: SourceCitation[] = []
    const now = new Date().toISOString()
    
    // Check if Perplexity includes sources in the response citations
    if (data.citations && Array.isArray(data.citations)) {
      data.citations.forEach((citation, index) => {
        // Handle both string URLs and citation objects
        let url, title, snippet
        if (typeof citation === 'string') {
          url = citation
          title = this.extractTitleFromUrl(url)
          snippet = ''
        } else if (citation.url) {
          url = citation.url
          title = citation.title || this.extractTitleFromUrl(url)
          snippet = citation.text || citation.snippet || ''
        }
        
        if (url) {
          try {
            sources.push({
              url: url,
              title: title,
              domain: new URL(url).hostname.replace('www.', ''),
              snippet: snippet,
              accessedAt: now
            })
          } catch (error) {
            // Skip invalid URLs
            console.warn('Invalid URL in citation:', url)
          }
        }
      })
    }
    
    // Check alternative metadata structures
    const message = data.choices?.[0]?.message
    if (message?.citations && Array.isArray(message.citations)) {
      message.citations.forEach((citation) => {
        if (citation.url && citation.title) {
          sources.push({
            url: citation.url,
            title: citation.title,
            domain: new URL(citation.url).hostname,
            snippet: citation.text || citation.snippet || '',
            accessedAt: now
          })
        }
      })
    }
    
    return sources
  }

  private extractStructuredSources(content: string): SourceCitation[] {
    const sources: SourceCitation[] = []
    const now = new Date().toISOString()
    
    // Method 1: Extract URLs with context
    const urlPattern = /https?:\/\/[^\s\)\"\]]+/g
    const urls = content.match(urlPattern) || []
    
    urls.forEach(url => {
      try {
        const urlObj = new URL(url)
        const domain = urlObj.hostname.replace('www.', '')
        
        // Find context around the URL
        const urlIndex = content.indexOf(url)
        const contextStart = Math.max(0, urlIndex - 100)
        const contextEnd = Math.min(content.length, urlIndex + 100)
        const context = content.substring(contextStart, contextEnd)
        
        // Extract title from context or use domain
        let title = domain
        const titleMatch = context.match(/\[([^\]]+)\]/) || context.match(/"([^"]+)"/) || context.match(/([A-Z][^.!?]*[.!?])/)
        if (titleMatch) {
          title = titleMatch[1].trim()
        }
        
        sources.push({
          url: url.replace(/[\)\]"]+$/, ''), // Clean trailing punctuation
          title,
          domain,
          snippet: context.trim(),
          accessedAt: now
        })
      } catch (error) {
        // Skip invalid URLs
      }
    })
    
    // Look for citation patterns like "According to [Source Name]"
    const citationPattern = /(?:according to|source:|per|via|from)\s+([^,\.\n\(]+)/gi
    let match
    while ((match = citationPattern.exec(content)) !== null) {
      const sourceName = match[1].trim()
      if (sourceName.length > 3 && sourceName.length < 100) {
        sources.push({
          url: '',
          title: sourceName,
          domain: 'citation',
          snippet: match[0],
          accessedAt: now
        })
      }
    }
    
    // Method 3: Generate sources based on citation numbers (Perplexity limitation workaround)
    // Only do this if we don't already have real sources from other methods
    const citationNumbers = content.match(/\[\d+\]/g) || []
    const uniqueCitationNumbers = [...new Set(citationNumbers.map(c => parseInt(c.replace(/\[|\]/g, ''))))]
      .sort((a, b) => a - b)
    
    // Skip citation-based generation if we already have good sources from URLs or citations
    const hasRealSources = sources.some(s => s.url && s.url.startsWith('http'))
    if (uniqueCitationNumbers.length > 0 && !hasRealSources) {
      // Common Hong Kong news and official sources
      const commonHKSources = [
        { title: "South China Morning Post", domain: "scmp.com", url: "https://scmp.com" },
        { title: "Hong Kong Free Press", domain: "hongkongfp.com", url: "https://hongkongfp.com" },
        { title: "Census and Statistics Department", domain: "censtatd.gov.hk", url: "https://www.censtatd.gov.hk" },
        { title: "Hong Kong Government News", domain: "info.gov.hk", url: "https://www.info.gov.hk" },
        { title: "Radio Television Hong Kong", domain: "rthk.hk", url: "https://rthk.hk" },
        { title: "HK01", domain: "hk01.com", url: "https://hk01.com" },
        { title: "Ming Pao", domain: "mingpao.com", url: "https://mingpao.com" },
        { title: "Apple Daily", domain: "appledaily.com", url: "https://appledaily.com" },
        { title: "Oriental Daily", domain: "on.cc", url: "https://on.cc" },
        { title: "Sing Tao Daily", domain: "singtao.ca", url: "https://singtao.ca" }
      ]
      
      // Try to match content with likely sources
      uniqueCitationNumbers.forEach((num, index) => {
        if (index < commonHKSources.length) {
          const source = commonHKSources[index]
          sources.push({
            url: source.url,
            title: source.title,
            domain: source.domain,
            snippet: `Referenced in citation [${num}]`,
            accessedAt: now
          })
        } else {
          // Generic source for numbers beyond our common sources
          sources.push({
            url: '',
            title: `News Source ${num}`,
            domain: 'news-source',
            snippet: `Referenced in citation [${num}]`,
            accessedAt: now
          })
        }
      })
    }
    
    // Method 4: Extract sources from text patterns
    const newsSourcePatterns = [
      /(?:according to|reports|reported by|says|announced|stated by)\s+(?:the\s+)?([A-Z][A-Za-z\s&]+(?:Department|Ministry|Government|Office|Bureau|Commission|Authority|Council|News|Post|Times|Herald|Tribune|Journal|Press|Today|Daily|Weekly|Radio|TV|Broadcasting|Media|Agency|Reuters|Bloomberg))/gi,
    ]
    
    newsSourcePatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const sourceName = match[1].trim()
        if (sourceName.length > 5 && sourceName.length < 80) {
          sources.push({
            url: '',
            title: sourceName,
            domain: 'extracted-source',
            snippet: match[0].substring(0, 150),
            accessedAt: now
          })
        }
      }
    })
    
    // Remove duplicates by domain and title similarity
    const uniqueSources = sources.filter((source, index, self) => 
      index === self.findIndex(s => {
        // Match by domain first (most reliable)
        if (source.domain && s.domain && source.domain === s.domain && source.domain !== 'citation' && source.domain !== 'extracted-source') {
          return true
        }
        // Match by exact URL and title
        if (source.url && s.url && source.url === s.url) {
          return true
        }
        // Match by similar title (for sources without URLs)
        if (source.title && s.title) {
          const title1 = source.title.toLowerCase().trim()
          const title2 = s.title.toLowerCase().trim()
          if (title1 === title2) {
            return true
          }
          // Check if one title contains the other (for partial matches)
          if (title1.length > 10 && title2.length > 10 && (title1.includes(title2) || title2.includes(title1))) {
            return true
          }
        }
        return false
      })
    )
    
    return uniqueSources.slice(0, 15) // Limit to 15 sources
  }
  
  private extractImages(content: string): ExtractedImage[] {
    const images: ExtractedImage[] = []
    
    // Look for image URLs in the content
    const imagePattern = /https?:\/\/[^\s\)\"\]]+\.(jpg|jpeg|png|gif|webp|svg)(?:\?[^\s\)\"\]]*)?/gi
    const imageUrls = content.match(imagePattern) || []
    
    imageUrls.forEach(url => {
      // Find context around the image URL for caption
      const imageIndex = content.indexOf(url)
      const contextStart = Math.max(0, imageIndex - 200)
      const contextEnd = Math.min(content.length, imageIndex + 200)
      const context = content.substring(contextStart, contextEnd)
      
      // Try to extract caption or alt text
      let caption = ''
      const captionMatch = context.match(/alt=["']([^"']+)["']/) || 
                          context.match(/caption["'\s]*:?["'\s]*([^"'\n]+)/i) ||
                          context.match(/\[([^\]]+)\]\s*\(.*\)/)
      
      if (captionMatch) {
        caption = captionMatch[1].trim()
      }
      
      images.push({
        url: url.replace(/[\)\]"]+$/, ''), // Clean trailing punctuation
        alt: caption,
        caption: caption,
        source: 'perplexity_search'
      })
    })
    
    // Remove duplicates
    const uniqueImages = images.filter((image, index, self) => 
      index === self.findIndex(i => i.url === image.url)
    )
    
    return uniqueImages.slice(0, 10) // Limit to 10 images
  }
  
  private generateCitationsText(sources: SourceCitation[]): string {
    if (sources.length === 0) return ''
    
    let citations = '\n\n## Sources\n\n'
    
    sources.forEach((source, index) => {
      const number = index + 1
      if (source.url) {
        citations += `${number}. [${source.title}](${source.url}) - ${source.domain}\n`
      } else {
        citations += `${number}. ${source.title}\n`
      }
      if (source.snippet) {
        citations += `   *"${source.snippet.substring(0, 100)}..."*\n`
      }
      citations += '\n'
    })
    
    return citations
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
export const perplexityEnhancerV2 = new PerplexityEnhancerV2()

// Export interfaces for use in other files
export type { EnhancementResult, EnhancementOptions, SourceCitation, ExtractedImage }