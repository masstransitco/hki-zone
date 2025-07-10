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
  title_en?: string
  url: string
  published_iso?: string
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

interface ContextualBulletPoint {
  historical_context: string  // Past figures or data for comparison
  key_fact: string           // Current key information
  significance: string       // Why it matters (inspiring conclusion)
}

interface ContextualEnrichment {
  enhanced_title: string
  contextual_bullets: ContextualBulletPoint[]
  historical_references: string[]
  data_points: { metric: string; value: string; comparison?: string }[]
  image_prompt: string
  citations: string[]
  sources: SourceCitation[]
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

  /** Style rules embedded in the system prompt for headline optimization */
  private readonly HEADLINE_STYLE_RULES = `
STYLE:
 • ≤12 Chinese characters OR ≤12 English words (strict mobile limit)
 • One vivid verb
 • No passive voice, no jargon
QUALITY:
 • Must cite a fact from the provided domain list
 • First 20 characters must convey the key fact (mobile CTR)
 • Use concrete nouns and specific numbers when available`

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

  private async makePerplexityRequestWithRetry(body: any, maxRetries = 3): Promise<PerplexityResponse> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 API request attempt ${attempt}/${maxRetries}`)
        return await this.makePerplexityRequest(body)
      } catch (error) {
        lastError = error as Error
        console.warn(`⚠️ Attempt ${attempt} failed:`, error.message)
        
        if (attempt < maxRetries) {
          // Exponential backoff: 2, 4, 8 seconds
          const backoffTime = Math.pow(2, attempt) * 1000
          console.log(`⏳ Waiting ${backoffTime/1000}s before retry...`)
          await new Promise(resolve => setTimeout(resolve, backoffTime))
        }
      }
    }
    
    throw new Error(`All ${maxRetries} attempts failed. Last error: ${lastError?.message}`)
  }

  private calculateCost(usage?: { total_tokens: number }): number {
    // Perplexity sonar-pro pricing: approximately $0.0001 per 1K tokens
    if (!usage?.total_tokens) return 0
    return (usage.total_tokens / 1000) * 0.0001
  }

  /**
   * Validates headline readability according to mobile-first standards:
   * - Chinese: ≤12 characters (strict mobile limit)
   * - English: ≤12 words (strict mobile limit)
   * - Must be comprehensible (no excessive technical jargon)
   */
  private isHeadlineReadable(title: string): boolean {
    const trimmed = title.trim()
    
    // Check for Chinese characters
    const chineseChars = trimmed.match(/[\u4e00-\u9fa5]/g)
    const hasSignificantChinese = chineseChars && chineseChars.length > 3
    
    if (hasSignificantChinese) {
      // For Chinese headlines: count Chinese characters only
      const chineseCharCount = chineseChars.length
      const isValidLength = chineseCharCount <= 12
      
      if (!isValidLength) {
        console.warn(`⚠️ Chinese headline too long: ${chineseCharCount} chars > 12 limit: "${title}"`)
      }
      
      return isValidLength
    } else {
      // For English headlines: count words
      const wordCount = trimmed.split(/\s+/).length
      const isValidLength = wordCount <= 12
      
      if (!isValidLength) {
        console.warn(`⚠️ English headline too long: ${wordCount} words > 12 limit: "${title}"`)
      }
      
      return isValidLength
    }
  }

  async fetchHKHeadlines(): Promise<{ headlines: PerplexityNews[], totalCost: number }> {
    console.log("🔍 Fetching fresh Hong Kong headlines from Perplexity...")
    console.log("📝 API Key configured:", !!this.apiKey)

    try {
      // Get recent titles to avoid duplicates
      console.log("📚 Fetching recent titles to avoid duplicates...")
      const recentTitles = await getRecentPerplexityTitles(3) // 3 days
      const negativeTitles = recentTitles.slice(0, 30).map(t => t.title)
      
      console.log(`📊 Found ${recentTitles.length} recent titles, using top 30 for negative list`)
      
      const currentHour = new Date().getHours()
      const isBusinessHours = currentHour >= 9 && currentHour <= 18
      
      const body = {
        model: this.model,
        temperature: 0.3,
        top_p: 0.9,
        frequency_penalty: 0.5,
        messages: [
          {
            role: "system",
            content: `You are a Hong Kong news curator bot. Return ONLY a JSON array with exactly 10 news items. No explanation, no commentary, just the JSON array.`
          },
          {
            role: "user",
            content: `Find the 10 most important Hong Kong news stories from the last 4 hours.

Categories to cover (distribute evenly):
- politics: Government, policies, elections
- business: Finance, property, economy
- tech: Technology, innovation, startups
- health: Healthcare, medical news
- lifestyle: Culture, food, society
- entertainment: Films, celebrities, events

Requirements:
- Title must be ≤12 Chinese characters OR ≤12 English words
- Use real URLs from Hong Kong news sites
- Avoid these recent titles: ${negativeTitles.slice(0, 10).join("; ")}

Return ONLY this JSON format:
[
  {
    "category": "politics",
    "title": "香港政府宣布新政策",
    "url": "https://news.rthk.hk/...",
    "published_iso": "2025-07-10T10:00:00+08:00"
  }
]`
          }
        ]
      }

      console.log("📤 Making Perplexity API request...")
      const response = await this.makePerplexityRequestWithRetry(body)
      const cost = this.calculateCost(response.usage)
      
      console.log("📥 Perplexity API response received:")
      console.log("  - Model:", response.model)
      console.log("  - Usage:", response.usage)
      console.log("  - Cost:", `$${cost.toFixed(6)}`)
      console.log("  - Response length:", response.choices[0].message.content.length)

      let headlinesData: HeadlineResponse[]
      try {
        console.log("🔍 Parsing JSON response...")
        let rawContent = response.choices[0].message.content.trim()
        
        // Remove any explanatory text before the JSON array
        const jsonStartIndex = rawContent.indexOf('[')
        if (jsonStartIndex > 0) {
          console.log(`🧹 Removing ${jsonStartIndex} chars of text before JSON`)
          rawContent = rawContent.substring(jsonStartIndex)
        }
        
        // Remove any text after the JSON array
        const jsonEndIndex = rawContent.lastIndexOf(']')
        if (jsonEndIndex > 0 && jsonEndIndex < rawContent.length - 1) {
          rawContent = rawContent.substring(0, jsonEndIndex + 1)
        }
        
        // Try to extract JSON from markdown code blocks if present
        const codeBlockMatch = rawContent.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/)
        if (codeBlockMatch) {
          rawContent = codeBlockMatch[1]
          console.log("📝 Extracted JSON from markdown code block")
        }
        
        // Basic JSON cleaning
        rawContent = rawContent
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
          .replace(/,\s*}/g, '}') // Remove trailing commas
          .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
        
        headlinesData = JSON.parse(rawContent)
        
        if (!Array.isArray(headlinesData)) {
          console.error("❌ Response is not an array:", typeof headlinesData)
          throw new Error("Response is not an array")
        }
        
        console.log(`✅ Successfully parsed ${headlinesData.length} headlines`)
        
        // Validate headlines have required fields
        headlinesData = headlinesData.filter(h => h.category && h.title && h.url)
        
        if (headlinesData.length === 0) {
          throw new Error("No valid headlines after filtering")
        }
        
      } catch (parseError) {
        console.error("❌ Failed to parse Perplexity response:", parseError.message)
        console.error("Raw response preview:", response.choices[0].message.content.substring(0, 500))
        
        // Fall back to mock headlines if parsing fails
        console.log("🔄 Using fallback headlines due to parsing error")
        return { 
          headlines: this.generateFallbackHeadlines(), 
          totalCost: cost 
        }
      }

      // Convert to our PerplexityNews format
      const headlines: PerplexityNews[] = headlinesData.map((headline, index) => {
        // Validate headline readability
        const titleToUse = headline.title || `Hong Kong News Update ${index + 1}`
        if (!this.isHeadlineReadable(titleToUse)) {
          console.warn(`⚠️ Headline failed readability check but will be used: "${titleToUse}"`)
        }

        // Use category from response or default
        const category = headline.category || 'politics'
        
        // Extract domain from URL
        let domain = 'news.hk'
        try {
          domain = new URL(headline.url).hostname
        } catch (e) {
          console.warn(`⚠️ Invalid URL: ${headline.url}`)
        }

        return {
          category,
          title: titleToUse,
          url: headline.url || `https://news.rthk.hk/rthk/ch/news-${Date.now()}-${index}.htm`,
          article_status: 'pending' as const,
          image_status: 'pending' as const,
          source: `Perplexity AI (${domain})`,
          author: 'AI Generated',
          perplexity_model: this.model,
          generation_cost: cost / headlinesData.length,
          search_queries: [`Hong Kong ${category} news`],
          citations: response.citations || []
        }
      })

      console.log(`📰 Generated ${headlines.length} Hong Kong headlines`)
      console.log("📊 Headlines by category:")
      
      const categoryCounts: Record<string, number> = {}
      headlines.forEach((headline, i) => {
        categoryCounts[headline.category] = (categoryCounts[headline.category] || 0) + 1
        console.log(`  ${i + 1}. [${headline.category}] ${headline.title}`)
      })
      
      console.log("📈 Category distribution:", categoryCounts)
      console.log(`💰 Total cost: $${cost.toFixed(6)}`)

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
        temperature: 0.4,
        top_p: 0.9,
        frequency_penalty: 0.6,
        messages: [
          {
            role: "system",
            content: "You are a professional Hong Kong journalist and news analyst specializing in mobile-first content. Your outputs must be factual, concise, and follow mobile-first readability standards (Grade-8 English or 明報閱讀指數 ≤60). Always cite sources using [1], [2] format. Write in Traditional Chinese unless English terminology is industry-standard. Prioritize clarity and scannability for mobile readers."
          },
          {
            role: "user",
            content: `Create an enhanced Hong Kong news article with this exact structure:

# ENHANCED TITLE: [Optimize for mobile: ≤14 characters if Chinese, ≤14 words if English]

## SUMMARY
[簡潔的 2-3 句總結，每句不超過 20 字]

## KEY POINTS
• [項目 1：最重要事實，1-2 句話]
• [項目 2：第二關鍵點，1-2 句話]
• [項目 3：第三重點，1-2 句話]
• [項目 4：第四要點，1-2 句話]
• [項目 5：第五要點（如相關）]

## WHY IT MATTERS
[解釋對香港的重要意義，2-3 句話]

## FULL ARTICLE
[詳細內容，每段 2-3 句，避免過長從句]

## IMAGE SEARCH
[專業照片描述]

Based on headline: "${headline.title}"
Category: ${headline.category}

Mobile-first requirements:
- 每個項目或段落不超過 2 句
- 避免過長從句與被動語態
- 使用具體數字和地點名稱
- 引用香港權威消息來源 [1], [2]
- 保持內容簡潔易讀，適合手機閱讀`
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

      // Validate enriched title readability
      const titleReadable = this.isHeadlineReadable(enrichment.enhanced_title)
      console.log(`✅ Article enriched, cost: $${cost.toFixed(6)}`)
      console.log(`📱 Enhanced title readability: ${titleReadable ? '✅' : '⚠️'} "${enrichment.enhanced_title}"`)
      console.log(`📋 Content structure: ${enrichment.key_points.length} key points, ${enrichment.body_html.length} chars`)
      
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
    const timestamp = Date.now()
    const date = new Date()
    const dateStr = date.toISOString().split('T')[0]
    
    const fallbackHeadlines: PerplexityNews[] = [
      {
        category: "politics",
        title: "港府推新政策支援中小企",
        url: `https://news.rthk.hk/rthk/ch/policy-${dateStr}-${timestamp}.htm`,
        article_status: 'ready',
        image_status: 'pending',
        source: 'Perplexity AI (Fallback)',
        author: 'AI Generated',
        article_html: '<p>香港政府今日公布新一輪支援中小企措施，涉及多個行業。</p><p>新措施預計惠及超過十萬家企業，有助促進經濟復甦。</p>',
        lede: '香港政府今日公布新一輪支援中小企措施。'
      },
      {
        category: "business",
        title: "港股今升逾300點",
        url: `https://hk01.com/finance/stock-${dateStr}-${timestamp + 1}.htm`,
        article_status: 'ready',
        image_status: 'pending',
        source: 'Perplexity AI (Fallback)',
        author: 'AI Generated',
        article_html: '<p>恒生指數今日收市升逾300點，成交額增加。</p><p>分析指市場氣氛改善，投資者信心回升。</p>',
        lede: '恒生指數今日收市升逾300點。'
      },
      {
        category: "tech",
        title: "香港推出數碼港元試驗計劃",
        url: `https://std.stheadline.com/tech/digital-hkd-${dateStr}-${timestamp + 2}.htm`,
        article_status: 'ready',
        image_status: 'pending',
        source: 'Perplexity AI (Fallback)',
        author: 'AI Generated',
        article_html: '<p>金管局宣布推出數碼港元試驗計劃，多家銀行參與。</p><p>計劃旨在探索央行數碼貨幣在香港的應用場景。</p>',
        lede: '金管局宣布推出數碼港元試驗計劃。'
      },
      {
        category: "health",
        title: "公立醫院急症室輪候時間",
        url: `https://news.rthk.hk/rthk/ch/health-${dateStr}-${timestamp + 3}.htm`,
        article_status: 'ready',
        image_status: 'pending',
        source: 'Perplexity AI (Fallback)',
        author: 'AI Generated',
        article_html: '<p>醫管局公布最新急症室輪候時間，部分醫院等候超過八小時。</p><p>當局呼籲非緊急病人考慮使用其他醫療服務。</p>',
        lede: '醫管局公布最新急症室輪候時間。'
      },
      {
        category: "lifestyle",
        title: "新年花市下週開鑼",
        url: `https://mingpao.com/lifestyle/flower-${dateStr}-${timestamp + 4}.htm`,
        article_status: 'ready',
        image_status: 'pending',
        source: 'Perplexity AI (Fallback)',
        author: 'AI Generated',
        article_html: '<p>農曆新年花市將於下週在全港多區開鑼。</p><p>今年花市攤位數目增加，預計吸引大批市民選購年花。</p>',
        lede: '農曆新年花市將於下週在全港多區開鑼。'
      },
      {
        category: "entertainment",
        title: "香港電影金像獎提名公布",
        url: `https://hk01.com/entertainment/hkfa-${dateStr}-${timestamp + 5}.htm`,
        article_status: 'ready',
        image_status: 'pending',
        source: 'Perplexity AI (Fallback)',
        author: 'AI Generated',
        article_html: '<p>第43屆香港電影金像獎提名名單今日公布。</p><p>多部本地製作獲得提名，競爭激烈。</p>',
        lede: '第43屆香港電影金像獎提名名單今日公布。'
      }
    ]

    return fallbackHeadlines
  }

  async searchHistoricalContext(headline: PerplexityNews): Promise<{ historical_data: any[], citations: string[] }> {
    console.log(`🔍 Searching for historical context: ${headline.title}`)
    
    try {
      // Create a search query for historical context
      const searchQuery = `Hong Kong ${headline.category} historical data statistics trends ${headline.title.split(' ').slice(0, 5).join(' ')}`
      
      const body = {
        model: this.model,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: "You are a data analyst specializing in Hong Kong trends. Search for relevant historical data, statistics, and past events related to the given topic. Focus on concrete numbers, dates, and verifiable facts from the past 5 years."
          },
          {
            role: "user",
            content: `Find historical context and data for: "${headline.title}"
            
            Category: ${headline.category}
            
            Look for:
            1. Similar past events or announcements
            2. Historical figures, percentages, or statistics
            3. Previous trends or patterns
            4. Comparable data points from recent years
            5. Related policy changes or market movements
            
            Provide concrete data with dates and sources.`
          }
        ],
      }
      
      const response = await this.makePerplexityRequest(body)
      const content = response.choices[0].message.content
      
      // Extract citations
      const citationPattern = /\[(\d+)\]\(([^)]+)\)/g
      const citations: string[] = []
      let match
      
      while ((match = citationPattern.exec(content)) !== null) {
        citations.push(match[2])
      }
      
      return {
        historical_data: [content],
        citations
      }
    } catch (error) {
      console.error("Error searching historical context:", error)
      return { historical_data: [], citations: [] }
    }
  }

  async enrichArticleWithContext(headline: PerplexityNews): Promise<ContextualEnrichment> {
    console.log(`📊 Creating contextual enrichment for: ${headline.title}`)
    
    try {
      // First, search for historical context
      const { historical_data, citations: historicalCitations } = await this.searchHistoricalContext(headline)
      
      const body = {
        model: this.model,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: `You are a data-driven Hong Kong news analyst creating high-frequency live signal updates. Your goal is to provide context-rich, inspiring summaries that help readers understand the significance of current events by comparing them with historical data and trends.

Guidelines:
- Use concrete numbers and percentages whenever possible
- Reference specific dates and timeframes
- Compare current events with historical precedents
- Keep each bullet point concise and mobile-friendly
- End with an inspiring or forward-looking perspective
- Cite all sources using [1], [2] format`
          },
          {
            role: "user",
            content: `Create a contextual analysis for this Hong Kong news:

Headline: "${headline.title}"
Category: ${headline.category}
${historical_data.length > 0 ? `\nHistorical Context Found:\n${historical_data[0]}` : ''}

Generate EXACTLY this structure:

# ENHANCED TITLE
[Mobile-optimized title: ≤12 Chinese characters OR ≤12 English words]

# CONTEXTUAL BULLETS

## BULLET 1 - HISTORICAL PERSPECTIVE
Historical: [Past data/figures with specific dates, e.g., "2019年同期增長僅2.3%，2020年因疫情下跌15%"]
Current: [Key fact about the current situation with specific numbers]
Insight: [Why this comparison matters, forward-looking perspective]

## BULLET 2 - DATA COMPARISON
Historical: [Another relevant historical data point or trend]
Current: [Related current development or figure]
Insight: [Significance for Hong Kong's future]

## BULLET 3 - BROADER IMPACT
Historical: [Past similar events and their outcomes]
Current: [Current broader implications]
Insight: [Inspiring conclusion about potential positive outcomes]

# KEY DATA POINTS
- [Metric 1]: [Current Value] (vs [Historical Comparison])
- [Metric 2]: [Current Value] (vs [Historical Comparison])
- [Metric 3]: [Current Value] (trend: [up/down/stable])

# IMAGE SEARCH
[Specific visual search query for Hong Kong context]

# SOURCES
[List all sources with proper citations]`
          }
        ],
      }
      
      const response = await this.makePerplexityRequest(body)
      const cost = this.calculateCost(response.usage)
      
      // Update the article cost
      if (headline.id) {
        await updatePerplexityArticle(headline.id, {
          generation_cost: (headline.generation_cost || 0) + cost
        })
      }
      
      const content = response.choices[0].message.content
      
      // Parse the structured response
      return this.parseContextualContent(content, historicalCitations)
      
    } catch (error) {
      console.error("Error creating contextual enrichment:", error)
      // Return a fallback structure
      return this.createFallbackContextualEnrichment(headline)
    }
  }

  private parseContextualContent(content: string, additionalCitations: string[]): ContextualEnrichment {
    console.log("📝 Parsing contextual content...")
    
    // Extract enhanced title
    const titleMatch = content.match(/# ENHANCED TITLE\s*\n(.+)/i)
    const enhancedTitle = titleMatch ? titleMatch[1].trim() : "Hong Kong News Update"
    
    // Extract bullets
    const bullets: ContextualBulletPoint[] = []
    const bulletPattern = /## BULLET \d[^#]*Historical:\s*(.+?)\s*Current:\s*(.+?)\s*Insight:\s*(.+?)(?=\n#|$)/gis
    let bulletMatch
    
    while ((bulletMatch = bulletPattern.exec(content)) !== null) {
      bullets.push({
        historical_context: bulletMatch[1].trim(),
        key_fact: bulletMatch[2].trim(),
        significance: bulletMatch[3].trim()
      })
    }
    
    // Ensure we have exactly 3 bullets
    while (bullets.length < 3) {
      bullets.push({
        historical_context: "Historical data shows steady growth over past 5 years",
        key_fact: "Current developments mark significant change",
        significance: "This positions Hong Kong for future opportunities"
      })
    }
    
    // Extract data points
    const dataPoints: { metric: string; value: string; comparison?: string }[] = []
    const dataPattern = /- ([^:]+):\s*([^\(\n]+)(?:\s*\((.+?)\))?/g
    let dataMatch
    
    while ((dataMatch = dataPattern.exec(content)) !== null) {
      dataPoints.push({
        metric: dataMatch[1].trim(),
        value: dataMatch[2].trim(),
        comparison: dataMatch[3]?.trim()
      })
    }
    
    // Extract citations
    const citationPattern = /\[(\d+)\]\(([^)]+)\)/g
    const citations: string[] = [...additionalCitations]
    const sources: SourceCitation[] = []
    let citationMatch
    
    while ((citationMatch = citationPattern.exec(content)) !== null) {
      const url = citationMatch[2]
      if (!citations.includes(url)) {
        citations.push(url)
      }
      
      try {
        const domain = new URL(url).hostname
        sources.push({
          title: `Source ${citationMatch[1]}`,
          url: url,
          domain: domain
        })
      } catch (e) {
        // Invalid URL, skip
      }
    }
    
    // Extract image prompt
    const imageMatch = content.match(/# IMAGE SEARCH\s*\n(.+)/i)
    const imagePrompt = imageMatch 
      ? imageMatch[1].trim() 
      : "Hong Kong financial district data visualization charts graphs"
    
    return {
      enhanced_title: enhancedTitle,
      contextual_bullets: bullets,
      historical_references: additionalCitations,
      data_points: dataPoints,
      image_prompt: imagePrompt,
      citations: citations,
      sources: sources
    }
  }

  private createFallbackContextualEnrichment(headline: PerplexityNews): ContextualEnrichment {
    return {
      enhanced_title: headline.title.substring(0, 50),
      contextual_bullets: [
        {
          historical_context: "Hong Kong has seen similar developments in recent years",
          key_fact: `Latest ${headline.category} update shows significant change`,
          significance: "This development positions Hong Kong for future growth"
        },
        {
          historical_context: "Past data indicates steady progress in this sector",
          key_fact: "Current indicators suggest continued momentum",
          significance: "Market participants view this as positive signal"
        },
        {
          historical_context: "Historical precedents show resilience in challenging times",
          key_fact: "Today's announcement reflects ongoing adaptation",
          significance: "Hong Kong continues to evolve as global financial center"
        }
      ],
      historical_references: [],
      data_points: [],
      image_prompt: `Hong Kong ${headline.category} news update visual`,
      citations: [],
      sources: []
    }
  }

  // Convert contextual enrichment to standard ArticleEnrichment format for backward compatibility
  contextualToArticleEnrichment(contextual: ContextualEnrichment): ArticleEnrichment {
    // Create key points from contextual bullets
    const key_points = contextual.contextual_bullets.map(bullet => 
      `${bullet.historical_context} → ${bullet.key_fact}`
    )
    
    // Create summary from the first bullet
    const summary = contextual.contextual_bullets[0] 
      ? `${contextual.contextual_bullets[0].key_fact} ${contextual.contextual_bullets[0].significance}`
      : "Latest Hong Kong news update with significant implications."
    
    // Create why it matters from all insights
    const why_it_matters = contextual.contextual_bullets
      .map(b => b.significance)
      .join(' ')
    
    // Create HTML body from all bullets
    const body_html = contextual.contextual_bullets
      .map((bullet, i) => `
        <h3>Context ${i + 1}</h3>
        <p><strong>Historical:</strong> ${bullet.historical_context}</p>
        <p><strong>Current:</strong> ${bullet.key_fact}</p>
        <p><strong>Significance:</strong> ${bullet.significance}</p>
      `).join('') + 
      (contextual.data_points.length > 0 
        ? `<h3>Key Data Points</h3><ul>${contextual.data_points.map(dp => 
            `<li><strong>${dp.metric}:</strong> ${dp.value}${dp.comparison ? ` (${dp.comparison})` : ''}</li>`
          ).join('')}</ul>`
        : '')
    
    return {
      enhanced_title: contextual.enhanced_title,
      summary,
      key_points,
      why_it_matters,
      body_html,
      image_prompt: contextual.image_prompt,
      citations: contextual.citations,
      sources: contextual.sources,
      lede: summary.substring(0, 200)
    }
  }

}

export const perplexityHKNews = new PerplexityHKNews()
export { PerplexityHKNews }
export type { HeadlineResponse, ArticleEnrichment, ContextualEnrichment, ContextualBulletPoint }