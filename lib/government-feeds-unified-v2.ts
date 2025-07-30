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

export class UnifiedGovernmentFeedsV2 {
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
    
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  /**
   * Process all feeds with proper multilingual merging
   */
  async processAllFeeds(): Promise<void> {
    console.log('Starting unified feed processing V2...')
    
    const { data: feeds, error } = await this.supabase
      .from('gov_feeds_unified')
      .select('*')
      .eq('active', true)
    
    if (error || !feeds) {
      console.error('Error fetching feed configurations:', error)
      return
    }

    for (const feed of feeds) {
      console.log(`Processing feed: ${feed.base_slug}`)
      
      try {
        await this.processFeed(feed)
      } catch (error) {
        console.error(`Error processing feed ${feed.base_slug}:`, error)
      }
    }
    
    console.log('Feed processing completed')
  }

  /**
   * Process a single feed with all language variants
   */
  private async processFeed(feedConfig: any): Promise<void> {
    // Fetch all language variants
    const allItems: { [key: string]: UnifiedFeedItem[] } = {}
    
    for (const [lang, url] of Object.entries({
      en: feedConfig.url_en,
      'zh-TW': feedConfig.url_zh_tw,
      'zh-CN': feedConfig.url_zh_cn
    })) {
      if (!url) continue
      
      console.log(`  Fetching ${lang} from: ${url}`)
      
      try {
        const items = await this.fetchFeed(url as string, feedConfig.base_slug)
        if (items.length > 0) {
          allItems[lang] = items
        }
      } catch (error) {
        console.error(`  Error fetching ${lang}:`, error)
      }
    }
    
    // Update last fetch timestamps
    for (const lang of Object.keys(allItems)) {
      const updateField = `last_fetch_${lang.toLowerCase().replace('-', '_')}`
      await this.supabase
        .from('gov_feeds_unified')
        .update({ [updateField]: new Date().toISOString() })
        .eq('id', feedConfig.id)
    }
    
    // Merge items by timestamp
    const mergedIncidents = this.mergeItemsByTimestamp(allItems)
    
    // Store merged incidents
    await this.storeMergedIncidents(feedConfig, mergedIncidents)
  }

  /**
   * Merge items from different languages by matching timestamps
   */
  private mergeItemsByTimestamp(allItems: { [key: string]: UnifiedFeedItem[] }): MultilingualContent[] {
    const timeMap = new Map<string, MultilingualContent>()
    
    // Process each language's items
    for (const [lang, items] of Object.entries(allItems)) {
      for (const item of items) {
        // Use timestamp as key (to nearest minute to handle slight differences)
        const timeKey = new Date(Math.floor(item.pubDate.getTime() / 60000) * 60000).toISOString()
        
        if (!timeMap.has(timeKey)) {
          timeMap.set(timeKey, {})
        }
        
        const content = timeMap.get(timeKey)!
        content[lang as keyof MultilingualContent] = item
      }
    }
    
    // Convert to array and sort by time
    return Array.from(timeMap.values()).sort((a, b) => {
      const aTime = (a.en?.pubDate || a['zh-TW']?.pubDate || a['zh-CN']?.pubDate)!
      const bTime = (b.en?.pubDate || b['zh-TW']?.pubDate || b['zh-CN']?.pubDate)!
      return bTime.getTime() - aTime.getTime()
    })
  }

  /**
   * Store properly merged incidents
   */
  private async storeMergedIncidents(
    feedConfig: any,
    mergedIncidents: MultilingualContent[]
  ): Promise<void> {
    const incidents = []
    
    for (const content of mergedIncidents) {
      // Get any available item for metadata
      const anyItem = content.en || content['zh-TW'] || content['zh-CN']
      if (!anyItem) continue
      
      // Build unified content structure
      const unifiedContent: any = {}
      let combinedGuid = ''
      
      for (const [lang, item] of Object.entries(content)) {
        if (item) {
          unifiedContent[lang] = {
            title: item.title,
            body: item.body,
            link: item.link
          }
          combinedGuid += `${lang}:${item.guid}|`
        }
      }
      
      // Generate content hash for deduplication
      const contentHash = createHash('sha256')
        .update(JSON.stringify(unifiedContent))
        .digest('hex')
      
      incidents.push({
        feed_id: feedConfig.id,
        source_guid: combinedGuid || anyItem.guid,
        source_published_at: anyItem.pubDate.toISOString(),
        content: unifiedContent,
        category: 'gov',
        severity: this.calculateSeverity(anyItem),
        relevance_score: this.calculateRelevance(anyItem),
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
        console.log(`  Stored ${incidents.length} unified incidents`)
      }
    }
  }

  /**
   * Fetch and parse a single feed
   */
  private async fetchFeed(url: string, baseSlug: string): Promise<UnifiedFeedItem[]> {
    // Transport Department now uses standard RSS format
    // No special handling needed
    
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
      
      let xml = await response.text()
      
      // Fix common XML issues in TD feeds
      // First decode any HTML entities that might be double-encoded
      xml = xml.replace(/&amp;/g, '&')
      // Then properly encode all ampersands
      xml = xml.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')
      // Fix unquoted attributes (common in TD feeds)
      xml = xml.replace(/(\w+)=([^"'\s>]+)(?=\s|>)/g, '$1="$2"')
      
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
   * Calculate severity based on content keywords
   */
  private calculateSeverity(item: UnifiedFeedItem): number {
    const content = `${item.title} ${item.body}`.toLowerCase()
    
    if (content.match(/urgent|emergency|severe|critical|immediate|major disruption|suspended/)) {
      return 5
    }
    if (content.match(/disruption|delayed|affected|diverted|closed|suspended/)) {
      return 4
    }
    if (content.match(/temporary|relocation|special traffic|arrangement/)) {
      return 3
    }
    return 2
  }

  /**
   * Calculate relevance score based on content
   */
  private calculateRelevance(item: UnifiedFeedItem): number {
    const now = new Date()
    const hoursSincePublished = (now.getTime() - item.pubDate.getTime()) / (1000 * 60 * 60)
    
    let score = Math.max(0, 1 - (hoursSincePublished / 168)) // 7 days decay
    
    const content = `${item.title} ${item.body}`.toLowerCase()
    if (content.match(/urgent|emergency|severe/)) {
      score = Math.min(1, score + 0.3)
    }
    
    return Math.round(score * 100) / 100
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
}

// Export singleton instance getter
let instance: UnifiedGovernmentFeedsV2 | null = null

export function getUnifiedFeedsV2(): UnifiedGovernmentFeedsV2 {
  if (!instance) {
    instance = new UnifiedGovernmentFeedsV2()
  }
  return instance
}