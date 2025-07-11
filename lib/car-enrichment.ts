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

interface CarEnrichmentResult {
  estimatedYear: number | null
  faults: string[]
  isElectric: boolean
  fuelConsumption: string | null
  fuelCostHKD: string | null
  sources: string[]
  searchQueries: string[]
  enrichmentCost: string
}

interface CarSpecs {
  make?: string
  model?: string
  year?: string
  price?: string
  engine?: string
  fuel?: string
  mileage?: string
  transmission?: string
}

class CarEnricher {
  private apiKey: string
  private baseUrl = 'https://api.perplexity.ai'
  
  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || ''
    if (!this.apiKey) {
      console.warn('PERPLEXITY_API_KEY not configured - car enrichment features will be disabled')
    }
  }

  async enrichCar(
    title: string,
    content: string,
    specs: CarSpecs
  ): Promise<CarEnrichmentResult> {
    if (!this.apiKey) {
      throw new Error('Perplexity API key not configured')
    }

    const carInfo = `${specs.make || ''} ${specs.model || ''}`.trim()
    const price = specs.price || ''
    const year = specs.year || ''

    console.log(`Enriching car: ${carInfo} - Price: ${price} - Year: ${year}`)

    // Step 1: Determine estimated year if not provided
    let estimatedYear: number | null = null
    if (year && !isNaN(parseInt(year))) {
      estimatedYear = parseInt(year)
    } else if (carInfo && price) {
      estimatedYear = await this.estimateCarYear(carInfo, price)
    }

    // Step 2: Get commonly reported faults
    const faults = await this.getCommonFaults(carInfo, estimatedYear)

    // Step 3: Determine if electric and fuel consumption
    const electricAndFuel = await this.getElectricAndFuelInfo(carInfo, estimatedYear)

    return {
      estimatedYear,
      faults: faults.faults,
      isElectric: electricAndFuel.isElectric,
      fuelConsumption: electricAndFuel.fuelConsumption,
      fuelCostHKD: electricAndFuel.fuelCostHKD,
      sources: [...faults.sources, ...electricAndFuel.sources],
      searchQueries: [`${carInfo} common problems`, `${carInfo} electric fuel consumption`],
      enrichmentCost: this.estimateEnrichmentCost(carInfo, price)
    }
  }

  private async estimateCarYear(carInfo: string, price: string): Promise<number | null> {
    const query = `Based on the current market price of ${price} in Hong Kong, what is the most likely year of manufacture for a ${carInfo}? Consider Hong Kong car market values and depreciation rates. Provide only the most probable year as a number.`

    try {
      const response = await this.performSearch(query, {
        maxTokens: 200,
        temperature: 0.1
      })

      // Extract year from response
      const yearMatch = response.content.match(/\b(19|20)\d{2}\b/)
      if (yearMatch) {
        const year = parseInt(yearMatch[0])
        if (year >= 1990 && year <= new Date().getFullYear()) {
          return year
        }
      }
      return null
    } catch (error) {
      console.error('Failed to estimate car year:', error)
      return null
    }
  }

  private async getCommonFaults(carInfo: string, year: number | null): Promise<{faults: string[], sources: string[]}> {
    const yearStr = year ? ` ${year}` : ''
    const query = `What are the most commonly reported mechanical problems and faults for${yearStr} ${carInfo}? Focus on issues that potential buyers should inspect. Provide 5-7 specific problems in bullet point format.`

    try {
      const response = await this.performSearch(query, {
        maxTokens: 600,
        temperature: 0.2
      })

      const faults = this.extractBulletPoints(response.content)
      const sources = this.extractSources(response.content)

      return { faults, sources }
    } catch (error) {
      console.error('Failed to get common faults:', error)
      return { faults: [], sources: [] }
    }
  }

  private async getElectricAndFuelInfo(carInfo: string, year: number | null): Promise<{
    isElectric: boolean,
    fuelConsumption: string | null,
    fuelCostHKD: string | null,
    sources: string[]
  }> {
    const yearStr = year ? ` ${year}` : ''
    const query = `For${yearStr} ${carInfo}: 1) Is this an electric vehicle, hybrid, or conventional fuel vehicle? 2) What is the fuel consumption (L/100km for petrol/diesel, kWh/100km for electric)? 3) What is the estimated monthly fuel cost in Hong Kong dollars for average driving (1000km/month)? Use current Hong Kong fuel prices.`

    try {
      const response = await this.performSearch(query, {
        maxTokens: 500,
        temperature: 0.2
      })

      const content = response.content.toLowerCase()
      const isElectric = content.includes('electric') && !content.includes('not electric') && !content.includes('not an electric')
      
      let fuelConsumption: string | null = null
      let fuelCostHKD: string | null = null

      // Extract fuel consumption
      const consumptionMatch = content.match(/(\d+(?:\.\d+)?)\s*(?:l\/100km|kwh\/100km|litres?\s*per\s*100\s*km|kwh\s*per\s*100\s*km)/i)
      if (consumptionMatch) {
        const unit = isElectric ? 'kWh/100km' : 'L/100km'
        fuelConsumption = `${consumptionMatch[1]} ${unit}`
      }

      // Extract fuel cost
      const costMatch = content.match(/hk\$\s*(\d+(?:,\d+)?(?:\.\d+)?)/i)
      if (costMatch) {
        fuelCostHKD = `HK$${costMatch[1]}`
      }

      return {
        isElectric,
        fuelConsumption,
        fuelCostHKD,
        sources: this.extractSources(response.content)
      }
    } catch (error) {
      console.error('Failed to get electric/fuel info:', error)
      return {
        isElectric: false,
        fuelConsumption: null,
        fuelCostHKD: null,
        sources: []
      }
    }
  }

  private async performSearch(
    query: string,
    options: {
      maxTokens?: number,
      temperature?: number,
      recencyFilter?: 'hour' | 'day' | 'week' | 'month'
    } = {}
  ): Promise<{content: string, sources: string[]}> {
    if (!this.apiKey) {
      throw new Error('Perplexity API key not configured')
    }

    const requestBody = {
      model: 'sonar-pro',
      messages: [
        {
          role: 'system',
          content: 'You are an automotive expert specializing in Hong Kong car market analysis. Provide accurate, specific information about vehicles commonly sold in Hong Kong.'
        },
        {
          role: 'user',
          content: query
        }
      ],
      max_tokens: options.maxTokens || 500,
      temperature: options.temperature || 0.3,
      search_recency_filter: options.recencyFilter || 'month',
      return_related_questions: false
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

  private extractBulletPoints(content: string): string[] {
    const lines = content.split('\n')
    const bulletPoints: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      // Match various bullet point formats
      if (trimmed.match(/^[\*\-\•\d+\.\)]/)) {
        const cleaned = trimmed.replace(/^[\*\-\•\d+\.\)]\s*/, '').trim()
        if (cleaned.length > 5) {
          bulletPoints.push(cleaned)
        }
      }
    }

    return bulletPoints.slice(0, 7) // Limit to 7 points
  }

  private extractSources(content: string): string[] {
    const sources: string[] = []
    
    // Look for URLs
    const urlPattern = /https?:\/\/[^\s\)\"]+/g
    const urls = content.match(urlPattern) || []
    sources.push(...urls)

    // Look for source mentions
    const sourcePattern = /according to ([^,\.\n]+)/gi
    const sourceMentions = content.match(sourcePattern) || []
    sources.push(...sourceMentions.map(mention => mention.replace(/according to /i, '')))

    // Remove duplicates
    return Array.from(new Set(sources)).slice(0, 5)
  }

  private estimateEnrichmentCost(carInfo: string, price: string): string {
    // Rough estimate based on 3 API calls with average 400 tokens each
    const estimatedTokens = 1200
    const estimatedCost = (estimatedTokens / 1000) * 0.005 // Sonar-pro pricing
    return `~$${estimatedCost.toFixed(4)}`
  }

  // Utility method to check if API is configured
  isConfigured(): boolean {
    return !!this.apiKey
  }

  // Parse car specifications from content
  parseCarSpecs(content: string): CarSpecs {
    const specs: CarSpecs = {}
    if (!content) return specs
    
    // Use same parsing logic as in the car feed
    let tempContent = content
    
    // Find all instances of numbers with commas
    // Updated regex to handle multi-comma numbers like 2,450,001
    const numberWithCommasRegex = /(\d{1,3}(?:,\d{3})*)/g
    const numbersWithCommas = tempContent.match(numberWithCommasRegex) || []
    
    // Replace each number with commas with a placeholder
    numbersWithCommas.forEach((num, index) => {
      tempContent = tempContent.replace(num, `###NUMBER_${index}###`)
    })
    
    // Split by comma
    const pairs = tempContent.split(',').map(pair => pair.trim())
    
    for (const pair of pairs) {
      const colonIndex = pair.indexOf(':')
      if (colonIndex === -1) continue
      
      const key = pair.substring(0, colonIndex).trim()
      let value = pair.substring(colonIndex + 1).trim()
      
      // Restore numbers with commas
      numbersWithCommas.forEach((num, index) => {
        value = value.replace(`###NUMBER_${index}###`, num)
      })
      
      if (key && value) {
        const lowerKey = key.toLowerCase()
        
        if (lowerKey === 'engine') specs.engine = value
        else if (lowerKey === 'transmission') specs.transmission = value
        else if (lowerKey === 'fuel') specs.fuel = value
        else if (lowerKey === 'mileage') specs.mileage = value
        else if (lowerKey === 'year') specs.year = value
        else if (lowerKey === 'make') specs.make = value
        else if (lowerKey === 'model') specs.model = value
        else if (lowerKey === 'price') specs.price = value
      }
    }
    
    return specs
  }
}

// Export singleton instance
export const carEnricher = new CarEnricher()

// Export interfaces for use in other files
export type { CarEnrichmentResult, CarSpecs }