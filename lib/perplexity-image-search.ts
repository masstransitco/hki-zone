interface PerplexityImageResponse {
  choices: Array<{
    message: {
      images?: Array<{
        url: string
        license?: string
        alt?: string
      }>
    }
  }>
}

interface GoogleCSEResponse {
  items?: Array<{
    link: string
    image: {
      contextLink: string
    }
    title?: string
    snippet?: string
  }>
}

interface UnsplashImageResponse {
  results: Array<{
    id: string
    urls: {
      raw: string
      full: string
      regular: string
      small: string
      thumb: string
    }
    user: {
      name: string
      username: string
      links: {
        html: string
      }
    }
    description?: string
    alt_description?: string
    links: {
      html: string
    }
    width: number
    height: number
  }>
  total: number
  total_pages: number
}

interface ImageResult {
  url: string
  license: string
  source: 'unsplash' | 'perplexity' | 'google' | 'fallback'
  alt?: string
  attribution?: string
}

class PerplexityImageSearch {
  private perplexityApiKey: string
  private googleApiKey: string
  private googleCSEId: string
  private unsplashAccessKey: string
  private baseUrl = 'https://api.perplexity.ai/chat/completions'
  private unsplashBaseUrl = 'https://api.unsplash.com'

  constructor() {
    this.perplexityApiKey = process.env.PERPLEXITY_API_KEY || ''
    this.googleApiKey = process.env.GOOGLE_API_KEY || ''
    this.googleCSEId = process.env.GOOGLE_CSE_ID || ''
    this.unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY || ''

    console.log('🔧 Image Search Configuration:')
    console.log('  - Unsplash API:', this.unsplashAccessKey ? `${this.unsplashAccessKey.substring(0, 10)}...` : 'MISSING')
    console.log('  - Perplexity API:', this.perplexityApiKey ? `${this.perplexityApiKey.substring(0, 10)}...` : 'MISSING')
    console.log('  - Google API Key:', this.googleApiKey ? `${this.googleApiKey.substring(0, 10)}...` : 'MISSING')
    console.log('  - Google CSE ID:', this.googleCSEId || 'MISSING')

    if (!this.unsplashAccessKey) {
      console.warn('UNSPLASH_ACCESS_KEY not configured - will fallback to Google and Perplexity')
    }
    if (!this.perplexityApiKey) {
      console.warn('PERPLEXITY_API_KEY not configured - image search will use fallbacks only')
    }
    if (!this.googleApiKey || !this.googleCSEId) {
      console.warn('Google Custom Search not configured - image search will be limited')
    }
  }

  private async searchUnsplashImages(query: string, category: string = 'business'): Promise<ImageResult | null> {
    if (!this.unsplashAccessKey) {
      return null
    }

    try {
      console.log(`🔍 Searching Unsplash for image: ${query} (category: ${category})`)

      const optimizedQuery = this.generateUnsplashSearchQuery(query, category)
      console.log(`🎯 Optimized Unsplash query: ${optimizedQuery}`)

      const searchUrl = new URL(`${this.unsplashBaseUrl}/search/photos`)
      searchUrl.searchParams.set('query', optimizedQuery)
      searchUrl.searchParams.set('per_page', '10')
      searchUrl.searchParams.set('orientation', 'landscape')
      searchUrl.searchParams.set('content_filter', 'high')

      const response = await fetch(searchUrl.toString(), {
        headers: {
          'Authorization': `Client-ID ${this.unsplashAccessKey}`,
          'Accept-Version': 'v1'
        }
      })

      if (!response.ok) {
        console.error(`❌ Unsplash API error: ${response.status} ${response.statusText}`)
        return null
      }

      const data: UnsplashImageResponse = await response.json()
      
      if (data.results && data.results.length > 0) {
        const bestImage = this.selectBestUnsplashImage(data.results, category)
        
        if (bestImage) {
          console.log(`✅ Found Unsplash image: ${bestImage.urls.regular}`)
          return {
            url: bestImage.urls.regular,
            license: "Unsplash License",
            source: 'unsplash',
            alt: bestImage.alt_description || bestImage.description || query,
            attribution: `Photo by ${bestImage.user.name} on Unsplash`
          }
        }
      }

      console.log(`⚠️ No suitable Unsplash images found for query: ${optimizedQuery}`)
      return null
    } catch (error) {
      console.error("❌ Unsplash image search failed:", error)
      return null
    }
  }

