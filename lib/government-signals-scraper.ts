import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'

interface ScrapingTarget {
  id: string
  source_identifier: string
  feed_group: string
  content: any
  scraping_attempts: number
}

interface ScrapingConfig {
  content_selectors?: {
    title: string
    body: string
  }
  url_patterns?: {
    language_url_map: Record<string, string>
  }
}

interface ScrapingResult {
  success: boolean
  title?: string
  body?: string
  error?: string
  scraped_at: Date
}

export class GovernmentSignalsScraper {
  private supabase: SupabaseClient
  private readonly USER_AGENT = 'Mozilla/5.0 (compatible; HKI-Zone-Signals/2.0; +https://hki.zone)'
  private readonly MAX_RETRIES = 3
  private readonly BATCH_SIZE = 3 // Process 3 signals concurrently
  private readonly RATE_LIMIT_MS = 2000 // 2 seconds between batches

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  /**
   * Main method to process signals that need content scraping
   */
  async processIncompleteSignals(maxToProcess: number = 10): Promise<{
    processed: number
    updated: number
    failed: number
    results: Array<{
      source_identifier: string
      languages_processed: string[]
      success: boolean
      error?: string
    }>
  }> {
    console.log('🔍 Starting Government Signals Content Scraping...')
    
    // Find signals that need content scraping
    const targets = await this.findScrapingTargets(maxToProcess)
    
    if (targets.length === 0) {
      console.log('✅ No signals need content scraping')
      return { processed: 0, updated: 0, failed: 0, results: [] }
    }
    
    console.log(`📄 Found ${targets.length} signals needing content scraping`)
    
    const results: Array<{
      source_identifier: string
      languages_processed: string[]
      success: boolean
      error?: string
    }> = []
    
    let processed = 0
    let updated = 0
    let failed = 0
    
    // Process in batches to avoid overwhelming the servers
    const batches = this.chunkArray(targets, this.BATCH_SIZE)
    
    for (const batch of batches) {
      console.log(`🔄 Processing batch of ${batch.length} signals...`)
      
      const batchPromises = batch.map(target => this.processSingleSignal(target))
      const batchResults = await Promise.allSettled(batchPromises)
      
      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i]
        const target = batch[i]
        
        processed++
        
        if (result.status === 'fulfilled') {
          const { success, languagesProcessed, error } = result.value
          
          results.push({
            source_identifier: target.source_identifier,
            languages_processed: languagesProcessed,
            success,
            error
          })
          
          if (success) {
            updated++
            console.log(`   ✅ ${target.source_identifier}: ${languagesProcessed.join(', ')}`)
          } else {
            failed++
            console.log(`   ❌ ${target.source_identifier}: ${error}`)
          }
        } else {
          failed++
          const error = result.reason instanceof Error ? result.reason.message : 'Unknown error'
          console.log(`   ❌ ${target.source_identifier}: ${error}`)
          
          results.push({
            source_identifier: target.source_identifier,
            languages_processed: [],
            success: false,
            error
          })
        }
      }
      
