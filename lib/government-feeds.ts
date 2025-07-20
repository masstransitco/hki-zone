import { createClient } from '@supabase/supabase-js'
import Parser from 'rss-parser'
import { XMLParser } from 'fast-xml-parser'
import crypto from 'node:crypto'
import type { Incident, IncidentCategory, GovFeed } from './types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const parser = new Parser({ 
  headers: { 'user-agent': 'hki.zone/crawler 1.0' } 
})

const xmlParser = new XMLParser({ ignoreAttributes: false })

interface ParsedIncident {
  id: string
  source_slug: string
  title: string
  body?: string
  category: IncidentCategory
  severity?: number
  latitude?: number
  longitude?: number
  starts_at?: string
  source_updated_at: string
  relevance_score: number
}

class GovernmentFeeds {
  private static instance: GovernmentFeeds
  
  public static getInstance(): GovernmentFeeds {
    if (!GovernmentFeeds.instance) {
      GovernmentFeeds.instance = new GovernmentFeeds()
    }
    return GovernmentFeeds.instance
  }

  /**
   * Fetch content from URL with timeout
   */
  private async fetchWithTimeout(url: string, timeoutMs = 10000): Promise<string> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    
    try {
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'hki.zone/incident-fetcher 1.0'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      return await response.text()
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Parse standard RSS feed
   */
  private async parseRssFeed(xml: string, feed: GovFeed): Promise<ParsedIncident[]> {
    try {
      const parsedFeed = await parser.parseString(xml)
      
      return parsedFeed.items.map((item: any) => {
        // Use content for ID generation instead of GUID/timestamp
        const incidentId = this.generateIncidentId(
          feed.slug, 
          item.title, 
          item.contentSnippet || item.description
        )
        
        return {
          id: incidentId,
          source_slug: feed.slug,
          title: this.cleanTitle(item.title),
          body: item.contentSnippet || item.description,
          category: this.mapCategory(feed.slug, item.title, item.contentSnippet || item.description),
          severity: this.calculateSeverity(item.title, item.description),
          source_updated_at: new Date(item.isoDate || item.pubDate).toISOString(),
          relevance_score: this.calculateRelevanceScore(item.title, item.description, feed.slug)
        }
      })
    } catch (error) {
      console.error(`Error parsing RSS feed ${feed.slug}:`, error)
      return []
    }
  }

  /**
   * Parse Transport Department custom XML format
   */
  private parseTransportDeptXml(xml: string, feed: GovFeed): ParsedIncident[] {
    try {
      const parsed = xmlParser.parse(xml)
      const items = parsed?.root?.item || []
      
      return items.map((item: any) => {
        // Use content for ID generation instead of newsId
        const incidentId = this.generateIncidentId(
          feed.slug, 
          item.title, 
          item.description
        )
        
        return {
          id: incidentId,
          source_slug: feed.slug,
          title: this.cleanTitle(item.title),
          body: item.description,
          category: 'road' as IncidentCategory,
          severity: Number(item.severity) || this.calculateSeverity(item.title, item.description),
          latitude: item.latitude ? Number(item.latitude) : undefined,
          longitude: item.longitude ? Number(item.longitude) : undefined,
          starts_at: item.startTime ? new Date(item.startTime).toISOString() : undefined,
          source_updated_at: new Date(item.pubDate).toISOString(),
          relevance_score: this.calculateRelevanceScore(item.title, item.description, feed.slug)
        }
      })
    } catch (error) {
      console.error(`Error parsing Transport Dept XML ${feed.slug}:`, error)
      return []
    }
  }

  /**
   * Parse Hospital A&E waiting times JSON API
   */
  private parseHospitalAeJson(json: string, feed: GovFeed): ParsedIncident[] {
    try {
      const data = JSON.parse(json)
      
      // Handle the current HA A&E JSON structure (from opendata endpoint)
      if (data.waitTime && Array.isArray(data.waitTime)) {
        return data.waitTime.map((hospital: any) => {
          const waitTime = hospital.topWait || 'Unknown'
          const hospitalName = hospital.hospName || 'Unknown Hospital'
          const lastUpdated = data.updateTime || 'Unknown'
          
          const title = `A&E Waiting Time: ${hospitalName}`
          const description = `Current waiting time: ${waitTime}. Last updated: ${lastUpdated}`
          
          // Use hospital name for ID generation
          const incidentId = this.generateIncidentId(
            feed.slug,
            title,
            `${hospitalName}_${waitTime}`
          )
          
          // Calculate severity based on waiting time
          const severity = this.calculateAeSeverity(waitTime, waitTime)
          
          return {
            id: incidentId,
            source_slug: feed.slug,
            title: this.cleanTitle(title),
            body: description,
            category: 'utility' as IncidentCategory,
            severity: severity,
            source_updated_at: new Date().toISOString(),
            relevance_score: this.calculateAeRelevanceScore(waitTime, waitTime)
          }
        })
      }
      
      // Handle alternative HA A&E JSON structure (from aedWtData endpoint)
      if (data.result && data.result.hospData && Array.isArray(data.result.hospData)) {
        return data.result.hospData.map((hospital: any) => {
          const waitTime = hospital.topWait || 'Unknown'
          const hospitalName = hospital.hospNameEn || 'Unknown Hospital'
          const hospitalCode = hospital.hospCode || 'UNKNOWN'
          const lastUpdated = hospital.hospTimeEn || 'Unknown'
          
          const title = `A&E Waiting Time: ${hospitalName}`
          const description = `Current waiting time: ${waitTime}. Last updated: ${lastUpdated}. Hospital Code: ${hospitalCode}`
          
          // Use hospital code and current time for ID generation
          const incidentId = this.generateIncidentId(
            feed.slug,
            title,
            `${hospitalCode}_${waitTime}`
          )
          
          // Calculate severity based on waiting time
          const severity = this.calculateAeSeverity(waitTime, waitTime)
          
          // Extract coordinates from hospCoord field
          const coordinates = hospital.hospCoord ? hospital.hospCoord.split(',') : [null, null]
          
          return {
            id: incidentId,
            source_slug: feed.slug,
            title: this.cleanTitle(title),
            body: description,
            category: 'utility' as IncidentCategory,
            severity: severity,
            source_updated_at: new Date().toISOString(),
            relevance_score: this.calculateAeRelevanceScore(waitTime, waitTime)
          }
        })
      }
      
      console.error(`Invalid A&E data structure for ${feed.slug}`)
      return []
    } catch (error) {
      console.error(`Error parsing A&E JSON ${feed.slug}:`, error)
      return []
    }
  }

  /**
   * Parse generic JSON API response
   */
  private parseJsonFeed(json: string, feed: GovFeed): ParsedIncident[] {
    try {
      const data = JSON.parse(json)
      
      // Handle different JSON structures
      let items: any[] = []
      
      if (Array.isArray(data)) {
        items = data
      } else if (data.items && Array.isArray(data.items)) {
        items = data.items
      } else if (data.data && Array.isArray(data.data)) {
        items = data.data
      } else {
        console.error(`Unknown JSON structure for ${feed.slug}`)
        return []
      }
      
      return items.map((item: any, index: number) => {
        const title = item.title || item.name || item.subject || `Item ${index + 1}`
        const description = item.description || item.content || item.summary || JSON.stringify(item)
        
        const incidentId = this.generateIncidentId(
          feed.slug,
          title,
          description
        )
        
        return {
          id: incidentId,
          source_slug: feed.slug,
          title: this.cleanTitle(title),
          body: description,
          category: this.mapCategory(feed.slug, title, description),
          severity: this.calculateSeverity(title, description),
          latitude: item.latitude ? Number(item.latitude) : undefined,
          longitude: item.longitude ? Number(item.longitude) : undefined,
          source_updated_at: item.date || item.timestamp || item.updated || new Date().toISOString(),
          relevance_score: this.calculateRelevanceScore(title, description, feed.slug)
        }
      })
    } catch (error) {
      console.error(`Error parsing JSON feed ${feed.slug}:`, error)
      return []
    }
  }

  /**
   * Generate unique incident ID based on content hash
   */
  private generateIncidentId(slug: string, title: string, content?: string): string {
    // Create hash from normalized content to prevent duplicates
    const normalizedTitle = title.trim().toLowerCase().replace(/\s+/g, ' ')
    const normalizedContent = content ? content.trim().toLowerCase().replace(/\s+/g, ' ') : ''
    const contentHash = crypto.createHash('sha256')
      .update(`${slug}:${normalizedTitle}:${normalizedContent}`)
      .digest('hex')
      .slice(0, 12)
    
    return `${slug}_${contentHash}`
  }

  /**
   * Clean and normalize title
   */
  private cleanTitle(title: string): string {
    return title.trim()
      .replace(/\s+/g, ' ')
      .replace(/[\r\n]/g, ' ')
      .slice(0, 200) // Limit length
  }

  /**
   * Map feed slug to incident category with content-based classification
   */
  private mapCategory(slug: string, title: string = '', description: string = ''): IncidentCategory {
    const text = `${title} ${description}`.toLowerCase()
    
    // Transport Department feeds - enhanced categorization
    if (slug.startsWith('td_')) {
      return this.mapTransportCategory(slug, title, description)
    }
    
    // Health feeds - content-based categorization
    if (slug.startsWith('chp_')) {
      if (text.includes('heat') || text.includes('hot weather')) return 'weather' // Heat warnings better fit weather
      if (slug === 'chp_disease' || slug === 'chp_ncd' || slug === 'chp_guidelines') return 'environment' // CHP health sources -> Environment category
      if (text.includes('disease') || text.includes('virus') || text.includes('infection')) return 'environment' // Disease-related content -> Environment
      if (text.includes('arrest') || text.includes('regulatory')) return 'utility'
      return 'environment' // Map most health content to environment instead of utility
    }
    
    // Financial feeds - content-based categorization  
    if (slug.startsWith('hkma_')) {
      if (slug === 'hkma_press' || slug === 'hkma_speeches') return 'top_signals' // HKMA_PRESS & HKMA_SPEECHES -> Top Signals
      if (text.includes('fraud') || text.includes('scam') || text.includes('phishing')) return 'utility' // Use utility for fraud alerts
      if (text.includes('market') || text.includes('exchange') || text.includes('rate')) return 'utility'
      if (text.includes('regulation') || text.includes('policy') || text.includes('guideline')) return 'utility'
      return 'utility' // Map other financial to utility for now
    }
    
    // Weather feeds - enhanced categorization
    if (slug.startsWith('hko_')) {
      if (text.includes('earthquake') || text.includes('seismic')) return 'weather'
      if (text.includes('typhoon') || text.includes('storm') || text.includes('rain')) return 'weather'
      return 'weather'
    }
    
    // Existing mappings
    if (slug === 'mtr_rail') return 'rail'
    if (slug.startsWith('ha_')) return 'utility' // Hospital Authority A&E feeds -> utility category (excluded from signals)
    if (slug.startsWith('emsd_')) return 'utility'
    if (slug === 'news_gov_top') return 'top_signals' // NEWS_GOV_TOP -> Top Signals
    if (slug.startsWith('news_gov_')) return 'utility' // Map other government news to utility for now
    
    return 'road' // Default fallback
  }
  
  /**
   * Enhanced Transport Department categorization based on content
   */
  private mapTransportCategory(slug: string, title: string, description: string): IncidentCategory {
    const text = `${title} ${description}`.toLowerCase()
    
    if (slug === 'td_special') {
      // Special traffic news - actual incidents
      if (text.includes('accident') || text.includes('crash') || text.includes('collision')) return 'road'
      if (text.includes('closed') || text.includes('blocked') || text.includes('suspended')) return 'road'
      if (text.includes('jam') || text.includes('congestion') || text.includes('slow')) return 'road'
      return 'road'
    }
    
    if (slug === 'td_notices') {
      // Traffic notices - check for rail/bus content
      if (text.includes('mtr') || text.includes('railway') || text.includes('train')) return 'rail'
      if (text.includes('bus') || text.includes('minibus') || text.includes('route')) return 'road'
      if (text.includes('temporary') && text.includes('arrangement')) return 'road'
      if (text.includes('parking') || text.includes('meter')) return 'road'
      return 'road'
    }
    
    if (slug === 'td_press') {
      // Press releases - check for policy vs operational content
      if (text.includes('fraud') || text.includes('scam')) return 'utility' // Fraud alerts better fit utility
      if (text.includes('mtr') || text.includes('railway') || text.includes('train')) return 'rail'
      if (text.includes('regulation') || text.includes('policy')) return 'utility' // Policy better fits utility
      if (text.includes('ballot') || text.includes('registration')) return 'utility' // Administrative better fits utility
      return 'road' // Default for transport department
    }
    
    return 'road' // Default fallback
  }

  /**
   * Calculate severity based on title and content
   */
  private calculateSeverity(title: string, description?: string): number {
    const text = `${title} ${description || ''}`.toLowerCase()
    
    // High severity keywords
    if (text.includes('emergency') || text.includes('urgent') || text.includes('critical') || 
        text.includes('closed') || text.includes('suspended') || text.includes('cancelled')) {
      return 8
    }
    
    // Medium severity keywords
    if (text.includes('delayed') || text.includes('disrupted') || text.includes('warning') || 
        text.includes('accident') || text.includes('incident')) {
      return 5
    }
    
    // Low severity keywords
    if (text.includes('notice') || text.includes('update') || text.includes('maintenance')) {
      return 2
    }
    
    return 3 // Default severity
  }

  /**
   * Calculate relevance score based on content analysis
   */
  private calculateRelevanceScore(title: string, description: string = '', slug: string): number {
    const text = `${title} ${description}`.toLowerCase()
    let score = 50 // Base score
    
    // Boost for high-impact keywords
    if (text.includes('emergency') || text.includes('critical')) score += 30
    if (text.includes('accident') || text.includes('incident')) score += 20
    if (text.includes('delayed') || text.includes('disrupted')) score += 15
    if (text.includes('warning') || text.includes('alert')) score += 10
    
    // Boost for certain sources
    if (slug === 'mtr_rail') score += 10 // MTR incidents are important
    if (slug.startsWith('hko_')) score += 5 // Weather alerts are relevant
    if (slug.startsWith('chp_')) score += 15 // Health alerts are important
    if (slug.startsWith('ha_')) score += 10 // Hospital data is relevant
    
    // Penalty for routine notices
    if (text.includes('routine') || text.includes('scheduled')) score -= 10
    if (text.includes('maintenance')) score -= 5
    
    return Math.max(0, Math.min(100, score))
  }

  /**
   * Calculate A&E severity based on waiting times
   */
  private calculateAeSeverity(waitTime: string, topWait: string): number {
    // Extract numeric values from waiting time strings
    const extractHours = (timeStr: string): number => {
      const match = timeStr.match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : 0;
    };
    
    const waitHours = extractHours(waitTime);
    const topWaitHours = extractHours(topWait);
    const maxWait = Math.max(waitHours, topWaitHours);
    
    // Calculate severity based on waiting time
    if (maxWait >= 8) return 9; // Critical - 8+ hours
    if (maxWait >= 6) return 7; // High - 6-8 hours
    if (maxWait >= 4) return 5; // Medium - 4-6 hours
    if (maxWait >= 2) return 3; // Low - 2-4 hours
    return 1; // Very low - under 2 hours
  }

  /**
   * Calculate A&E relevance score based on waiting times
   */
  private calculateAeRelevanceScore(waitTime: string, topWait: string): number {
    const extractHours = (timeStr: string): number => {
      const match = timeStr.match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : 0;
    };
    
    const waitHours = extractHours(waitTime);
    const topWaitHours = extractHours(topWait);
    const maxWait = Math.max(waitHours, topWaitHours);
    
    // Higher relevance for longer waiting times
    if (maxWait >= 8) return 95; // Critical waiting times
    if (maxWait >= 6) return 85; // High waiting times
    if (maxWait >= 4) return 75; // Medium waiting times
    if (maxWait >= 2) return 65; // Moderate waiting times
    return 55; // Short waiting times
  }

  /**
   * Get hospital latitude by hospital code
   */
  private getHospitalLatitude(hospIdentifier: string): number | undefined {
    const hospitalCoords: { [key: string]: { lat: number; lng: number } } = {
      // By hospital code
      'AHN': { lat: 22.458575, lng: 114.17472 }, // Alice Ho Miu Ling Nethersole Hospital
      'CMC': { lat: 22.341458, lng: 114.153126 }, // Caritas Medical Centre
      'KWH': { lat: 22.315322, lng: 114.172465 }, // Kwong Wah Hospital
      'NDH': { lat: 22.497036, lng: 114.123968 }, // North District Hospital
      'NLT': { lat: 22.282536, lng: 113.939104 }, // North Lantau Hospital
      'PYN': { lat: 22.269419, lng: 114.235707 }, // Pamela Youde Nethersole Eastern Hospital
      'POH': { lat: 22.445051, lng: 114.041691 }, // Pok Oi Hospital
      'PWH': { lat: 22.380531, lng: 114.202017 }, // Prince of Wales Hospital
      'PMH': { lat: 22.340314, lng: 114.134045 }, // Princess Margaret Hospital
      'QEH': { lat: 22.30884, lng: 114.174693 }, // Queen Elizabeth Hospital
      'QMH': { lat: 22.270695, lng: 114.131259 }, // Queen Mary Hospital
      'RH': { lat: 22.275939, lng: 114.175363 }, // Ruttonjee Hospital
      'SJH': { lat: 22.208049, lng: 114.031519 }, // St John Hospital
      'TSH': { lat: 22.458985, lng: 113.995809 }, // Tin Shui Wai Hospital
      'TKO': { lat: 22.317443, lng: 114.270358 }, // Tseung Kwan O Hospital
      'TMH': { lat: 22.406923, lng: 113.975942 }, // Tuen Mun Hospital
      'UCH': { lat: 22.322248, lng: 114.227946 }, // United Christian Hospital
      'YCH': { lat: 22.369653, lng: 114.119561 }, // Yan Chai Hospital
      
      // By hospital name
      'Alice Ho Miu Ling Nethersole Hospital': { lat: 22.458575, lng: 114.17472 },
      'Caritas Medical Centre': { lat: 22.341458, lng: 114.153126 },
      'Kwong Wah Hospital': { lat: 22.315322, lng: 114.172465 },
      'North District Hospital': { lat: 22.497036, lng: 114.123968 },
      'North Lantau Hospital': { lat: 22.282536, lng: 113.939104 },
      'Pamela Youde Nethersole Eastern Hospital': { lat: 22.269419, lng: 114.235707 },
      'Pok Oi Hospital': { lat: 22.445051, lng: 114.041691 },
      'Prince of Wales Hospital': { lat: 22.380531, lng: 114.202017 },
      'Princess Margaret Hospital': { lat: 22.340314, lng: 114.134045 },
      'Queen Elizabeth Hospital': { lat: 22.30884, lng: 114.174693 },
      'Queen Mary Hospital': { lat: 22.270695, lng: 114.131259 },
      'Ruttonjee Hospital': { lat: 22.275939, lng: 114.175363 },
      'St John Hospital': { lat: 22.208049, lng: 114.031519 },
      'Tin Shui Wai Hospital': { lat: 22.458985, lng: 113.995809 },
      'Tseung Kwan O Hospital': { lat: 22.317443, lng: 114.270358 },
      'Tuen Mun Hospital': { lat: 22.406923, lng: 113.975942 },
      'United Christian Hospital': { lat: 22.322248, lng: 114.227946 },
      'Yan Chai Hospital': { lat: 22.369653, lng: 114.119561 }
    };
    
    return hospitalCoords[hospIdentifier]?.lat;
  }

  /**
   * Get hospital longitude by hospital code
   */
  private getHospitalLongitude(hospIdentifier: string): number | undefined {
    const hospitalCoords: { [key: string]: { lat: number; lng: number } } = {
      // By hospital code
      'AHN': { lat: 22.458575, lng: 114.17472 }, // Alice Ho Miu Ling Nethersole Hospital
      'CMC': { lat: 22.341458, lng: 114.153126 }, // Caritas Medical Centre
      'KWH': { lat: 22.315322, lng: 114.172465 }, // Kwong Wah Hospital
      'NDH': { lat: 22.497036, lng: 114.123968 }, // North District Hospital
      'NLT': { lat: 22.282536, lng: 113.939104 }, // North Lantau Hospital
      'PYN': { lat: 22.269419, lng: 114.235707 }, // Pamela Youde Nethersole Eastern Hospital
      'POH': { lat: 22.445051, lng: 114.041691 }, // Pok Oi Hospital
      'PWH': { lat: 22.380531, lng: 114.202017 }, // Prince of Wales Hospital
      'PMH': { lat: 22.340314, lng: 114.134045 }, // Princess Margaret Hospital
      'QEH': { lat: 22.30884, lng: 114.174693 }, // Queen Elizabeth Hospital
      'QMH': { lat: 22.270695, lng: 114.131259 }, // Queen Mary Hospital
      'RH': { lat: 22.275939, lng: 114.175363 }, // Ruttonjee Hospital
      'SJH': { lat: 22.208049, lng: 114.031519 }, // St John Hospital
      'TSH': { lat: 22.458985, lng: 113.995809 }, // Tin Shui Wai Hospital
      'TKO': { lat: 22.317443, lng: 114.270358 }, // Tseung Kwan O Hospital
      'TMH': { lat: 22.406923, lng: 113.975942 }, // Tuen Mun Hospital
      'UCH': { lat: 22.322248, lng: 114.227946 }, // United Christian Hospital
      'YCH': { lat: 22.369653, lng: 114.119561 }, // Yan Chai Hospital
      
      // By hospital name
      'Alice Ho Miu Ling Nethersole Hospital': { lat: 22.458575, lng: 114.17472 },
      'Caritas Medical Centre': { lat: 22.341458, lng: 114.153126 },
      'Kwong Wah Hospital': { lat: 22.315322, lng: 114.172465 },
      'North District Hospital': { lat: 22.497036, lng: 114.123968 },
      'North Lantau Hospital': { lat: 22.282536, lng: 113.939104 },
      'Pamela Youde Nethersole Eastern Hospital': { lat: 22.269419, lng: 114.235707 },
      'Pok Oi Hospital': { lat: 22.445051, lng: 114.041691 },
      'Prince of Wales Hospital': { lat: 22.380531, lng: 114.202017 },
      'Princess Margaret Hospital': { lat: 22.340314, lng: 114.134045 },
      'Queen Elizabeth Hospital': { lat: 22.30884, lng: 114.174693 },
      'Queen Mary Hospital': { lat: 22.270695, lng: 114.131259 },
      'Ruttonjee Hospital': { lat: 22.275939, lng: 114.175363 },
      'St John Hospital': { lat: 22.208049, lng: 114.031519 },
      'Tin Shui Wai Hospital': { lat: 22.458985, lng: 113.995809 },
      'Tseung Kwan O Hospital': { lat: 22.317443, lng: 114.270358 },
      'Tuen Mun Hospital': { lat: 22.406923, lng: 113.975942 },
      'United Christian Hospital': { lat: 22.322248, lng: 114.227946 },
      'Yan Chai Hospital': { lat: 22.369653, lng: 114.119561 }
    };
    
    return hospitalCoords[hospIdentifier]?.lng;
  }

  /**
   * Get all active government feeds
   */
  private async getActiveFeeds(): Promise<GovFeed[]> {
    const { data, error } = await supabase
      .from('gov_feeds')
      .select('*')
      .eq('active', true)
      .order('slug')
    
    if (error) {
      console.error('Error fetching active feeds:', error)
      return []
    }
    
    return data || []
  }

  /**
   * Filter items to only include new ones since last processing
   */
  private async filterNewItems(items: ParsedIncident[], feed: GovFeed): Promise<ParsedIncident[]> {
    if (!feed.last_seen_pubdate) {
      return items // First run, process all items
    }
    
    const lastSeen = new Date(feed.last_seen_pubdate)
    return items.filter(item => {
      const itemDate = new Date(item.source_updated_at)
      return itemDate > lastSeen
    })
  }

  /**
   * Update feed last seen timestamp with specific timestamp
   */
  private async updateFeedLastSeen(feedId: string, lastSeenTimestamp?: string): Promise<void> {
    const timestamp = lastSeenTimestamp || new Date().toISOString()
    const { error } = await supabase
      .from('gov_feeds')
      .update({ last_seen_pubdate: timestamp })
      .eq('id', feedId)
    
    if (error) {
      console.error('Error updating feed timestamp:', error)
    }
  }

  /**
   * Upsert incidents to database
   */
  private async upsertIncidents(incidents: ParsedIncident[]): Promise<number> {
    if (incidents.length === 0) return 0
    
    try {
      const { data, error } = await supabase
        .from('incidents')
        .upsert(incidents, { onConflict: 'id' })
        .select('id')
      
      if (error) {
        console.error('Error upserting incidents:', error)
        return 0
      }
      
      return data?.length || 0
    } catch (error) {
      console.error('Error in upsert operation:', error)
      return 0
    }
  }

  /**
   * Refresh the materialized view with error handling
   */
  private async refreshMaterializedView(): Promise<void> {
    try {
      console.log('🔄 Refreshing materialized view incidents_public...')
      
      const { error } = await supabase.rpc('refresh_incidents_public')
      
      if (error?.code === '55000' && error.message?.includes('cannot refresh materialized view')) {
        console.warn('⚠️ Materialized view refresh failed: Missing unique index for concurrent refresh')
        console.warn('   This error is non-critical - the view may refresh later or can be refreshed manually')
        console.warn('   To fix permanently: CREATE UNIQUE INDEX ON incidents_public (id) or modify refresh to non-concurrent')
        // Don't throw - this error doesn't prevent incident processing from working
        return
      } else if (error) {
        console.error('❌ Error refreshing materialized view:', error)
        // Don't throw - view refresh failures shouldn't stop incident processing
        return
      }
      
      console.log('✅ Materialized view refresh successful')
    } catch (error) {
      console.error('❌ Error calling refresh function:', error)
      // Don't throw - view refresh failures shouldn't stop incident processing
    }
  }

  /**
   * Process a single feed with incremental processing
   */
  private async processFeed(feed: GovFeed): Promise<{ feed: string, incidents: number, errors: string[] }> {
    const errors: string[] = []
    
    try {
      console.log(`Processing feed: ${feed.slug} (${feed.url})`)
      
      // Fetch feed content
      const content = await this.fetchWithTimeout(feed.url)
      
      // Parse based on feed type and content
      let allIncidents: ParsedIncident[] = []
      
      if (feed.slug === 'ha_ae_waiting') {
        // Hospital A&E waiting times JSON API
        allIncidents = this.parseHospitalAeJson(content, feed)
      } else if (feed.slug.startsWith('td_') && !content.includes('<rss')) {
        // Transport Department custom XML format
        allIncidents = this.parseTransportDeptXml(content, feed)
      } else if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
        // Generic JSON API
        allIncidents = this.parseJsonFeed(content, feed)
      } else {
        // Standard RSS format
        allIncidents = await this.parseRssFeed(content, feed)
      }
      
      // Filter to only new items since last processing
      const newIncidents = await this.filterNewItems(allIncidents, feed)
      
      if (newIncidents.length === 0) {
        console.log(`✅ ${feed.slug}: No new incidents since last check`)
        return { feed: feed.slug, incidents: 0, errors: [] }
      }
      
      // Upsert new incidents to database
      const saved = await this.upsertIncidents(newIncidents)
      
      // Update feed timestamp to latest incident time
      if (allIncidents.length > 0) {
        const latestIncident = allIncidents.reduce((latest, current) => 
          new Date(current.source_updated_at) > new Date(latest.source_updated_at) ? current : latest
        )
        await this.updateFeedLastSeen(feed.id, latestIncident.source_updated_at)
      }
      
      console.log(`✅ ${feed.slug}: ${saved}/${newIncidents.length} new incidents processed`)
      
      return {
        feed: feed.slug,
        incidents: saved,
        errors: []
      }
      
    } catch (error) {
      const errorMsg = `Failed to process ${feed.slug}: ${error instanceof Error ? error.message : 'Unknown error'}`
      console.error(errorMsg)
      errors.push(errorMsg)
      
      return {
        feed: feed.slug,
        incidents: 0,
        errors: [errorMsg]
      }
    }
  }