  private generateUnsplashSearchQuery(query: string, category: string): string {
    const visualKeywords = this.extractVisualKeywords(query)
    const locationKeywords = this.extractLocationKeywords(query)
    
    const categoryKeywords = {
      politics: ['government', 'building', 'architecture', 'official', 'meeting'],
      business: ['office', 'building', 'finance', 'urban', 'corporate'],
      tech: ['technology', 'innovation', 'modern', 'digital', 'science'],
      health: ['medical', 'hospital', 'healthcare', 'wellness', 'health'],
      lifestyle: ['city', 'culture', 'life', 'people', 'community'],
      entertainment: ['performance', 'culture', 'arts', 'entertainment', 'event']
    }

    const baseCityKeywords = ['hong kong', 'city', 'urban', 'skyline', 'modern']
    const categorySpecificKeywords = categoryKeywords[category as keyof typeof categoryKeywords] || categoryKeywords.business

    if (visualKeywords.length > 0) {
      return `${visualKeywords.slice(0, 2).join(' ')} ${categorySpecificKeywords[0]} ${baseCityKeywords[0]}`
    } else if (locationKeywords.length > 0) {
      return `${locationKeywords[0]} ${categorySpecificKeywords[0]} building`
    } else {
      return `${categorySpecificKeywords[0]} ${baseCityKeywords[0]} ${categorySpecificKeywords[1]}`
    }
  }

  private selectBestUnsplashImage(images: any[], category: string): any | null {
    if (!images || images.length === 0) return null

    const scoredImages = images.map(image => {
      let score = 0
      const description = (image.description || '').toLowerCase()
      const altDescription = (image.alt_description || '').toLowerCase()
      const combinedDescription = `${description} ${altDescription}`

      if (image.width >= 1200 && image.height >= 800) score += 3
      if (image.width / image.height >= 1.3 && image.width / image.height <= 2.0) score += 2

      const categoryKeywords = {
        politics: ['government', 'building', 'architecture', 'official', 'meeting', 'office'],
        business: ['office', 'building', 'finance', 'urban', 'corporate', 'business'],
        tech: ['technology', 'innovation', 'modern', 'digital', 'science', 'tech'],
        health: ['medical', 'hospital', 'healthcare', 'wellness', 'health', 'care'],
        lifestyle: ['city', 'culture', 'life', 'people', 'community', 'lifestyle'],
        entertainment: ['performance', 'culture', 'arts', 'entertainment', 'event', 'show']
      }

      const relevantKeywords = categoryKeywords[category as keyof typeof categoryKeywords] || categoryKeywords.business
      relevantKeywords.forEach(keyword => {
        if (combinedDescription.includes(keyword)) score += 1
      })

      if (combinedDescription.includes('hong kong') || combinedDescription.includes('china') || combinedDescription.includes('asia')) score += 2
      if (combinedDescription.includes('city') || combinedDescription.includes('urban') || combinedDescription.includes('skyline')) score += 1

      return { image, score }
    })

    scoredImages.sort((a, b) => b.score - a.score)
    
    console.log(`📊 Unsplash image scoring results:`)
    scoredImages.forEach((scored, i) => {
      console.log(`   ${i + 1}. Score: ${scored.score} - ${scored.image.alt_description || scored.image.description || 'No description'}`)
    })

    return scoredImages[0]?.image || null
  }

