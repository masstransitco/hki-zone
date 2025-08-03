import { createClient, SupabaseClient } from '@supabase/supabase-js'
import Parser from 'rss-parser'
import { createHash } from 'crypto'

interface RSSFeedItem {
  guid: string
  title: string
  link: string
  pubDate: Date
  description?: string
  'content:encoded'?: string
}

interface FeedSource {
  id: string
  feed_group: string
  department: string
  feed_type: string
  urls: Record<string, string>
  scraping_config: {
    enabled: boolean
    frequency_minutes: number
    priority_boost: number
    content_selectors?: {
      title: string
      body: string
    }
    url_patterns?: {
      notice_id_regex: string
      language_url_map: Record<string, string>
    }
  }
  active: boolean
}

interface GroupedSignal {
  noticeId: string
  feedGroup: string
  category: string
  publishedAt: Date
  languages: Record<string, {
    title: string
    body: string
    link: string
    guid: string
  }>
  urls: Record<string, string>
}

export class GovernmentSignalsAggregator {
  private parser: Parser
  private supabase: SupabaseClient

  constructor() {
    this.parser = new Parser({
      timeout: 10000, // Reduced to 10 seconds
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HKI-Zone-Signals/2.0)',
      },
      customFields: {
        item: ['description', 'content:encoded', 'link', 'guid', 'pubDate']
      }
    })
    
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  /**
   * Main processing method - fetches and aggregates all feeds
   */
  async processAllFeeds(): Promise<{
    processed: number
    grouped: number
    stored: number
    errors: string[]
  }> {
    console.log('🚀 Starting Government Signals Aggregation V3...')
    
    const { data: feedSources, error } = await this.supabase
      .from('government_feed_sources')
      .select('*')
      .eq('active', true)
      .in('feed_group', ['td_notices', 'td_press']) // Check both td_notices and td_press
    
    if (error || !feedSources) {
      console.error('❌ Error fetching feed sources:', error)
      return { processed: 0, grouped: 0, stored: 0, errors: [error?.message || 'No feed sources'] }
    }

    console.log(`📡 Found ${feedSources.length} active feed sources`)
    
    const allRawItems: Array<{item: RSSFeedItem, language: string, feedSource: FeedSource}> = []
    const errors: string[] = []
    
    // Step 1: Fetch all feeds in parallel (by feed group, not individual URLs)
    const feedGroups = this.groupFeedsByGroup(feedSources)
    
    for (const [feedGroup, sources] of feedGroups) {
      console.log(`📥 Processing feed group: ${feedGroup}`)
      
      try {
        const groupItems = await this.fetchFeedGroup(sources)
        allRawItems.push(...groupItems)
        console.log(`   ✅ ${groupItems.length} items fetched`)
      } catch (error) {
        const errorMsg = `Feed group ${feedGroup}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(`   ❌ ${errorMsg}`)
        errors.push(errorMsg)
      }
    }
    
    console.log(`📊 Total raw items fetched: ${allRawItems.length}`)
    
    // Step 2: Group items by notice ID to eliminate duplicates
    const groupedSignals = this.groupItemsByNoticeId(allRawItems)
    console.log(`🔗 Grouped into ${groupedSignals.length} unique signals`)
    
    // Step 3: Store grouped signals atomically
    const storedCount = await this.storeGroupedSignals(groupedSignals)
    console.log(`💾 Stored ${storedCount} signals to database`)
    
    return {
      processed: allRawItems.length,
      grouped: groupedSignals.length,
      stored: storedCount,
      errors
    }
  }

  /**
   * Group feed sources by feed_group for parallel processing
   */
  private groupFeedsByGroup(feedSources: FeedSource[]): Map<string, FeedSource[]> {
    const grouped = new Map<string, FeedSource[]>()
    
    for (const source of feedSources) {
      if (!grouped.has(source.feed_group)) {
        grouped.set(source.feed_group, [])
      }
      grouped.get(source.feed_group)!.push(source)
    }
    
    return grouped
  }

  /**
   * Fetch all language variants for a feed group in parallel
   */
  private async fetchFeedGroup(sources: FeedSource[]): Promise<Array<{
    item: RSSFeedItem, 
    language: string, 
    feedSource: FeedSource
  }>> {
    const results: Array<{item: RSSFeedItem, language: string, feedSource: FeedSource}> = []
    
    // Process all sources in this group (should be the same feed group)
    const source = sources[0] // All sources in group should have same config
    const fetchPromises: Promise<void>[] = []
    
    // Check if this is an XML data feed (Transport Department feeds)
    if (source.scraping_config.xml_data_format && source.urls.multilingual) {
      fetchPromises.push(
        this.fetchXMLDataFeed(source.urls.multilingual, source)
          .then(items => {
            results.push(...items)
          })
          .catch(error => {
            console.error(`     ❌ XML data feed failed:`, error.message)
          })
      )
    } else {
      // Regular RSS feeds
      for (const [language, url] of Object.entries(source.urls)) {
        fetchPromises.push(
          this.fetchSingleFeed(url, language, source)
            .then(items => {
              results.push(...items.map(item => ({ item, language, feedSource: source })))
            })
            .catch(error => {
              console.error(`     ❌ ${language} feed failed:`, error.message)
            })
        )
      }
    }
    
    await Promise.allSettled(fetchPromises)
    return results
  }

  /**
   * Fetch XML data feed (Transport Department format) and convert to RSS-like items
   */
  private async fetchXMLDataFeed(url: string, source: FeedSource): Promise<Array<{
    item: RSSFeedItem,
    language: string,
    feedSource: FeedSource
  }>> {
    console.log(`     📡 Fetching XML data: ${url}`)
    
    try {
      const response = await fetch(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HKI-Zone-Signals/2.0)',
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const xmlText = await response.text()
      const results: Array<{item: RSSFeedItem, language: string, feedSource: FeedSource}> = []
      
      // Parse XML manually (simple approach for Transport Department format)
      const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/g) || []
      
      for (const itemXml of itemMatches) {
        // Extract multilingual content
        const titleEN = this.extractXMLField(itemXml, 'Title_EN') || ''
        const titleTC = this.extractXMLField(itemXml, 'Title_TC') || ''
        const titleSC = this.extractXMLField(itemXml, 'Title_SC') || ''
        const detailEN = this.extractXMLField(itemXml, 'Detail_EN') || ''
        const detailTC = this.extractXMLField(itemXml, 'Detail_TC') || ''
        const detailSC = this.extractXMLField(itemXml, 'Detail_SC') || ''
        const link = this.extractXMLField(itemXml, 'Link') || ''
        const pubDate = this.extractXMLField(itemXml, 'PublicationDate') || new Date().toISOString()
        
        // Create items for each language
        if (titleEN.trim()) {
          results.push({
            item: {
              guid: `${source.feed_group}_${createHash('md5').update(titleEN + link).digest('hex').substr(0, 8)}`,
              title: this.cleanText(titleEN),
              link: link,
              pubDate: new Date(pubDate),
              description: this.cleanText(detailEN),
              'content:encoded': this.cleanText(detailEN)
            },
            language: 'en',
            feedSource: source
          })
        }
        
        if (titleTC.trim()) {
          results.push({
            item: {
              guid: `${source.feed_group}_${createHash('md5').update(titleTC + link).digest('hex').substr(0, 8)}`,
              title: this.cleanText(titleTC),
              link: link,
              pubDate: new Date(pubDate),
              description: this.cleanText(detailTC),
              'content:encoded': this.cleanText(detailTC)
            },
            language: 'zh-TW',
            feedSource: source
          })
        }
        
        if (titleSC.trim()) {
          results.push({
            item: {
              guid: `${source.feed_group}_${createHash('md5').update(titleSC + link).digest('hex').substr(0, 8)}`,
              title: this.cleanText(titleSC),
              link: link,
              pubDate: new Date(pubDate),
              description: this.cleanText(detailSC),
              'content:encoded': this.cleanText(detailSC)
            },
            language: 'zh-CN',
            feedSource: source
          })
        }
      }
      
      // Update last fetch timestamp
      await this.supabase
        .from('government_feed_sources')
        .update({ 
          last_successful_fetch: new Date().toISOString(),
          fetch_error_count: 0 
        })
        .eq('id', source.id)
      
      console.log(`     ✅ Parsed ${itemMatches.length} XML items into ${results.length} language variants`)
      return results
      
    } catch (error) {
      // Update error count
      await this.supabase
        .from('government_feed_sources')
        .update({ 
          last_fetch_attempt: new Date().toISOString(),
          fetch_error_count: (source.scraping_config.frequency_minutes || 0) + 1 
        })
        .eq('id', source.id)
      
      throw error
    }
  }

  /**
   * Extract field from XML string
   */
  private extractXMLField(xmlString: string, fieldName: string): string | null {
    const regex = new RegExp(`<${fieldName}>(.*?)<\/${fieldName}>`, 's')
    const match = xmlString.match(regex)
    return match ? match[1].trim() : null
  }

  /**
   * Fetch a single RSS feed and parse items
   */
  private async fetchSingleFeed(url: string, language: string, source: FeedSource): Promise<RSSFeedItem[]> {
    console.log(`     📡 Fetching ${language}: ${url}`)
    
    try {
      const feed = await this.parser.parseURL(url)
      
      // Update last fetch timestamp
      await this.supabase
        .from('government_feed_sources')
        .update({ 
          last_successful_fetch: new Date().toISOString(),
          fetch_error_count: 0 
        })
        .eq('id', source.id)
      
      return feed.items.map(item => ({
        guid: item.guid || item.link || '',
        title: this.cleanText(item.title || ''),
        link: item.link || '',
        pubDate: new Date(item.pubDate || Date.now()),
        description: this.cleanText(item.description || ''),
        'content:encoded': this.cleanText(item['content:encoded'] || '')
      }))
    } catch (error) {
      // Update error count
      await this.supabase
        .from('government_feed_sources')
        .update({ 
          last_fetch_attempt: new Date().toISOString(),
          fetch_error_count: source.scraping_config.frequency_minutes || 0 + 1 
        })
        .eq('id', source.id)
      
      throw error
    }
  }

  /**
   * Group RSS items by notice ID to create unified multilingual signals
   */
  private groupItemsByNoticeId(rawItems: Array<{
    item: RSSFeedItem, 
    language: string, 
    feedSource: FeedSource
  }>): GroupedSignal[] {
    const groupedMap = new Map<string, GroupedSignal>()
    
    for (const { item, language, feedSource } of rawItems) {
      // Extract notice ID using regex pattern from config or intelligent fallback
      const noticeId = this.extractNoticeId(item.link, feedSource, item)
      
      if (!noticeId) {
        console.warn(`⚠️ Could not extract notice ID from: ${item.link} for feed ${feedSource.feed_group}`)
        continue
      }
      
      const groupKey = `${feedSource.feed_group}_${noticeId}`
      
      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, {
          noticeId,
          feedGroup: feedSource.feed_group,
          category: this.mapFeedGroupToCategory(feedSource.feed_group),
          publishedAt: item.pubDate,
          languages: {},
          urls: {}
        })
      }
      
      const signal = groupedMap.get(groupKey)!
      
      // Add this language variant
      signal.languages[language] = {
        title: item.title,
        body: item.description || item['content:encoded'] || '',
        link: item.link,
        guid: item.guid
      }
      
      signal.urls[language] = item.link
      
      // Use earliest publication date
      if (item.pubDate < signal.publishedAt) {
        signal.publishedAt = item.pubDate
      }
    }
    
    return Array.from(groupedMap.values()).filter(signal => {
      // Only include signals that have at least English content
      return signal.languages.en && signal.languages.en.title.trim() !== ''
    })
  }

  /**
   * Extract notice ID from URL using configured regex pattern or intelligent fallback
   */
  private extractNoticeId(url: string, feedSource: FeedSource, item?: RSSFeedItem): string | null {
    const regex = feedSource.scraping_config.url_patterns?.notice_id_regex
    
    // Try regex pattern first
    if (regex) {
      try {
        const match = url.match(new RegExp(regex))
        if (match && match[1]) {
          return match[1]
        }
      } catch (error) {
        console.error(`❌ Invalid regex pattern for ${feedSource.feed_group}: ${regex}`)
      }
    }
    
    // Enhanced fallback logic for different feed types
    if (feedSource.feed_group === 'hko_warnings') {
      // For weather warnings, use a combination of the warning type and timestamp
      const filename = url.split('/').pop()?.replace(/\.(htm|html|xml)$/i, '') || 'warning'
      return filename
    }
    
    if (feedSource.feed_group === 'hkma_press') {
      // For HKMA press releases, extract from the URL or use GUID
      const pathMatch = url.match(/P(\d+)\.htm/) || url.match(/(\w+)\.htm/)
      if (pathMatch) {
        return pathMatch[1]
      }
    }
    
    // Generic fallback: use the last meaningful part of the URL
    const urlParts = url.split('/')
    let filename = urlParts.pop()?.replace(/\.(htm|html|xml|php)$/i, '') || ''
    
    // If filename is too generic, use more of the path
    if (filename.length < 3 || ['index', 'default', 'main'].includes(filename.toLowerCase())) {
      // Use last two parts of path
      const lastTwo = urlParts.slice(-2).join('_') + '_' + filename
      filename = lastTwo.replace(/[^a-zA-Z0-9_]/g, '')
    }
    
    // Final fallback: use content hash of title + URL
    if (!filename || filename.length < 3) {
      const hash = createHash('md5').update(url + (item?.title || '')).digest('hex').substr(0, 8)
      filename = `item_${hash}`
    }
    
    return filename || null
  }

  /**
   * Map feed group to category enum
   */
  private mapFeedGroupToCategory(feedGroup: string): string {
    const categoryMap: Record<string, string> = {
      // Transport - Legacy
      'td_notices': 'transport_notice',
      'td_press': 'transport_press',
      
      // Transport - New XML Data Feeds
      'td_special_traffic': 'transport_notice',
      'td_clearways': 'transport_notice',
      'td_public_transport': 'transport_notice',
      'td_road_closure': 'transport_notice',
      'td_expressways': 'transport_notice',
      
      // Weather/Observatory - Legacy
      'hko_warnings': 'weather_warning',
      'hko_earthquakes': 'weather_earthquake',
      'hko_current_weather': 'weather_warning',
      'hko_forecast': 'weather_warning',
      'hko_special_tips': 'weather_warning',
      
      // Weather/Observatory - New Verified Feeds
      'hko_warnings_v3': 'weather_warning',
      'hko_warning_bulletin': 'weather_warning',
      'hko_earthquakes_quick': 'weather_earthquake',
      'hko_felt_earthquake': 'weather_earthquake',
      'hko_current_v2': 'weather_warning',
      'hko_local_forecast_v2': 'weather_warning',
      'hko_9day_v2': 'weather_warning',
      
      // Monetary Authority
      'hkma_press': 'monetary_press',
      'hkma_circulars': 'monetary_circular',
      'hkma_guidelines': 'monetary_circular',
      
      // Health
      'chp_press': 'health_alert',
      'chp_alerts': 'health_alert',
      'chp_guidelines': 'health_guideline',
      
      // Government News
      'gov_news_main': 'administrative',
      'gov_news_city': 'administrative',
      'gov_news_finance': 'monetary_press',
      'gov_news_business': 'administrative',
      'gov_news_health': 'health_alert',
      'gov_news_infrastructure': 'transport_notice',
      'gov_news_environment': 'environment',
      
      // Other departments
      'hkpf_press': 'police',
      'fsd_press': 'emergency',
      'edb_announcements': 'education',
      'immd_announcements': 'immigration',
      'lands_press': 'lands'
    }
    
    return categoryMap[feedGroup] || 'administrative'
  }

  /**
   * Store grouped signals atomically to prevent duplicates
   */
  private async storeGroupedSignals(groupedSignals: GroupedSignal[]): Promise<number> {
    let storedCount = 0
    
    for (const signal of groupedSignals) {
      try {
        const sourceIdentifier = `${signal.feedGroup}_${signal.noticeId}`
        
        // Build content structure
        const content = {
          meta: {
            notice_id: signal.noticeId,
            urls: signal.urls,
            published_at: signal.publishedAt.toISOString(),
            discovered_at: new Date().toISOString()
          },
          languages: {}
        }
        
        // Add language content with validation
        for (const [lang, langContent] of Object.entries(signal.languages)) {
          if (langContent.title.trim() === '') {
            console.warn(`⚠️ Empty title for ${sourceIdentifier} in ${lang}`)
            continue
          }
          
          const wordCount = this.calculateWordCount(langContent.title + ' ' + langContent.body)
          const contentHash = createHash('sha256')
            .update(langContent.title + langContent.body)
            .digest('hex')
          
          content.languages[lang] = {
            title: langContent.title,
            body: langContent.body,
            scraped_at: new Date().toISOString(),
            content_hash: contentHash,
            word_count: wordCount
          }
        }
        
        // Ensure we have at least English content
        if (!content.languages['en']) {
          console.warn(`⚠️ No English content for ${sourceIdentifier}, skipping`)
          continue
        }
        
        // Calculate base priority
        const basePriority = 50 + (signal.feedGroup === 'td_notices' ? 15 : 0)
        
        // Upsert the signal
        const { error } = await this.supabase
          .from('government_signals')
          .upsert({
            source_identifier: sourceIdentifier,
            feed_group: signal.feedGroup,
            content,
            category: signal.category,
            priority_score: basePriority, // Will be auto-calculated by trigger
            processing_status: this.hasCompleteContent(content) ? 'content_complete' : 'content_partial',
            scraping_attempts: 0
          }, {
            onConflict: 'source_identifier',
            ignoreDuplicates: false
          })
        
        if (error) {
          console.error(`❌ Error storing signal ${sourceIdentifier}:`, error)
        } else {
          storedCount++
          console.log(`   ✅ Stored: ${sourceIdentifier} (${Object.keys(signal.languages).join(', ')})`)
        }
        
      } catch (error) {
        console.error(`❌ Error processing signal ${signal.noticeId}:`, error)
      }
    }
    
    return storedCount
  }

  /**
   * Check if signal has complete content (all expected languages with body text)
   */
  private hasCompleteContent(content: any): boolean {
    const languages = content.languages
    
    // Check if English has both title and body
    const englishComplete = languages.en && 
      languages.en.title.trim() !== '' && 
      languages.en.body.trim() !== ''
    
    return englishComplete
  }

  /**
   * Clean text content from RSS feeds
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
   * Calculate approximate word count
   */
  private calculateWordCount(text: string): number {
    if (!text || text.trim() === '') return 0
    
    // For Chinese text, count characters; for English, count words
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
    const englishWords = text.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(w => w.length > 0).length
    
    return chineseChars + englishWords
  }

  /**
   * Get processing statistics for monitoring
   */
  async getProcessingStatistics(): Promise<{
    totalSignals: number
    byStatus: Record<string, number>
    byFeedGroup: Record<string, number>
    contentCompleteness: {
      complete: number
      partial: number
      english_only: number
    }
  }> {
    const { data: signals, error } = await this.supabase
      .from('government_signals')
      .select('processing_status, feed_group, content')
    
    if (error || !signals) {
      return {
        totalSignals: 0,
        byStatus: {},
        byFeedGroup: {},
        contentCompleteness: { complete: 0, partial: 0, english_only: 0 }
      }
    }
    
    const stats = {
      totalSignals: signals.length,
      byStatus: {} as Record<string, number>,
      byFeedGroup: {} as Record<string, number>,
      contentCompleteness: { complete: 0, partial: 0, english_only: 0 }
    }
    
    for (const signal of signals) {
      // Count by status
      stats.byStatus[signal.processing_status] = (stats.byStatus[signal.processing_status] || 0) + 1
      
      // Count by feed group
      stats.byFeedGroup[signal.feed_group] = (stats.byFeedGroup[signal.feed_group] || 0) + 1
      
      // Analyze content completeness
      const languages = signal.content?.languages || {}
      const hasEnglish = languages.en && languages.en.title && languages.en.body
      const hasOtherLanguages = Object.keys(languages).length > 1
      
      if (hasEnglish && hasOtherLanguages) {
        stats.contentCompleteness.complete++
      } else if (hasEnglish) {
        stats.contentCompleteness.english_only++
      } else {
        stats.contentCompleteness.partial++
      }
    }
    
    return stats
  }
}

// Export singleton instance
let aggregatorInstance: GovernmentSignalsAggregator | null = null

export function getSignalsAggregator(): GovernmentSignalsAggregator {
  if (!aggregatorInstance) {
    aggregatorInstance = new GovernmentSignalsAggregator()
  }
  return aggregatorInstance
}