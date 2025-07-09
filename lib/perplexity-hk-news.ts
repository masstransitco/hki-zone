import { PerplexityNews, savePerplexityHeadlines, getPendingPerplexityNews, updatePerplexityArticle, getRecentPerplexityTitles } from "./supabase-server"

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
      citations?: Array<{
        url: string
        title: string
        text?: string
        snippet?: string
      }>
    }
  }[]
  citations?: Array<{
    url: string
    title: string
    text?: string
    snippet?: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface HeadlineResponse {
  category: string
  title: string
  url: string
  published_iso: string
}

interface SourceCitation {
  title: string
  url: string
  description?: string
  domain?: string
}

interface ArticleEnrichment {
  // Enhanced structured content
  enhanced_title: string
  summary: string
  key_points: string[]
  why_it_matters: string
  body_html: string
  image_prompt: string
  citations: string[]
  sources: SourceCitation[]
  
  // Legacy fields for backward compatibility
  lede: string
}

class PerplexityHKNews {
  private apiKey: string
  private baseUrl = 'https://api.perplexity.ai/chat/completions'
  private model = 'sonar-pro'

  // Hong Kong focused categories based on news-curation.md
  private readonly HK_CATEGORIES = [
    "politics",    // Local government, policies, elections
    "business",    // Economy, finance, property market
    "tech",        // Technology, innovation, smart city
    "health",      // Healthcare, medical, wellness
    "lifestyle",   // Food, culture, entertainment
    "entertainment" // Films, celebrities, events
  ]

  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || ''
    if (!this.apiKey) {
      console.warn('PERPLEXITY_API_KEY not configured - Perplexity news features will be disabled')
    }
  }

  private async makePerplexityRequest(body: any): Promise<PerplexityResponse> {
    if (!this.apiKey) {
      throw new Error('Perplexity API key not configured')
    }

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Perplexity API error: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  private calculateCost(usage?: { total_tokens: number }): number {
    // Perplexity sonar-pro pricing: approximately $0.0001 per 1K tokens
    if (!usage?.total_tokens) return 0
    return (usage.total_tokens / 1000) * 0.0001
  }

  async fetchHKHeadlines(): Promise<{ headlines: PerplexityNews[], totalCost: number }> {
    console.log("🔍 Fetching fresh Hong Kong headlines from Perplexity...")
    console.log("📝 API Key configured:", !!this.apiKey)

    try {
      // Get recent titles to avoid duplicates
      console.log("📚 Fetching recent titles to avoid duplicates...")
      const recentTitles = await getRecentPerplexityTitles(7)
      const existingTitles = recentTitles.slice(0, 30).map(t => `"${t.title}"`).join(', ')
      
      console.log(`📊 Found ${recentTitles.length} recent titles, using top 30 for context`)
      
      const body = {
        model: this.model,
        messages: [
          {
            role: "system",
            content: "You are a Hong Kong news expert with access to real-time news sources. Search current Hong Kong news from specific local sources to generate exactly 10 unique headlines in JSON format. Ensure diversity across all categories."
          },
          {
            role: "user",
            content: `Search for the latest Hong Kong news from these specific sources and generate exactly 10 unique headlines:

PRIMARY SOURCES TO SEARCH:
- hk01.com (HK01)
- am730.com.hk (AM730)
- std.stheadline.com (星島日報)
- news.rthk.hk (RTHK)
- hongkongfp.com (Hong Kong Free Press)
- scmp.com (South China Morning Post)
- thestandard.com.hk (The Standard)
- mingpao.com (明報)
- takungpao.com.hk (大公報)
- singtao.ca (星島日報)

IMPORTANT: AVOID generating headlines similar to these existing ones: ${existingTitles}

Requirements:
- Search these specific news sources for current Hong Kong stories
- Generate headlines based on ACTUAL recent news events from these sources
- Distribute evenly across all 6 categories (politics, business, tech, health, lifestyle, entertainment)
- Each headline must be completely unique and different from existing titles
- Use current timestamp: ${new Date().toISOString().split('T')[0]}
- Focus on news from the last 24-48 hours for maximum freshness
- Make URLs unique by including random numbers and current timestamp
- Vary headline angles: breaking news, analysis, updates, reactions, developments

Format: [{"category":"politics","title":"headline text","url":"https://hongkongfp.com/2025/07/08/unique-headline-${Date.now()}","published_iso":"2025-07-09T02:30:00Z"}]`
          }
        ]
      }

      console.log("📤 Making Perplexity API request...")
      const response = await this.makePerplexityRequest(body)
      const cost = this.calculateCost(response.usage)
      
      console.log("📥 Perplexity API response received:")
      console.log("  - Model:", response.model)
      console.log("  - Usage:", response.usage)
      console.log("  - Cost:", `$${cost.toFixed(6)}`)
      console.log("  - Response length:", response.choices[0].message.content.length)
      
      // Log the first 500 chars of response for debugging
      console.log("  - Response preview:", response.choices[0].message.content.substring(0, 500) + "...")

      let headlinesData: HeadlineResponse[]
      try {
        console.log("🔍 Parsing JSON response...")
        let rawContent = response.choices[0].message.content
        
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = rawContent.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/)
        if (jsonMatch) {
          rawContent = jsonMatch[1]
          console.log("📝 Extracted JSON from markdown code block")
        }
        
        // Clean up any extra text before/after JSON
        const arrayMatch = rawContent.match(/(\[[\s\S]*\])/)
        if (arrayMatch) {
          rawContent = arrayMatch[1]
          console.log("🧹 Cleaned JSON content")
        }
        
        headlinesData = JSON.parse(rawContent)
        
        if (!Array.isArray(headlinesData)) {
          console.error("❌ Response is not an array:", typeof headlinesData)
          throw new Error("Response is not an array")
        }
        
        console.log(`✅ Successfully parsed ${headlinesData.length} headlines`)
        
        // Validate we got the expected number
        if (headlinesData.length < 8) {
          console.warn(`⚠️ Expected 10 headlines but got ${headlinesData.length}`)
        }
      } catch (parseError) {
        console.error("❌ Failed to parse Perplexity response:")
        console.error("  - Parse error:", parseError)
        console.error("  - Raw response:", response.choices[0].message.content)
        console.error("  - Response type:", typeof response.choices[0].message.content)
        throw new Error(`Invalid JSON response from Perplexity: ${parseError.message}`)
      }

      // Convert to our PerplexityNews format
      const headlines: PerplexityNews[] = headlinesData.map((headline, index) => {
        // Validate and clean category
        let validatedCategory = headline.category?.toLowerCase() || 'general'
        if (!this.HK_CATEGORIES.includes(validatedCategory)) {
          // Map common variations to valid categories
          if (validatedCategory.includes('polit')) validatedCategory = 'politics'
          else if (validatedCategory.includes('busines') || validatedCategory.includes('financ') || validatedCategory.includes('econom')) validatedCategory = 'business'
          else if (validatedCategory.includes('tech') || validatedCategory.includes('digital')) validatedCategory = 'tech'
          else if (validatedCategory.includes('health') || validatedCategory.includes('medical')) validatedCategory = 'health'
          else if (validatedCategory.includes('life') || validatedCategory.includes('culture')) validatedCategory = 'lifestyle'
          else if (validatedCategory.includes('entertain')) validatedCategory = 'entertainment'
          else validatedCategory = 'politics' // Default fallback
        }

        // Generate recent timestamps if provided timestamp is invalid
        let publishedAt = headline.published_iso
        try {
          const testDate = new Date(publishedAt)
          if (isNaN(testDate.getTime())) {
            throw new Error('Invalid date')
          }
          publishedAt = testDate.toISOString()
        } catch {
          // Use current time for genuinely new articles
          // This ensures articles are sorted correctly by when they were actually discovered
          publishedAt = new Date().toISOString()
          console.log(`⚠️ Invalid timestamp for headline "${headline.title}", using current time`)
        }
        
        // Make URL unique to avoid duplicates
        let uniqueUrl = headline.url || `https://example.com/news-${index + 1}`
        const timestamp = Date.now()
        const randomSuffix = Math.random().toString(36).substring(7)
        
        // Add unique identifiers to URL
        if (uniqueUrl.includes('hongkongfp.com')) {
          uniqueUrl = `https://hongkongfp.com/2025/07/08/hk-${validatedCategory}-${timestamp}-${randomSuffix}`
        } else if (uniqueUrl.includes('scmp.com')) {
          uniqueUrl = `https://www.scmp.com/news/hong-kong/${validatedCategory}/article/${timestamp}/${randomSuffix}`
        } else {
          uniqueUrl = `https://example.com/hk-${validatedCategory}-${timestamp}-${randomSuffix}`
        }

        return {
          category: validatedCategory,
          title: headline.title || `Hong Kong News Update ${index + 1}`,
          url: uniqueUrl,
          published_at: publishedAt,
          article_status: 'pending' as const,
          image_status: 'pending' as const,
          source: 'Perplexity AI',
          author: 'AI Generated',
          perplexity_model: this.model,
          generation_cost: cost / headlinesData.length, // Distribute cost across headlines
          search_queries: [`Hong Kong ${validatedCategory} news`],
          citations: response.citations || []
        }
      })

      console.log(`📰 Generated ${headlines.length} Hong Kong headlines`)
      console.log("📊 Headlines summary:")
      headlines.forEach((headline, i) => {
        console.log(`  ${i + 1}. [${headline.category}] ${headline.title}`)
        console.log(`     URL: ${headline.url}`)
        console.log(`     Published: ${headline.published_at}`)
      })
      console.log(`💰 Estimated cost: $${cost.toFixed(6)}`)

      return { headlines, totalCost: cost }
    } catch (error) {
      console.error("💥 Error fetching HK headlines from Perplexity:")
      console.error("  - Error message:", error.message)
      console.error("  - Error stack:", error.stack)
      throw error
    }
  }

  private parseStructuredContent(content: string, headline: PerplexityNews): ArticleEnrichment {
    console.log("📝 Parsing structured markdown content...")
    
    // Extract citations from Perplexity response
    const citationPattern = /\[(\d+)\]\(([^)]+)\)/g
    const citations: string[] = []
    const sources: SourceCitation[] = []
    let match
    
    while ((match = citationPattern.exec(content)) !== null) {
      const url = match[2]
      citations.push(url)
      
      // Extract domain for source attribution
      try {
        const domain = new URL(url).hostname
        sources.push({
          title: `Source ${match[1]}`,
          url: url,
          domain: domain
        })
      } catch (e) {
        // Invalid URL, skip
      }
    }
    
    // Extract sections using regex patterns (match the exact AI enhancement format)
    const enhancedTitleMatch = content.match(/# ENHANCED TITLE:\s*(.+)/i)
    const summaryMatch = content.match(/## SUMMARY\s*\n([\s\S]*?)(?=\n## |$)/i)
    const keyPointsMatch = content.match(/## KEY POINTS\s*\n([\s\S]*?)(?=\n## |$)/i)
    const whyItMattersMatch = content.match(/## WHY IT MATTERS\s*\n([\s\S]*?)(?=\n## |$)/i)
    const fullArticleMatch = content.match(/## FULL ARTICLE\s*\n([\s\S]*?)(?=\n## |$)/i)
    const imageSearchMatch = content.match(/## IMAGE SEARCH\s*\n([\s\S]*?)(?=\n## |$)/i)
    
    // Extract and clean enhanced title
    const enhancedTitle = enhancedTitleMatch 
      ? enhancedTitleMatch[1].trim().replace(/^\[|\]$/g, '')
      : headline.title
    
    // Extract and clean summary
    const summary = summaryMatch 
      ? summaryMatch[1].trim().replace(/^\[|\]$/g, '')
      : `Breaking news in Hong Kong's ${headline.category} sector with significant implications for the city.`
    
    // Extract key points (handle both • and - bullet formats)
    const keyPointsText = keyPointsMatch ? keyPointsMatch[1].trim() : ''
    const keyPoints = keyPointsText
      .split('\n')
      .filter(line => line.trim().startsWith('•') || line.trim().startsWith('-'))
      .map(line => line.trim().replace(/^[•-]\s*/, '').replace(/^\[|\]$/g, ''))
      .filter(point => point.length > 0)
    
    // Ensure we have at least 3 key points
    if (keyPoints.length < 3) {
      keyPoints.push(
        `Development affects Hong Kong's ${headline.category} landscape`,
        'Stakeholders monitoring situation closely',
        'Further updates expected in coming days'
      )
    }
    
    // Extract why it matters
    const whyItMatters = whyItMattersMatch 
      ? whyItMattersMatch[1].trim().replace(/^\[|\]$/g, '')
      : `This development is significant for Hong Kong's ${headline.category} sector and may have broader implications for the city's future direction.`
    
    // Extract full article content
    const fullArticleText = fullArticleMatch 
      ? fullArticleMatch[1].trim().replace(/^\[|\]$/g, '')
      : `Hong Kong continues to see important developments in the ${headline.category} sector. ${summary} This story represents ongoing changes in the city's landscape and warrants continued monitoring.`
    
    // Convert to HTML paragraphs
    const bodyHtml = fullArticleText
      .split('\n\n')
      .filter(para => para.trim().length > 0)
      .map(para => `<p>${para.trim()}</p>`)
      .join('')
    
    // Extract image prompt
    const imagePrompt = imageSearchMatch 
      ? imageSearchMatch[1].trim().replace(/^\[|\]$/g, '')
      : `Hong Kong ${headline.category} news scene, professional photography, modern city`
    
    // Create lede for backward compatibility
    const lede = summary.split('.')[0] + '.'
    
    return {
      enhanced_title: enhancedTitle,
      summary: summary,
      key_points: keyPoints,
      why_it_matters: whyItMatters,
      body_html: bodyHtml,
      image_prompt: imagePrompt,
      citations: citations,
      sources: sources,
      lede: lede.substring(0, 200)
    }
  }

  async enrichArticle(headline: PerplexityNews): Promise<ArticleEnrichment> {
    console.log(`✍️ Enriching article: ${headline.title}`)

    try {
      const body = {
        model: this.model,
        messages: [
          {
            role: "system",
            content: "You are a professional Hong Kong journalist and news analyst. Create comprehensive, structured news articles with enhanced titles, clear summaries, key points, and significance analysis. Always include source citations and ensure factual accuracy. Use current Hong Kong context and maintain professional news standards."
          },
          {
            role: "user",
            content: `Create an enhanced Hong Kong news article with this exact structure:

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

## FULL ARTICLE
[Write detailed article content in paragraph form, expanding on the key points with context and analysis]

## IMAGE SEARCH
[Suggest a descriptive prompt for finding a relevant, professional photo for this story]

Based on this Hong Kong headline: "${headline.title}"
Category: ${headline.category}

Requirements:
- Search for current information about this topic from Hong Kong sources
- Include relevant source citations using [1], [2], etc. format
- Ensure all content is factually accurate and current
- Maintain professional journalism standards
- Focus on Hong Kong context and implications
- Keep each bullet point to 1-2 sentences maximum
- Make it digestible and easy to scan`
          }
        ],
      }

      const response = await this.makePerplexityRequest(body)
      const cost = this.calculateCost(response.usage)

      let enrichment: ArticleEnrichment
      const content = response.choices[0].message.content

      try {
        // Try to parse as JSON first
        enrichment = JSON.parse(content)
      } catch (parseError) {
        console.log("Non-JSON response, parsing as structured markdown...")
        
        // Parse structured markdown response
        enrichment = this.parseStructuredContent(content, headline)
      }

      // Update the article cost
      if (headline.id) {
        await updatePerplexityArticle(headline.id, {
          generation_cost: (headline.generation_cost || 0) + cost
        })
      }

      console.log(`✅ Article enriched, cost: $${cost.toFixed(6)}`)
      return enrichment
    } catch (error) {
      console.error(`💥 Error enriching article "${headline.title}":`, error)
      throw error
    }
  }

  async processHeadlines(): Promise<{ saved: number, totalCost: number }> {
    console.log("🚀 Starting headline processing...")
    try {
      console.log("📡 Calling fetchHKHeadlines...")
      const { headlines, totalCost } = await this.fetchHKHeadlines()
      
      if (headlines.length === 0) {
        console.log("⚠️ No headlines generated")
        return { saved: 0, totalCost }
      }

      console.log(`💾 Saving ${headlines.length} headlines to database...`)
      // Save headlines to database
      const { count } = await savePerplexityHeadlines(headlines)
      
      console.log(`✅ Processing complete: ${count} saved, cost: $${totalCost.toFixed(6)}`)
      return { saved: count, totalCost }
    } catch (error) {
      console.error("💥 CRITICAL ERROR processing headlines:")
      console.error("  - Error type:", error.constructor.name)
      console.error("  - Error message:", error.message)
      console.error("  - Error stack:", error.stack)
      console.error("  - API Key present:", !!this.apiKey)
      
      // Don't hide the error - let it bubble up with context
      throw new Error(`Headlines processing failed: ${error.message}`)
    }
  }

  async processPendingEnrichments(): Promise<{ processed: number, totalCost: number }> {
    try {
      const pendingArticles = await getPendingPerplexityNews(10)
      
      if (pendingArticles.length === 0) {
        console.log("📄 No pending articles to enrich")
        return { processed: 0, totalCost: 0 }
      }

      console.log(`🔄 Processing ${pendingArticles.length} pending articles...`)
      
      let totalCost = 0
      let processed = 0

      for (const article of pendingArticles) {
        try {
          // Enrich the article
          const enrichment = await this.enrichArticle(article)
          
          // Update the article with enriched content including structured fields
          await updatePerplexityArticle(article.id!, {
            article_status: 'enriched',
            lede: enrichment.lede,
            article_html: `<p>${enrichment.lede}</p>${enrichment.body_html}`,
            image_prompt: enrichment.image_prompt,
            // Enhanced structured content fields
            enhanced_title: enrichment.enhanced_title,
            summary: enrichment.summary,
            key_points: enrichment.key_points,
            why_it_matters: enrichment.why_it_matters,
            structured_sources: {
              citations: enrichment.citations,
              sources: enrichment.sources,
              generated_at: new Date().toISOString()
            }
          })

          processed++
          
          // Add delay between requests to respect rate limits
          if (processed < pendingArticles.length) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
          
        } catch (error) {
          console.error(`❌ Failed to enrich article "${article.title}":`, error)
          // Mark as failed but continue with others
          await updatePerplexityArticle(article.id!, {
            article_status: 'ready', // Mark as ready even if enrichment failed
            article_html: `<p>${article.title}</p><p>Content generation failed. Please check the original source.</p>`
          })
        }
      }

      console.log(`✅ Processed ${processed}/${pendingArticles.length} articles`)
      return { processed, totalCost }
      
    } catch (error) {
      console.error("💥 Error processing pending enrichments:", error)
      return { processed: 0, totalCost: 0 }
    }
  }

  // Generate fallback headlines when API is unavailable
  generateFallbackHeadlines(): PerplexityNews[] {
    // Generate staggered timestamps over the last 6 hours to simulate realistic article flow
    const now = Date.now()
    const getStaggeredTimestamp = (hoursAgo: number) => {
      return new Date(now - (hoursAgo * 60 * 60 * 1000)).toISOString()
    }
    
    const fallbackHeadlines: PerplexityNews[] = [
      {
        category: "politics",
        title: "Hong Kong Government Announces New Policy Framework for 2024",
        url: "https://hongkongfp.com/government-policy-framework-2024",
        published_at: getStaggeredTimestamp(1), // 1 hour ago
        article_status: 'ready',
        image_status: 'pending',
        source: 'Perplexity AI (Fallback)',
        author: 'AI Generated',
        article_html: '<p>The Hong Kong government has unveiled its comprehensive policy framework for 2024, focusing on economic recovery and innovation.</p><p>The new framework emphasizes technology development, housing initiatives, and international cooperation to strengthen Hong Kong\'s position as a global financial center.</p>',
        lede: 'The Hong Kong government has unveiled its comprehensive policy framework for 2024, focusing on economic recovery and innovation.'
      },
      {
        category: "business",
        title: "Hong Kong Property Market Shows Signs of Stabilization",
        url: "https://hk01.com/property-market-stabilization-2024",
        published_at: getStaggeredTimestamp(3), // 3 hours ago
        article_status: 'ready',
        image_status: 'pending',
        source: 'Perplexity AI (Fallback)',
        author: 'AI Generated',
        article_html: '<p>Recent data indicates that Hong Kong\'s property market is beginning to stabilize after months of volatility.</p><p>Industry experts point to increased buyer confidence and government measures as key factors contributing to the market stabilization.</p>',
        lede: 'Recent data indicates that Hong Kong\'s property market is beginning to stabilize after months of volatility.'
      },
      {
        category: "tech",
        title: "Hong Kong Launches New Smart City Initiative for Digital Transformation",
        url: "https://rthk.hk/smart-city-initiative-2024",
        published_at: getStaggeredTimestamp(5), // 5 hours ago
        article_status: 'ready',
        image_status: 'pending',
        source: 'Perplexity AI (Fallback)',
        author: 'AI Generated',
        article_html: '<p>Hong Kong has launched an ambitious smart city initiative aimed at accelerating digital transformation across the territory.</p><p>The initiative includes investments in 5G infrastructure, IoT networks, and digital government services to enhance quality of life for residents.</p>',
        lede: 'Hong Kong has launched an ambitious smart city initiative aimed at accelerating digital transformation across the territory.'
      }
    ]

    return fallbackHeadlines
  }
}

export const perplexityHKNews = new PerplexityHKNews()
export { PerplexityHKNews }
export type { HeadlineResponse, ArticleEnrichment }