      // Rate limiting between batches
      if (batches.indexOf(batch) < batches.length - 1) {
        await this.sleep(this.RATE_LIMIT_MS)
      }
    }
    
    console.log(`🏁 Scraping complete: ${processed} processed, ${updated} updated, ${failed} failed`)
    
    return { processed, updated, failed, results }
  }

  /**
   * Find signals that need content scraping
   */
  private async findScrapingTargets(limit: number): Promise<ScrapingTarget[]> {
    const { data: signals, error } = await this.supabase
      .from('government_signals')
      .select('id, source_identifier, feed_group, content, scraping_attempts')
      .in('processing_status', ['discovered', 'content_partial'])
      .lt('scraping_attempts', this.MAX_RETRIES)
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) {
      console.error('❌ Error fetching scraping targets:', error)
      return []
    }
    
    return (signals || []).filter(signal => {
      // Check if any language is missing body content
      const languages = signal.content?.languages || {}
      
      for (const [lang, content] of Object.entries(languages)) {
        if (content.title && (!content.body || content.body.trim() === '')) {
          return true
        }
      }
      
      return false
    })
  }

  /**
   * Process a single signal to scrape missing content
   */
  private async processSingleSignal(target: ScrapingTarget): Promise<{
    success: boolean
    languagesProcessed: string[]
    error?: string
  }> {
    try {
      // Get scraping configuration for this feed group
      const config = await this.getScrapingConfig(target.feed_group)
      
      if (!config) {
        throw new Error(`No scraping configuration found for feed group: ${target.feed_group}`)
      }
      
      const languages = target.content?.languages || {}
      const languagesProcessed: string[] = []
      let hasUpdates = false
      let updatedContent = { ...target.content }
      
      // Process each language that needs body content
      for (const [lang, content] of Object.entries(languages)) {
        // Skip if this language already has body content
        if (content.body && content.body.trim() !== '') {
          continue
        }
        
        // Determine URL for this language - check both patterns
        let urlToScrape = content.link
        
        // If no URL in language content, check meta.urls pattern (for multilingual signals)
        if (!urlToScrape && target.content?.meta?.urls) {
          const metaUrls = target.content.meta.urls
          // Map language codes to meta URL keys
          const langKey = lang === 'zh-TW' ? 'zh-TW' : lang === 'zh-CN' ? 'zh-CN' : 'en'
          urlToScrape = metaUrls[langKey] || metaUrls.en
        }
        
        // Skip if no URL available
        if (!urlToScrape) {
          console.warn(`   ⚠️ No URL for language ${lang} in ${target.source_identifier}`)
          continue
        }
        
        console.log(`   🔍 Scraping ${lang} content from: ${urlToScrape}`)
        
        try {
          const scrapingResult = await this.scrapeContent(urlToScrape, config)
          
          if (scrapingResult.success && scrapingResult.body) {
            // Update the content
            updatedContent.languages[lang] = {
              ...content,
              title: scrapingResult.title || content.title,
              body: scrapingResult.body,
              scraped_at: scrapingResult.scraped_at.toISOString(),
              content_hash: this.generateContentHash(
                scrapingResult.title || content.title, 
                scrapingResult.body
              ),
              word_count: this.calculateWordCount(
                (scrapingResult.title || content.title) + ' ' + scrapingResult.body
              )
            }
            
            languagesProcessed.push(lang)
            hasUpdates = true
          } else {
            console.warn(`   ⚠️ Failed to scrape ${lang}: ${scrapingResult.error}`)
          }
        } catch (error) {
          console.error(`   ❌ Error scraping ${lang}:`, error)
        }
        
        // Small delay between language scrapes
        await this.sleep(1000)
      }
      
      // Update the database if we have changes
      if (hasUpdates) {
        const newStatus = this.determineProcessingStatus(updatedContent)
        
        const { error: updateError } = await this.supabase
          .from('government_signals')
          .update({
            content: updatedContent,
            processing_status: newStatus,
            scraping_attempts: target.scraping_attempts + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', target.id)
        
        if (updateError) {
          throw new Error(`Database update failed: ${updateError.message}`)
        }
        
        return {
          success: true,
          languagesProcessed
        }
      } else {
        // Increment scraping attempts even if no content was found
        await this.supabase
          .from('government_signals')
          .update({
            scraping_attempts: target.scraping_attempts + 1
          })
          .eq('id', target.id)
        
        return {
          success: false,
          languagesProcessed: [],
          error: 'No content could be scraped for any language'
        }
      }
      
    } catch (error) {
      // Update scraping attempts on error
      await this.supabase
        .from('government_signals')
        .update({
          scraping_attempts: target.scraping_attempts + 1,
          error_log: [...(target.error_log || []), {
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
            context: 'content_scraping'
          }]
        })
        .eq('id', target.id)
      
      return {
        success: false,
        languagesProcessed: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Scrape content from a single URL
   */
  private async scrapeContent(url: string, config: ScrapingConfig): Promise<ScrapingResult> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8'
        },
        timeout: 30000
      })
      
      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          scraped_at: new Date()
        }
      }
      
      const html = await response.text()
      const $ = cheerio.load(html)
      
      // Extract title using configured selectors
      let title = ''
      if (config.content_selectors?.title) {
        const titleElements = $(config.content_selectors.title)
        title = titleElements.first().text().trim()
      }
      
      // Extract body using configured selectors
      let body = ''
      if (config.content_selectors?.body) {
        const bodyElements = $(config.content_selectors.body)
        
        // Try each selector until we find content
        const selectors = config.content_selectors.body.split(',').map(s => s.trim())
        for (const selector of selectors) {
          const element = $(selector).first()
          if (element.length > 0) {
            body = element.text().trim()
            if (body.length > 50) { // Minimum meaningful content
              break
            }
          }
        }
      }
      
      // Clean the extracted content
      title = this.cleanText(title)
      body = this.cleanText(body)
      
      if (!body || body.length < 20) {
        return {
          success: false,
          error: 'No meaningful body content found',
          scraped_at: new Date()
        }
      }
      
      return {
        success: true,
        title: title || undefined,
        body,
        scraped_at: new Date()
      }
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        scraped_at: new Date()
      }
    }
  }

  /**
   * Get scraping configuration for a feed group
   */
  private async getScrapingConfig(feedGroup: string): Promise<ScrapingConfig | null> {
    const { data: source, error } = await this.supabase
      .from('government_feed_sources')
      .select('scraping_config')
      .eq('feed_group', feedGroup)
      .single()
    
    if (error || !source) {
      return null
    }
    
    return source.scraping_config
  }

  /**
   * Determine processing status based on content completeness
   */
  private determineProcessingStatus(content: any): string {
    const languages = content?.languages || {}
    
    let hasCompleteEnglish = false
    let hasOtherLanguages = false
    let allLanguagesComplete = true
    
    for (const [lang, langContent] of Object.entries(languages)) {
      const hasTitle = langContent.title && langContent.title.trim() !== ''
      const hasBody = langContent.body && langContent.body.trim() !== ''
      const isComplete = hasTitle && hasBody
      
      if (lang === 'en') {
        hasCompleteEnglish = isComplete
      } else {
        hasOtherLanguages = true
        if (!isComplete) {
          allLanguagesComplete = false
        }
      }
    }
    
    if (hasCompleteEnglish && (!hasOtherLanguages || allLanguagesComplete)) {
      return 'content_complete'
    } else if (hasCompleteEnglish) {
      return 'content_partial'
    } else {
      return 'discovered'
    }
  }

  /**
   * Generate content hash for deduplication
   */
  private generateContentHash(title: string, body: string): string {
    const crypto = require('crypto')
    return crypto.createHash('sha256').update(title + body).digest('hex')
  }

  /**
   * Calculate word count (Chinese chars + English words)
   */
  private calculateWordCount(text: string): number {
    if (!text || text.trim() === '') return 0
    
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
    const englishWords = text.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(w => w.length > 0).length
    
    return chineseChars + englishWords
  }

  /**
   * Clean extracted text content
   */
  private cleanText(text: string): string {
    if (!text) return ''
    
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[\r\n\t]/g, ' ') // Replace line breaks with spaces
      .trim()
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Process a specific signal by source identifier (for manual testing)
   */
  async processSingleSignalById(sourceIdentifier: string): Promise<{
    success: boolean
    details: any
    error?: string
  }> {
    try {
      const { data: signal, error } = await this.supabase
        .from('government_signals')
        .select('*')
        .eq('source_identifier', sourceIdentifier)
        .single()
      
      if (error || !signal) {
        return {
          success: false,
          details: {},
          error: 'Signal not found'
        }
      }
      
      const result = await this.processSingleSignal(signal)
      
      return {
        success: result.success,
        details: {
          languages_processed: result.languagesProcessed,
          source_identifier: sourceIdentifier
        },
        error: result.error
      }
      
    } catch (error) {
      return {
        success: false,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get scraping statistics
   */
  async getScrapingStatistics(): Promise<{
    signals_needing_scraping: number
    signals_with_failed_attempts: number
    recent_scraping_activity: any[]
  }> {
    const [needingScraping, failedAttempts, recentActivity] = await Promise.all([
      // Signals needing scraping
      this.supabase
        .from('government_signals')
        .select('id')
        .in('processing_status', ['discovered', 'content_partial'])
        .lt('scraping_attempts', this.MAX_RETRIES),
      
      // Signals with failed attempts
      this.supabase
        .from('government_signals')
        .select('id')
        .gte('scraping_attempts', this.MAX_RETRIES)
        .eq('processing_status', 'content_partial'),
      
      // Recent activity
      this.supabase
        .from('government_signals')
        .select('source_identifier, processing_status, scraping_attempts, updated_at')
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('updated_at', { ascending: false })
        .limit(10)
    ])
    
    return {
      signals_needing_scraping: needingScraping.data?.length || 0,
      signals_with_failed_attempts: failedAttempts.data?.length || 0,
      recent_scraping_activity: recentActivity.data || []
    }
  }
}

// Export singleton instance
let scraperInstance: GovernmentSignalsScraper | null = null

export function getSignalsScraper(): GovernmentSignalsScraper {
  if (!scraperInstance) {
    scraperInstance = new GovernmentSignalsScraper()
  }
  return scraperInstance
}