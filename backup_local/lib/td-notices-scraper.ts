import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface TDNoticeContent {
  id: string
  url: string
  title: string
  body: string
  scrapedAt: Date
}

export class TDNoticesScraper {
  private readonly USER_AGENT = 'Mozilla/5.0 (compatible; HKI-Bot/1.0; +https://hki.zone)'
  
  /**
   * Scrape content from a TD notice page
   */
  private async scrapeNoticeContent(url: string): Promise<string | null> {
    try {
      console.log(`Scraping TD notice: ${url}`)
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8'
        }
      })
      
      if (!response.ok) {
        console.error(`Failed to fetch ${url}: ${response.status}`)
        return null
      }
      
      const html = await response.text()
      const $ = cheerio.load(html)
      
      // TD notices have a consistent structure with content in div.wrapfield
      const wrapfield = $('.wrapfield').first()
      
      if (wrapfield.length === 0) {
        console.warn(`No .wrapfield found for ${url}`)
        return null
      }
      
      // Remove any script or style tags
      wrapfield.find('script, style').remove()
      
      // Get all paragraphs within wrapfield
      const paragraphs = wrapfield.find('p')
      
      if (paragraphs.length === 0) {
        console.warn(`No paragraphs found in wrapfield for ${url}`)
        return null
      }
      
      // Extract text from paragraphs, preserving line breaks
      const contentParts: string[] = []
      paragraphs.each((i, elem) => {
        const text = $(elem).text().trim()
        if (text && text.length > 0) {
          contentParts.push(text)
        }
      })
      
      if (contentParts.length === 0) {
        console.warn(`No content extracted from ${url}`)
        return null
      }
      
      // Join paragraphs with line breaks
      const content = contentParts.join('\n\n')
      
      console.log(`Successfully scraped ${content.length} characters from ${url}`)
      return content
      
    } catch (error) {
      console.error(`Error scraping ${url}:`, error)
      return null
    }
  }
  
  /**
   * Process TD notices that don't have body content
   */
  async processEmptyNotices() {
    try {
      console.log('Starting TD notices content scraping...')
      
      // Query for all TD notices from the unified incidents table
      const { data: notices, error } = await supabase
        .from('incidents_unified')
        .select(`
          id,
          content,
          feed_id,
          gov_feeds_unified!inner(base_slug, name_en)
        `)
        .eq('gov_feeds_unified.base_slug', 'td_notices')
        .order('source_published_at', { ascending: false })
        .limit(15) // Get more to filter for all languages
      
      if (error) {
        console.error('Error fetching notices:', error)
        return { success: false, error: error.message }
      }
      
      if (!notices || notices.length === 0) {
        console.log('No incidents found')
        return { success: true, processed: 0 }
      }
      
      // Filter for TD notices that need content scraping in any language
      const tdNotices = notices.filter((notice: any) => {
        const enContent = notice.content?.en
        const zhTwContent = notice.content?.['zh-TW']
        const zhCnContent = notice.content?.['zh-CN']
        
        // Include if any language is missing body content
        const needsEnglish = !enContent?.body || enContent.body.trim() === ''
        const needsZhTw = zhTwContent && (!zhTwContent.body || zhTwContent.body.trim() === '')
        const needsZhCn = zhCnContent && (!zhCnContent.body || zhCnContent.body.trim() === '')
        
        return needsEnglish || needsZhTw || needsZhCn
      }).slice(0, 5) // Process up to 5 notices at a time to avoid timeouts
      
      if (tdNotices.length === 0) {
        console.log('No TD notices need content scraping')
        return { success: true, processed: 0 }
      }
      
      console.log(`Found ${tdNotices.length} TD notices to scrape`)
      
      const results: TDNoticeContent[] = []
      const updates = []
      
      // Process each notice for all available languages
      for (const notice of tdNotices) {
        console.log(`Processing notice ${notice.id}`)
        
        let updatedContent = { ...notice.content }
        let hasUpdates = false
        
        // Languages to process (check which ones exist in content)
        const languagesToProcess = []
        if (notice.content?.en) languagesToProcess.push({ key: 'en', lang: 'en' })
        if (notice.content?.['zh-TW']) languagesToProcess.push({ key: 'zh-TW', lang: 'tc' })
        if (notice.content?.['zh-CN']) languagesToProcess.push({ key: 'zh-CN', lang: 'sc' })
        
        for (const { key: langKey, lang: urlLang } of languagesToProcess) {
          const langContent = notice.content[langKey]
          
          // Skip if this language already has body content
          if (langContent?.body && langContent.body.trim() !== '') {
            console.log(`Language ${langKey} already has content, skipping`)
            continue
          }
          
          // Get URL for this language
          const url = langContent?.link
          if (!url) {
            console.log(`No URL found for language ${langKey} in notice ${notice.id}`)
            continue
          }
          
          // Convert URL to appropriate language version
          const langUrl = urlLang === 'en' ? url : url.replace('/en/', `/${urlLang}/`)
          
          console.log(`Scraping ${langKey} content from: ${langUrl}`)
          
          // Add delay to be respectful to the server
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          const content = await this.scrapeNoticeContent(langUrl)
          
          if (content) {
            updatedContent[langKey] = {
              ...langContent,
              body: content
            }
            hasUpdates = true
            
            results.push({
              id: notice.id,
              url: langUrl,
              title: langContent?.title || 'Unknown title',
              body: content,
              scrapedAt: new Date()
            })
            
            console.log(`Successfully scraped ${langKey} content (${content.length} chars)`)
          } else {
            console.log(`Failed to scrape ${langKey} content from ${langUrl}`)
          }
        }
        
        // Add to updates if we scraped any content
        if (hasUpdates) {
          updates.push({
            id: notice.id,
            content: updatedContent,
            last_scraped_at: new Date().toISOString()
          })
        }
      }
      
      // Update the database with scraped content
      if (updates.length > 0) {
        // Update each notice individually in the unified table
        for (const update of updates) {
          const { error: updateError } = await supabase
            .from('incidents_unified')
            .update({
              content: update.content,
              updated_at: new Date().toISOString()
            })
            .eq('id', update.id)
          
          if (updateError) {
            console.error(`Error updating notice ${update.id}:`, updateError)
            return { success: false, error: updateError.message }
          }
        }
        
        console.log(`Successfully updated ${updates.length} TD notices with content`)
      }
      
      return {
        success: true,
        processed: tdNotices.length,
        updated: updates.length,
        results
      }
      
    } catch (error) {
      console.error('Error in processEmptyNotices:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  /**
   * Process a single notice by ID (for testing or manual processing)
   */
  async processSingleNotice(noticeId: string) {
    try {
      // Query single notice from unified table
      const { data: notice, error } = await supabase
        .from('incidents_unified')
        .select(`
          id,
          content,
          feed_id,
          gov_feeds_unified!inner(base_slug, name_en)
        `)
        .eq('id', noticeId)
        .single()
      
      if (error || !notice) {
        return { success: false, error: 'Notice not found' }
      }
      
      const url = notice.content?.en?.link
      if (!url) {
        return { success: false, error: 'Notice has no URL' }
      }
      
      const title = notice.content?.en?.title || 'Unknown title'
      const content = await this.scrapeNoticeContent(url)
      
      if (content) {
        // Update the unified content structure
        const updatedContent = {
          ...notice.content,
          en: {
            ...notice.content?.en,
            body: content
          }
        }
        
        const { error: updateError } = await supabase
          .from('incidents_unified')
          .update({
            content: updatedContent,
            updated_at: new Date().toISOString()
          })
          .eq('id', noticeId)
        
        if (updateError) {
          return { success: false, error: updateError.message }
        }
        
        return {
          success: true,
          notice: {
            id: notice.id,
            title: title,
            body: content
          }
        }
      }
      
      return { success: false, error: 'No content found' }
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

// Export singleton instance
export const tdNoticesScraper = new TDNoticesScraper()