  /**
   * Process all active government feeds
   */
  public async processAllFeeds(): Promise<{
    totalIncidents: number
    processedFeeds: number
    errors: string[]
    results: Array<{ feed: string, incidents: number, errors: string[] }>
  }> {
    console.log('🚀 Starting government feeds processing...')
    
    const feeds = await this.getActiveFeeds()
    
    if (feeds.length === 0) {
      console.log('⚠️ No active feeds found')
      return {
        totalIncidents: 0,
        processedFeeds: 0,
        errors: ['No active feeds found'],
        results: []
      }
    }
    
    console.log(`📡 Processing ${feeds.length} active feeds`)
    
    const results: Array<{ feed: string, incidents: number, errors: string[] }> = []
    const allErrors: string[] = []
    let totalIncidents = 0
    
    // Process feeds sequentially to avoid overwhelming servers
    for (const feed of feeds) {
      const result = await this.processFeed(feed)
      results.push(result)
      totalIncidents += result.incidents
      allErrors.push(...result.errors)
      
      // Rate limiting between feeds
      if (feeds.indexOf(feed) < feeds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    // Refresh materialized view
    await this.refreshMaterializedView()
    
    console.log(`✅ Government feeds processing complete: ${totalIncidents} incidents from ${feeds.length} feeds`)
    
    return {
      totalIncidents,
      processedFeeds: feeds.length,
      errors: allErrors,
      results
    }
  }

  /**
   * Get recent incidents for testing
   */
  public async getRecentIncidents(limit = 10): Promise<Incident[]> {
    const { data, error } = await supabase
      .from('incidents_public')
      .select('*')
      .order('source_updated_at', { ascending: false })
      .limit(limit)
    
    if (error) {
      console.error('Error fetching recent incidents:', error)
      return []
    }
    
    return data || []
  }
}

export const governmentFeeds = GovernmentFeeds.getInstance()
export default governmentFeeds