  private async searchPerplexityImages(query: string): Promise<ImageResult | null> {
    if (!this.perplexityApiKey) {
      return null
    }

    try {
      console.log(`🔍 Searching Perplexity for image: ${query}`)

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.perplexityApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "sonar-pro",
          return_images: true,
          image_domain_filter: [
            "-gettyimages.com",     // Exclude paid stock photo sites
            "-shutterstock.com",
            "-istockphoto.com",
            "-depositphotos.com"
          ],
          messages: [
            {
              role: "user",
              content: `Photo of: ${query} Hong Kong news photography`
            }
          ]
        })
      })

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status}`)
      }

      const data: PerplexityImageResponse = await response.json()
      const image = data.choices?.[0]?.message?.images?.[0]

      if (image?.url) {
        console.log(`✅ Found Perplexity image: ${image.url}`)
        return {
          url: image.url,
          license: image.license || "unknown",
          source: 'perplexity',
          alt: image.alt,
          attribution: 'Image provided by Perplexity AI'
        }
      }

      return null
    } catch (error) {
      console.error("❌ Perplexity image search failed:", error)
      return null
    }
  }

  private generateHongKongSearchQueries(query: string, category: string): string[] {
    const queries: string[] = []
    
    // Extract key visual elements and entities from the query
    const visualKeywords = this.extractVisualKeywords(query)
    const locationKeywords = this.extractLocationKeywords(query)
    
    // Strategy 1: Simple and focused on the main topic
    if (visualKeywords.length > 0) {
      queries.push(`Hong Kong ${visualKeywords.slice(0, 2).join(' ')} ${category}`)
    }
    
    // Strategy 2: If specific locations mentioned, use them
    if (locationKeywords.length > 0) {
      queries.push(`${locationKeywords[0]} Hong Kong ${visualKeywords[0] || category}`)
    } else {
      // Otherwise use a simple category-based search
      queries.push(`Hong Kong ${category} news 2024 2025`)
    }
    
    // Strategy 3: Very simple fallback
    queries.push(`Hong Kong ${category}`)
    
    return queries.slice(0, 3) // Return top 3 strategies
  }

  private extractVisualKeywords(query: string): string[] {
    // Remove common non-visual words and extract meaningful visual elements
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'says', 'reports', 'announces', 'reveals', 'shows', 'tells', 'according', 'news', 'latest', 'new', 'recent']
    const visualWords = query.toLowerCase()
      .split(/[\s\-_]+/)
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .slice(0, 4) // Keep top 4 meaningful words
    
    return visualWords
  }

  private extractLocationKeywords(query: string): string[] {
    const hongKongLocations = [
      'Central', 'Admiralty', 'Wan Chai', 'Causeway Bay', 'Tsim Sha Tsui', 'Mong Kok', 'Yau Ma Tei',
      'Sheung Wan', 'Mid-Levels', 'Peak', 'Aberdeen', 'Stanley', 'Repulse Bay', 'Tai Po', 'Sha Tin',
      'Tuen Mun', 'Tsuen Wan', 'Kwun Tong', 'Kowloon Tong', 'Diamond Hill', 'Olympic', 'Airport',
      'Disneyland', 'Ocean Park', 'Victoria Harbour', 'Victoria Peak', 'Star Ferry', 'IFC', 'ICC',
      'Legislative Council', 'Government House', 'Exchange Square', 'Times Square', 'Harbour City',
      'Temple Street', 'Ladies Market', 'Lan Kwai Fong', 'SoHo', 'West Kowloon', 'Science Park',
      'Cyberport', 'Hong Kong University', 'Chinese University'
    ]
    
    const queryLower = query.toLowerCase()
    return hongKongLocations.filter(location => 
      queryLower.includes(location.toLowerCase())
    )
  }

  private getHongKongContextByCategory(category: string): { landmarks: string, context: string } {
    const contextMap = {
      politics: {
        landmarks: 'Legislative Council Government House Central Government Offices Tamar',
        context: 'government political legislative council chief executive'
      },
      business: {
        landmarks: 'IFC ICC Exchange Square Central Business District Admiralty',
        context: 'financial district stock exchange business towers'
      },
      tech: {
        landmarks: 'Science Park Cyberport InnoCentre Innovation Hub',
        context: 'technology innovation startup digital'
      },
      health: {
        landmarks: 'Queen Mary Hospital Princess Margaret Hospital medical centers',
        context: 'healthcare medical hospital clinic'
      },
      lifestyle: {
        landmarks: 'Victoria Harbour Peak Tsim Sha Tsui Central Causeway Bay',
        context: 'lifestyle culture dining entertainment shopping'
      },
      entertainment: {
        landmarks: 'West Kowloon Cultural District Hong Kong Coliseum Avenue of Stars',
        context: 'entertainment culture performance arts cinema'
      }
    }
    
    return contextMap[category as keyof typeof contextMap] || contextMap.business
  }

  private async searchGoogleImages(query: string, category: string = 'business'): Promise<ImageResult | null> {
    console.log(`🔍 Attempting Google CSE search for: ${query} (category: ${category})`)
    console.log(`   API Key: ${this.googleApiKey ? `${this.googleApiKey.substring(0, 10)}...` : 'MISSING'}`)
    console.log(`   CSE ID: ${this.googleCSEId || 'MISSING'}`)
    
    if (!this.googleApiKey || !this.googleCSEId) {
      console.log(`❌ Google search skipped - missing credentials`)
      return null
    }

    // Generate multiple Hong Kong-specific search queries
    const searchQueries = this.generateHongKongSearchQueries(query, category)
    console.log(`🎯 Generated ${searchQueries.length} Hong Kong-specific queries:`)
    searchQueries.forEach((q, i) => console.log(`   ${i + 1}. ${q}`))

    // Try each query until we find results
    for (const [index, searchQuery] of searchQueries.entries()) {
      try {
        console.log(`🔍 Searching Google CSE (attempt ${index + 1}): ${searchQuery}`)

        const searchUrl = new URL('https://customsearch.googleapis.com/customsearch/v1')
        searchUrl.searchParams.set('cx', this.googleCSEId)
        searchUrl.searchParams.set('key', this.googleApiKey)
        searchUrl.searchParams.set('searchType', 'image')
        searchUrl.searchParams.set('q', searchQuery)
        searchUrl.searchParams.set('num', '3') // Get more results to choose from
        searchUrl.searchParams.set('safe', 'active')
        searchUrl.searchParams.set('imgSize', 'medium')
        searchUrl.searchParams.set('rights', 'cc_publicdomain,cc_attribute,cc_sharealike,cc_noncommercial') // Prefer Creative Commons
        searchUrl.searchParams.set('fileType', 'jpg,png,jpeg') // Prefer common image formats
        searchUrl.searchParams.set('imgType', 'photo') // Prefer actual photos over graphics

        console.log(`📡 Google search URL: ${searchUrl.toString().replace(this.googleApiKey, 'API_KEY')}`)
        
        const response = await fetch(searchUrl.toString())
        console.log(`📊 Google API response status: ${response.status}`)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`❌ Google API error: ${response.status} - ${errorText}`)
          
          // If we get a rate limit or quota error, stop trying
          if (response.status === 429 || response.status === 403) {
            throw new Error(`Google CSE API error: ${response.status} - ${errorText}`)
          }
          
          // For other errors, try the next query
          continue
        }

        const data: GoogleCSEResponse = await response.json()
        console.log(`📈 Google search results: ${data.items?.length || 0} items found`)
        
        // Look for the best image from the results
        const bestImage = this.selectBestGoogleImage(data.items || [], category)
        
        if (bestImage) {
          console.log(`✅ Found Google CSE image (query ${index + 1}): ${bestImage.link}`)
          return {
            url: bestImage.link,
            license: bestImage.image.contextLink,
            source: 'google',
            alt: bestImage.title,
            attribution: 'Licensed under Creative Commons'
          }
        }

        console.log(`⚠️ No suitable images found for query ${index + 1}: ${searchQuery}`)
        
        // Rate limiting between queries
        if (index < searchQueries.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        
      } catch (error) {
        console.error(`❌ Google CSE search failed for query ${index + 1}:`, error)
        
        // If it's a rate limit or quota error, don't try more queries
        if (error.message.includes('429') || error.message.includes('403')) {
          break
        }
        
        // For other errors, try the next query
        continue
      }
    }

    console.log(`⚠️ No Google images found after trying ${searchQueries.length} queries`)
    return null
  }

  private selectBestGoogleImage(items: any[], category: string): any | null {
    if (!items || items.length === 0) return null
    
    // Score images based on relevance criteria
    const scoredItems = items.map(item => {
      let score = 0
      const title = (item.title || '').toLowerCase()
      const snippet = (item.snippet || '').toLowerCase()
      const url = (item.link || '').toLowerCase()
      const contextLink = (item.image?.contextLink || '').toLowerCase()
      
      // PENALTY: Strongly penalize obviously irrelevant content
      const irrelevantPeople = ['charles', 'king', 'queen', 'elizabeth', 'nightingale', 'cameron', 'foster', 'wong', 'nicole', 'kidman']
      if (irrelevantPeople.some(person => title.includes(person))) score -= 10
      
      // PENALTY: Penalize Wikipedia portraits and biographical pages
      if (url.includes('wikipedia') && (title.includes('biography') || title.includes('portrait') || !title.includes('hong kong'))) score -= 5
      
      // Prefer images with Hong Kong context
      if (title.includes('hong kong') || snippet.includes('hong kong')) score += 5
      if (contextLink.includes('hong kong') || contextLink.includes('.hk')) score += 3
      
      // Prefer news/photography sites
      if (url.includes('reuters') || url.includes('ap.org') || 
          url.includes('afp') || url.includes('bloomberg') || url.includes('scmp') ||
          url.includes('rthk') || url.includes('hongkongfp') || url.includes('news.gov.hk')) score += 4
      
      // Prefer category-relevant keywords
      if (title.includes(category) || snippet.includes(category)) score += 3
      
      // Prefer recent or news-related content
      if (title.includes('2024') || title.includes('2025') || title.includes('recent')) score += 2
      
      // Avoid generic stock photos and unrelated content
      if (title.includes('stock photo') || title.includes('shutterstock') || 
          url.includes('shutterstock.com') || url.includes('gettyimages.com')) score -= 3
      
      // Avoid marvel/fandom wikis
      if (url.includes('fandom.com') || title.includes('marvel') || title.includes('mcu')) score -= 5
      
      return { item, score }
    })
    
    // Sort by score (highest first)
    scoredItems.sort((a, b) => b.score - a.score)
    
    console.log(`📊 Image scoring results:`)
    scoredItems.forEach((scored, i) => {
      console.log(`   ${i + 1}. Score: ${scored.score} - ${scored.item.title}`)
    })
    
    // Only return images with positive scores
    const bestItem = scoredItems[0]
    if (bestItem && bestItem.score > 0) {
      return bestItem.item
    }
    
    // If all scores are negative or zero, return null to trigger fallback
    console.log(`⚠️ All images have negative/zero scores, will use fallback`)
    return null
  }

  private getHongKongFallbackImage(category: string, query: string = ''): ImageResult {
    // Enhanced Hong Kong-specific fallback images based on category and content
    const hongKongFallbacks = {
      politics: [
        {
          url: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&h=400&fit=crop&q=80",
          alt: "Hong Kong Legislative Council Complex",
          keywords: ["legislative", "council", "government", "policy", "law"]
        },
        {
          url: "https://images.unsplash.com/photo-1533036755165-d5e86ea2eef0?w=800&h=400&fit=crop&q=80",
          alt: "Hong Kong Government House",
          keywords: ["government", "house", "chief", "executive", "administration"]
        },
        {
          url: "https://images.unsplash.com/photo-1553696549-10bbe761bc43?w=800&h=400&fit=crop&q=80",
          alt: "Hong Kong Central Government Offices",
          keywords: ["central", "offices", "tamar", "admiralty", "political"]
        }
      ],
      business: [
        {
          url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=400&fit=crop&q=80",
          alt: "Hong Kong IFC and financial district skyline",
          keywords: ["financial", "exchange", "stock", "market", "ifc", "tower"]
        },
        {
          url: "https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=800&h=400&fit=crop&q=80",
          alt: "Hong Kong Central business district night view",
          keywords: ["business", "central", "district", "corporate", "banking"]
        },
        {
          url: "https://images.unsplash.com/photo-1549547068-0a4c9aab7030?w=800&h=400&fit=crop&q=80",
          alt: "Hong Kong Exchange Square",
          keywords: ["exchange", "square", "trading", "finance", "economy"]
        }
      ],
      tech: [
        {
          url: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=400&fit=crop&q=80",
          alt: "Hong Kong Science Park technology hub",
          keywords: ["science", "park", "technology", "innovation", "startup"]
        },
        {
          url: "https://images.unsplash.com/photo-1562349513-b0c88a23e9d4?w=800&h=400&fit=crop&q=80",
          alt: "Hong Kong Cyberport digital hub",
          keywords: ["cyberport", "digital", "tech", "innovation", "hub"]
        },
        {
          url: "https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=800&h=400&fit=crop&q=80",
          alt: "Hong Kong modern technology infrastructure",
          keywords: ["infrastructure", "digital", "smart", "city", "technology"]
        }
      ],
      health: [
        {
          url: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800&h=400&fit=crop&q=80",
          alt: "Hong Kong medical center exterior",
          keywords: ["hospital", "medical", "healthcare", "clinic", "health"]
        },
        {
          url: "https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800&h=400&fit=crop&q=80",
          alt: "Hong Kong public health facility",
          keywords: ["public", "health", "medical", "facility", "care"]
        },
        {
          url: "https://images.unsplash.com/photo-1583912267550-3e5c1d245544?w=800&h=400&fit=crop&q=80",
          alt: "Hong Kong wellness and healthcare",
          keywords: ["wellness", "healthcare", "medical", "treatment", "therapy"]
        }
      ],
      lifestyle: [
        {
          url: "https://images.unsplash.com/photo-1496024840928-4c417adf211d?w=800&h=400&fit=crop&q=80",
          alt: "Hong Kong Victoria Harbour and skyline",
          keywords: ["victoria", "harbour", "lifestyle", "culture", "scenic"]
        },
        {
          url: "https://images.unsplash.com/photo-1536431311719-398b6704d4cc?w=800&h=400&fit=crop&q=80",
          alt: "Hong Kong street life and culture",
          keywords: ["street", "life", "culture", "local", "community"]
        },
        {
          url: "https://images.unsplash.com/photo-1549547068-0a4c9aab7030?w=800&h=400&fit=crop&q=80",
          alt: "Hong Kong dining and lifestyle scene",
          keywords: ["dining", "food", "restaurant", "lifestyle", "culture"]
        }
      ],
      entertainment: [
        {
          url: "https://images.unsplash.com/photo-1489599833632-cf218da5d6e8?w=800&h=400&fit=crop&q=80",
          alt: "Hong Kong West Kowloon Cultural District",
          keywords: ["cultural", "district", "arts", "performance", "entertainment"]
        },
        {
          url: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800&h=400&fit=crop&q=80",
          alt: "Hong Kong entertainment and events venue",
          keywords: ["events", "venue", "entertainment", "performance", "show"]
        },
        {
          url: "https://images.unsplash.com/photo-1570197526852-34d2e3c7e9c3?w=800&h=400&fit=crop&q=80",
          alt: "Hong Kong cinema and film industry",
          keywords: ["cinema", "film", "movie", "entertainment", "industry"]
        }
      ]
    }

    // Get fallbacks for the category, defaulting to business if category not found
    const categoryFallbacks = hongKongFallbacks[category as keyof typeof hongKongFallbacks] || hongKongFallbacks.business

    // Try to select the most relevant fallback based on query content
    let selectedFallback = categoryFallbacks[0] // Default to first option
    
    if (query) {
      const queryLower = query.toLowerCase()
      // Find the fallback with the most keyword matches
      let bestMatch = 0
      let bestMatchScore = 0
      
      categoryFallbacks.forEach((fallback, index) => {
        const matchScore = fallback.keywords.reduce((score, keyword) => {
          return queryLower.includes(keyword) ? score + 1 : score
        }, 0)
        
        if (matchScore > bestMatchScore) {
          bestMatchScore = matchScore
          bestMatch = index
        }
      })
      
      if (bestMatchScore > 0) {
        selectedFallback = categoryFallbacks[bestMatch]
        console.log(`🎯 Selected contextual fallback with ${bestMatchScore} keyword matches: ${selectedFallback.alt}`)
      }
    }

    return {
      url: selectedFallback.url,
      license: "Unsplash License",
      source: 'fallback',
      alt: selectedFallback.alt,
      attribution: 'Photo by Unsplash - Hong Kong focused'
    }
  }

  async findImage(query: string, category: string = 'business'): Promise<ImageResult> {
    console.log(`🖼️ Searching for image: ${query} (category: ${category})`)

    try {
      // Strategy 1: Try Unsplash first (highest quality, best licensing)
      if (this.unsplashAccessKey) {
        const unsplashResult = await this.searchUnsplashImages(query, category)
        if (unsplashResult) {
          return unsplashResult
        }
      }

      // Strategy 2: Try Google Custom Search as fallback
      if (this.googleApiKey && this.googleCSEId) {
        const googleResult = await this.searchGoogleImages(query, category)
        if (googleResult) {
          return googleResult
        }
      }

      // Strategy 3: Try Perplexity as second fallback
      if (this.perplexityApiKey) {
        const perplexityResult = await this.searchPerplexityImages(query)
        if (perplexityResult) {
          return perplexityResult
        }
      }

      // Strategy 4: Use category-appropriate fallback
      console.log(`⚠️ No images found via API, using Hong Kong-specific fallback for category: ${category}`)
      return this.getHongKongFallbackImage(category, query)

    } catch (error) {
      console.error("💥 Image search failed completely:", error)
      return this.getHongKongFallbackImage(category, query)
    }
  }

  async findImageWithMetadata(enrichedData: {
    title: string
    imagePrompt?: string
    summary?: string
    keyPoints?: string[]
    sources?: Array<{ title: string, url: string, domain?: string }>
    citations?: string[]
  }, category: string = 'business'): Promise<ImageResult> {
    console.log(`🖼️ Searching for image using enriched metadata (category: ${category})`)

    try {
      // Generate smart search queries using the enriched metadata
      const smartQueries = this.generateSmartSearchQueries(enrichedData, category)
      
      // Strategy 1: Try Unsplash first with metadata-based queries
      if (this.unsplashAccessKey) {
        for (const [index, query] of smartQueries.entries()) {
          console.log(`🔍 Trying Unsplash smart query ${index + 1}: ${query}`)
          
          const unsplashResult = await this.searchUnsplashImages(query, category)
          if (unsplashResult) {
            console.log(`✅ Found relevant Unsplash image using smart query ${index + 1}`)
            return unsplashResult
          }
          
          // Brief pause between queries
          if (index < smartQueries.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300))
          }
        }
      }
      
      // Strategy 2: Try Google Custom Search with metadata-based queries
      if (this.googleApiKey && this.googleCSEId) {
        for (const [index, query] of smartQueries.entries()) {
          console.log(`🔍 Trying Google smart query ${index + 1}: ${query}`)
          
          const googleResult = await this.searchSingleGoogleQuery(query, category)
          if (googleResult) {
            console.log(`✅ Found relevant Google image using smart query ${index + 1}`)
            return googleResult
          }
          
          // Brief pause between queries
          if (index < smartQueries.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300))
          }
        }
      }

      // Strategy 3: Try Perplexity as fallback with image prompt
      if (this.perplexityApiKey && enrichedData.imagePrompt) {
        const perplexityResult = await this.searchPerplexityImages(enrichedData.imagePrompt)
        if (perplexityResult) {
          return perplexityResult
        }
      }

      // Strategy 4: Use contextual fallback based on metadata
      console.log(`⚠️ No images found via API, using contextual fallback`)
      return this.getContextualFallbackImage(enrichedData, category)

    } catch (error) {
      console.error("💥 Metadata-based image search failed:", error)
      return this.getHongKongFallbackImage(category, enrichedData.title)
    }
  }

  private generateSmartSearchQueries(enrichedData: {
    title: string
    imagePrompt?: string
    summary?: string
    keyPoints?: string[]
    sources?: Array<{ title: string, url: string, domain?: string }>
    citations?: string[]
  }, category: string): string[] {
    const queries: string[] = []
    
    // Strategy 1: Use the AI-generated image prompt (most targeted)
    if (enrichedData.imagePrompt) {
      // Clean up the image prompt for search - be more aggressive in cleaning
      const cleanPrompt = enrichedData.imagePrompt
        .replace(/professional photography|modern city|news scene|news photography|Hong Kong/gi, '')
        .trim()
      
      // Extract only the core subject from the prompt
      const promptWords = this.extractVisualKeywords(cleanPrompt).slice(0, 3)
      if (promptWords.length > 0) {
        queries.push(`Hong Kong ${promptWords.join(' ')}`)
      }
    }
    
    // Strategy 2: Simple title-based search focusing on main subject
    const titleKeywords = this.extractVisualKeywords(enrichedData.title)
    if (titleKeywords.length > 0) {
      // For health articles, focus on health-related terms
      if (category === 'health' && (titleKeywords.includes('hospital') || titleKeywords.includes('medical') || titleKeywords.includes('health'))) {
        queries.push(`Hong Kong hospital medical ${titleKeywords[0]}`)
      } else {
        queries.push(`Hong Kong ${titleKeywords.slice(0, 2).join(' ')} ${category}`)
      }
    }
    
    // Strategy 3: Category-specific current events
    queries.push(`Hong Kong ${category} 2024 current`)
    
    // Remove duplicates and empty queries
    const uniqueQueries = [...new Set(queries.filter(q => q.length > 0))].slice(0, 3)
    
    // If we don't have enough queries, add simple fallback
    if (uniqueQueries.length < 3) {
      uniqueQueries.push(`Hong Kong ${category} news`)
    }
    
    console.log(`🎯 Generated ${uniqueQueries.length} smart search queries:`)
    uniqueQueries.forEach((q, i) => console.log(`   ${i + 1}. ${q}`))
    
    return uniqueQueries
  }

  private extractKeywordsFromSources(sources: Array<{ title: string, url: string, domain?: string }>): string[] {
    const keywords: string[] = []
    
    // Extract meaningful keywords from source titles and domains
    sources.forEach(source => {
      // Extract from domain (news sources often have meaningful domains)
      if (source.domain) {
        if (source.domain.includes('rthk')) keywords.push('government')
        if (source.domain.includes('scmp')) keywords.push('business')
        if (source.domain.includes('hongkongfp')) keywords.push('press')
        if (source.domain.includes('hk01')) keywords.push('local')
      }
      
      // Extract from source title
      if (source.title) {
        const titleWords = this.extractVisualKeywords(source.title)
        keywords.push(...titleWords.slice(0, 2))
      }
    })
    
    return [...new Set(keywords)].slice(0, 3)
  }

  private async searchSingleGoogleQuery(query: string, category: string): Promise<ImageResult | null> {
    try {
      const searchUrl = new URL('https://customsearch.googleapis.com/customsearch/v1')
      searchUrl.searchParams.set('cx', this.googleCSEId)
      searchUrl.searchParams.set('key', this.googleApiKey)
      searchUrl.searchParams.set('searchType', 'image')
      searchUrl.searchParams.set('q', query)
      searchUrl.searchParams.set('num', '3')
      searchUrl.searchParams.set('safe', 'active')
      searchUrl.searchParams.set('imgSize', 'medium')
      searchUrl.searchParams.set('rights', 'cc_publicdomain,cc_attribute,cc_sharealike,cc_noncommercial')
      searchUrl.searchParams.set('fileType', 'jpg,png,jpeg')
      searchUrl.searchParams.set('imgType', 'photo')

      const response = await fetch(searchUrl.toString())
      
      if (!response.ok) {
        console.log(`❌ Google search failed for query: ${query}`)
        return null
      }

      const data: GoogleCSEResponse = await response.json()
      const bestImage = this.selectBestGoogleImage(data.items || [], category)
      
      if (bestImage) {
        return {
          url: bestImage.link,
          license: bestImage.image.contextLink,
          source: 'google',
          alt: bestImage.title,
          attribution: 'Licensed under Creative Commons'
        }
      }
      
      return null
    } catch (error) {
      console.log(`❌ Search failed for query: ${query}`, error.message)
      return null
    }
  }

  private getContextualFallbackImage(enrichedData: {
    title: string
    imagePrompt?: string
    summary?: string
    keyPoints?: string[]
    sources?: Array<{ title: string, url: string, domain?: string }>
    citations?: string[]
  }, category: string): ImageResult {
    // Use the enhanced metadata to select a more contextual fallback
    let contextQuery = enrichedData.title
    
    // If we have key points, use the first one for context
    if (enrichedData.keyPoints && enrichedData.keyPoints.length > 0) {
      contextQuery += ' ' + enrichedData.keyPoints[0]
    }
    
    return this.getHongKongFallbackImage(category, contextQuery)
  }

  // Batch process images for multiple articles
  async findImages(prompts: Array<{ query: string, category: string, id: string }>): Promise<Map<string, ImageResult>> {
    const results = new Map<string, ImageResult>()

    console.log(`🖼️ Processing ${prompts.length} image searches...`)

    for (const prompt of prompts) {
      try {
        const image = await this.findImage(prompt.query, prompt.category)
        results.set(prompt.id, image)

        // Rate limiting: wait between requests
        if (prompts.indexOf(prompt) < prompts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (error) {
        console.error(`❌ Failed to find image for ${prompt.id}:`, error)
        results.set(prompt.id, this.getHongKongFallbackImage(prompt.category, prompt.query))
      }
    }

    return results
  }

  // Test the enhanced Hong Kong image search functionality with Unsplash priority
  async testImageSearch(): Promise<void> {
    console.log("🧪 Testing enhanced Hong Kong image search functionality with Unsplash priority...")

    const testQueries = [
      { query: "Hong Kong Legislative Council passes new housing policy", category: "politics" },
      { query: "IFC Tower Hong Kong stock market reaches new high", category: "business" },
      { query: "Science Park Hong Kong launches AI innovation hub", category: "tech" },
      { query: "Queen Mary Hospital Hong Kong medical breakthrough", category: "health" },
      { query: "Victoria Harbour Hong Kong cultural festival", category: "lifestyle" },
      { query: "West Kowloon Hong Kong film premiere event", category: "entertainment" }
    ]

    for (const test of testQueries) {
      console.log(`\n🔍 Testing enhanced search: ${test.query}`)
      console.log(`   Category: ${test.category}`)
      
      // Show the generated queries for this test
      if (this.unsplashAccessKey) {
        const unsplashQuery = this.generateUnsplashSearchQuery(test.query, test.category)
        console.log(`   Unsplash query: ${unsplashQuery}`)
      }
      
      const queries = this.generateHongKongSearchQueries(test.query, test.category)
      console.log(`   Google queries: ${queries.length}`)
      queries.forEach((q, i) => console.log(`     ${i + 1}. ${q}`))
      
      const result = await this.findImage(test.query, test.category)
      console.log(`   📸 Result:`)
      console.log(`     Source: ${result.source}`)
      console.log(`     Alt: ${result.alt}`)
      console.log(`     URL: ${result.url.substring(0, 80)}...`)
      console.log(`     Attribution: ${result.attribution}`)
    }

    console.log("\n✅ Enhanced Hong Kong image search test with Unsplash priority completed")
  }
}

export const perplexityImageSearch = new PerplexityImageSearch()
export { PerplexityImageSearch }
export type { ImageResult }