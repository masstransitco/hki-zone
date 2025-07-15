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
          category: this.mapCategory(feed.slug),
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
   * Map feed slug to incident category
   */
  private mapCategory(slug: string): IncidentCategory {
    if (slug.startsWith('td_')) return 'road'
    if (slug === 'mtr_rail') return 'rail'
    if (slug.startsWith('hko_')) return 'weather'
    if (slug.startsWith('emsd_')) return 'utility'
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
    
    // Penalty for routine notices
    if (text.includes('routine') || text.includes('scheduled')) score -= 10
    if (text.includes('maintenance')) score -= 5
    
    return Math.max(0, Math.min(100, score))
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
   * Refresh the materialized view
   */
  private async refreshMaterializedView(): Promise<void> {
    try {
      const { error } = await supabase.rpc('refresh_incidents_public')
      if (error) {
        console.error('Error refreshing materialized view:', error)
      }
    } catch (error) {
      console.error('Error calling refresh function:', error)
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
      
      // Parse based on feed type
      let allIncidents: ParsedIncident[] = []
      
      if (feed.slug.startsWith('td_') && !content.includes('<rss')) {
        // Transport Department custom XML format
        allIncidents = this.parseTransportDeptXml(content, feed)
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