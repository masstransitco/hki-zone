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

interface ImageResult {
  url: string
  license: string
  source: 'perplexity' | 'google' | 'fallback'
  alt?: string
  attribution?: string
}

class PerplexityImageSearch {
  private perplexityApiKey: string
  private googleApiKey: string
  private googleCSEId: string
  private baseUrl = 'https://api.perplexity.ai/chat/completions'

  constructor() {
    this.perplexityApiKey = process.env.PERPLEXITY_API_KEY || ''
    this.googleApiKey = process.env.GOOGLE_API_KEY || ''
    this.googleCSEId = process.env.GOOGLE_CSE_ID || ''

    console.log('🔧 Image Search Configuration:')
    console.log('  - Perplexity API:', this.perplexityApiKey ? `${this.perplexityApiKey.substring(0, 10)}...` : 'MISSING')
    console.log('  - Google API Key:', this.googleApiKey ? `${this.googleApiKey.substring(0, 10)}...` : 'MISSING')
    console.log('  - Google CSE ID:', this.googleCSEId || 'MISSING')

    if (!this.perplexityApiKey) {
      console.warn('PERPLEXITY_API_KEY not configured - image search will use fallbacks only')
    }
    if (!this.googleApiKey || !this.googleCSEId) {
      console.warn('Google Custom Search not configured - image search will be limited')
    }
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

  private async searchGoogleImages(query: string): Promise<ImageResult | null> {
    console.log(`🔍 Attempting Google CSE search for: ${query}`)
    console.log(`   API Key: ${this.googleApiKey ? `${this.googleApiKey.substring(0, 10)}...` : 'MISSING'}`)
    console.log(`   CSE ID: ${this.googleCSEId || 'MISSING'}`)
    
    if (!this.googleApiKey || !this.googleCSEId) {
      console.log(`❌ Google search skipped - missing credentials`)
      return null
    }

    try {
      console.log(`🔍 Searching Google CSE for image: ${query}`)

      const searchUrl = new URL('https://customsearch.googleapis.com/customsearch/v1')
      searchUrl.searchParams.set('cx', this.googleCSEId)
      searchUrl.searchParams.set('key', this.googleApiKey)
      searchUrl.searchParams.set('searchType', 'image')
      searchUrl.searchParams.set('q', `${query} Hong Kong news`)
      searchUrl.searchParams.set('num', '1')
      searchUrl.searchParams.set('safe', 'active')
      searchUrl.searchParams.set('imgSize', 'medium')

      console.log(`📡 Google search URL: ${searchUrl.toString().replace(this.googleApiKey, 'API_KEY')}`)
      
      const response = await fetch(searchUrl.toString())
      console.log(`📊 Google API response status: ${response.status}`)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ Google API error: ${response.status} - ${errorText}`)
        throw new Error(`Google CSE API error: ${response.status} - ${errorText}`)
      }

      const data: GoogleCSEResponse = await response.json()
      console.log(`📈 Google search results: ${data.items?.length || 0} items found`)
      const image = data.items?.[0]

      if (image?.link) {
        console.log(`✅ Found Google CSE image: ${image.link}`)
        return {
          url: image.link,
          license: image.image.contextLink,
          source: 'google',
          alt: image.title,
          attribution: 'Licensed under Creative Commons'
        }
      }

      console.log(`⚠️ No Google images found for query: ${query}`)
      return null
    } catch (error) {
      console.error("❌ Google CSE image search failed:", error)
      return null
    }
  }

  private getFallbackImage(category: string): ImageResult {
    // Provide appropriate fallback images based on category
    const fallbackImages = {
      politics: {
        url: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&h=400&fit=crop",
        alt: "Hong Kong government building",
        category: "politics"
      },
      business: {
        url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=400&fit=crop",
        alt: "Hong Kong skyline business district",
        category: "business"
      },
      tech: {
        url: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=400&fit=crop",
        alt: "Technology and innovation",
        category: "tech"
      },
      health: {
        url: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800&h=400&fit=crop",
        alt: "Healthcare and medical",
        category: "health"
      },
      lifestyle: {
        url: "https://images.unsplash.com/photo-1496024840928-4c417adf211d?w=800&h=400&fit=crop",
        alt: "Hong Kong lifestyle and culture",
        category: "lifestyle"
      },
      entertainment: {
        url: "https://images.unsplash.com/photo-1489599833632-cf218da5d6e8?w=800&h=400&fit=crop",
        alt: "Entertainment and events",
        category: "entertainment"
      }
    }

    const fallback = fallbackImages[category as keyof typeof fallbackImages] || fallbackImages.business

    return {
      url: fallback.url,
      license: "Unsplash License",
      source: 'fallback',
      alt: fallback.alt,
      attribution: 'Photo by Unsplash'
    }
  }

  async findImage(query: string, category: string = 'business'): Promise<ImageResult> {
    console.log(`🖼️ Searching for image: ${query}`)

    try {
      // Strategy 1: Try Google Custom Search if available (more reliable than Perplexity for images)
      if (this.googleApiKey && this.googleCSEId) {
        const googleResult = await this.searchGoogleImages(query)
        if (googleResult) {
          return googleResult
        }
      }

      // Strategy 2: Try Perplexity as fallback
      if (this.perplexityApiKey) {
        const perplexityResult = await this.searchPerplexityImages(query)
        if (perplexityResult) {
          return perplexityResult
        }
      }

      // Strategy 3: Use category-appropriate fallback
      console.log(`⚠️ No images found via API, using fallback for category: ${category}`)
      return this.getFallbackImage(category)

    } catch (error) {
      console.error("💥 Image search failed completely:", error)
      return this.getFallbackImage(category)
    }
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
        results.set(prompt.id, this.getFallbackImage(prompt.category))
      }
    }

    return results
  }

  // Test the image search functionality
  async testImageSearch(): Promise<void> {
    console.log("🧪 Testing image search functionality...")

    const testQueries = [
      { query: "Hong Kong Legislative Council meeting", category: "politics" },
      { query: "Hong Kong property market development", category: "business" },
      { query: "Hong Kong smart city technology", category: "tech" }
    ]

    for (const test of testQueries) {
      console.log(`\n🔍 Testing: ${test.query}`)
      const result = await this.findImage(test.query, test.category)
      console.log(`   Source: ${result.source}`)
      console.log(`   URL: ${result.url}`)
      console.log(`   License: ${result.license}`)
      console.log(`   Attribution: ${result.attribution}`)
    }

    console.log("\n✅ Image search test completed")
  }
}

export const perplexityImageSearch = new PerplexityImageSearch()
export { PerplexityImageSearch }
export type { ImageResult }