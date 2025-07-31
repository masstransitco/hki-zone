import { createClient, SupabaseClient } from '@supabase/supabase-js'
import Parser from 'rss-parser'
import { createHash } from 'crypto'
import xml2js from 'xml2js'

interface UnifiedFeedItem {
  guid: string
  title: string
  body: string
  link: string
  pubDate: Date
}

interface MultilingualContent {
  en?: UnifiedFeedItem
  'zh-TW'?: UnifiedFeedItem
  'zh-CN'?: UnifiedFeedItem
}

export class UnifiedGovernmentFeeds {
  private parser: Parser
  private xmlParser: xml2js.Parser
  private supabase: SupabaseClient

  constructor() {
    this.parser = new Parser({
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HKI-Zone/1.0)',
      },
      customFields: {
        item: ['description', 'content:encoded', 'link', 'guid', 'pubDate']
      }
    })
    
    this.xmlParser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true
    })
    
    // Initialize Supabase client
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  /**
   * Main processing function - fetches all active feeds and processes them
   */
  async processAllFeeds(): Promise<void> {
    console.log('Starting unified feed processing...')
    
    // Get all active feed configurations
    const { data: feeds, error } = await this.supabase
      .from('gov_feeds_unified')
      .select('*')
      .eq('active', true)
    
    if (error || !feeds) {
      console.error('Error fetching feed configurations:', error)
      return
    }

    // Group feeds by base_slug to process all languages together
    const feedGroups = this.groupFeedsByBaseSlug(feeds)
    
    // Process each feed group
    for (const [baseSlug, feedGroup] of Object.entries(feedGroups)) {
      console.log(`Processing feed group: ${baseSlug}`)
      
      try {
        await this.processFeedGroup(baseSlug, feedGroup)
      } catch (error) {
        console.error(`Error processing feed group ${baseSlug}:`, error)
      }
    }
    
    console.log('Feed processing completed')
  }

  /**
   * Process a group of feeds (all language variants of same feed)
   */
  async processFeedGroup(baseSlug: string, feedGroup: any): Promise<void> {
    const multilingualItems = new Map<string, MultilingualContent>()
    
    // Fetch all language variants
    for (const [lang, url] of Object.entries({
      en: feedGroup.url_en,
      'zh-TW': feedGroup.url_zh_tw,
      'zh-CN': feedGroup.url_zh_cn
    })) {
      if (!url) continue
      
      console.log(`Fetching ${lang} feed from: ${url}`)
      
      try {
        const items = await this.fetchFeed(url as string, baseSlug)
        
        // Merge items into multilingual structure
        for (const item of items) {
          const key = this.generateItemKey(item)
          
          if (!multilingualItems.has(key)) {
            multilingualItems.set(key, {})
          }
          
          const content = multilingualItems.get(key)!
          content[lang as keyof MultilingualContent] = item
        }
        
        // Update last fetch timestamp
        const updateField = `last_fetch_${lang.toLowerCase().replace('-', '_')}`
        await this.supabase
          .from('gov_feeds_unified')
          .update({ [updateField]: new Date().toISOString() })
          .eq('id', feedGroup.id)
          
      } catch (error) {
        console.error(`Error fetching ${lang} feed:`, error)
      }
    }
    
    // Store unified incidents
    await this.storeUnifiedIncidents(feedGroup, multilingualItems)
  }

  /**
   * Fetch and parse a single feed
   */
  private async fetchFeed(url: string, baseSlug: string): Promise<UnifiedFeedItem[]> {
    // Special handling for Transport Department feeds
    if (baseSlug.startsWith('td_')) {
      return this.fetchTransportDeptFeed(url)
    }
    
    // Standard RSS parsing
    try {
      const feed = await this.parser.parseURL(url)
      
      return feed.items.map(item => ({
        guid: item.guid || item.link || '',
        title: this.cleanText(item.title || ''),
        body: this.cleanText(item.description || item['content:encoded'] || ''),
        link: item.link || '',
        pubDate: new Date(item.pubDate || Date.now())
      }))
    } catch (error) {
      console.error(`Error parsing RSS feed ${url}:`, error)
      return []
    }
  }

  /**
   * Special parser for Transport Department XML feeds
   */
  private async fetchTransportDeptFeed(url: string): Promise<UnifiedFeedItem[]> {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HKI-Zone/1.0)' }
      })
      
      const xml = await response.text()
      const result = await this.xmlParser.parseStringPromise(xml)
      
      const messages = result?.message?.messages || []
      const items: UnifiedFeedItem[] = []
      
      for (const msg of Array.isArray(messages) ? messages : [messages]) {
        if (!msg) continue
        
        const msgId = msg.msgID || msg.msg_id || ''
        const issueDate = msg.issueDate || msg.issue_date || ''
        const content = msg.content || msg.description || ''
        const heading = msg.heading || msg.title || ''
        
        items.push({
          guid: `td_${msgId}`,
          title: this.cleanText(heading),
          body: this.cleanText(content),
          link: url,
          pubDate: new Date(issueDate || Date.now())
        })
      }
      
      return items
    } catch (error) {
      console.error(`Error parsing Transport Dept feed ${url}:`, error)
      return []
    }
  }

  /**
   * Generate a unique key for matching items across languages
   */
  private generateItemKey(item: UnifiedFeedItem): string {
    // Use publish date + partial content hash for matching
    const dateKey = item.pubDate.toISOString().split('T')[0]
    const contentHash = createHash('sha256')
      .update(item.title.substring(0, 50))
      .digest('hex')
      .substring(0, 8)
    
    return `${dateKey}_${contentHash}`
  }

  /**
   * Store unified incidents with multilingual content
   */
  private async storeUnifiedIncidents(
    feedConfig: any,
    multilingualItems: Map<string, MultilingualContent>
  ): Promise<void> {
    const incidents = []
    
    for (const [key, content] of multilingualItems) {
      // Get primary item (prefer English)
      const primaryItem = content.en || content['zh-TW'] || content['zh-CN']
      if (!primaryItem) continue
      
      // Generate content hash for deduplication
      const contentHash = this.generateContentHash(content)
      
      // Build multilingual content structure
      const multilingualContent: any = {}
      
      for (const [lang, item] of Object.entries(content)) {
        if (item) {
          multilingualContent[lang] = {
            title: item.title,
            body: item.body,
            link: item.link
          }
        }
      }
      
      incidents.push({
        feed_id: feedConfig.id,
        source_guid: primaryItem.guid,
        source_published_at: primaryItem.pubDate.toISOString(),
        content: multilingualContent,
        category: 'gov',
        severity: this.calculateSeverity(primaryItem),
        relevance_score: this.calculateRelevance(primaryItem),
        content_hash: contentHash
      })
    }
    
    // Batch upsert incidents
    if (incidents.length > 0) {
      const { error } = await this.supabase
        .from('incidents_unified')
        .upsert(incidents, {
          onConflict: 'content_hash',
          ignoreDuplicates: true
        })
      
      if (error) {
        console.error(`Error storing incidents for ${feedConfig.base_slug}:`, error)
      } else {
        console.log(`Stored ${incidents.length} unified incidents for ${feedConfig.base_slug}`)
      }
    }
  }

  /**
   * Calculate severity based on content keywords
   */
  private calculateSeverity(item: UnifiedFeedItem): number {
    const content = `${item.title} ${item.body}`.toLowerCase()
    
    // High severity keywords
    if (content.match(/urgent|emergency|severe|critical|immediate|major disruption|suspended/)) {
      return 5
    }
    
    // Medium-high severity
    if (content.match(/disruption|delayed|affected|diverted|closed|suspended/)) {
      return 4
    }
    
    // Medium severity
    if (content.match(/temporary|relocation|special traffic|arrangement/)) {
      return 3
    }
    
    // Default
    return 2
  }

  /**
   * Calculate relevance score based on content
   */
  private calculateRelevance(item: UnifiedFeedItem): number {
    const now = new Date()
    const hoursSincePublished = (now.getTime() - item.pubDate.getTime()) / (1000 * 60 * 60)
    
    // Time-based decay
    let score = Math.max(0, 1 - (hoursSincePublished / 168)) // 7 days decay
    
    // Boost for severity keywords
    const content = `${item.title} ${item.body}`.toLowerCase()
    if (content.match(/urgent|emergency|severe/)) {
      score = Math.min(1, score + 0.3)
    }
    
    return Math.round(score * 100) / 100
  }

  /**
   * Generate content hash for deduplication
   */
  private generateContentHash(content: MultilingualContent): string {
    const combined = Object.entries(content)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([lang, item]) => `${lang}:${item?.title}:${item?.body}`)
      .join('|')
    
    return createHash('sha256').update(combined).digest('hex')
  }

  /**
   * Clean text content
   */
  private cleanText(text: string): string {
    if (!text) return ''
    
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Group feeds by base slug
   */
  private groupFeedsByBaseSlug(feeds: any[]): Record<string, any> {
    const groups: Record<string, any> = {}
    
    for (const feed of feeds) {
      groups[feed.base_slug] = feed
    }
    
    return groups
  }
}

// Export singleton instance getter
let instance: UnifiedGovernmentFeeds | null = null

export function getUnifiedFeeds(): UnifiedGovernmentFeeds {
  if (!instance) {
    instance = new UnifiedGovernmentFeeds()
  }
  return instance
}