/**
 * CGTN (China Global Television Network) Scraper
 *
 * Uses CGTN RSS feeds for article discovery.
 * RSS includes full content via content:encoded, reducing need for extra fetches.
 * Focus: China perspective on world/Asia news
 */

const HDRS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/rss+xml, application/xml, text/xml, */*',
}

// Multiple RSS feeds for comprehensive coverage
const RSS_FEEDS = {
  world: 'https://www.cgtn.com/subscribe/rss/section/world.xml',
  china: 'https://www.cgtn.com/subscribe/rss/section/china.xml',
  business: 'https://www.cgtn.com/subscribe/rss/section/business.xml',
}

/**
 * Parse RSS feed and extract articles with content
 */
async function fromRSS(feedUrl) {
  try {
    const response = await fetch(feedUrl, {
      headers: HDRS,
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const xml = await response.text()
    const articles = []

    // Extract items from RSS
    const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/gi) || []

    for (const item of itemMatches) {
      // Extract title
      const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) ||
                         item.match(/<title>([\s\S]*?)<\/title>/i)
      const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : ''

      // Extract link (remove tracking params)
      const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/i)
      let url = linkMatch ? linkMatch[1].trim() : ''
      url = url.split('?')[0]

      // Extract description
      const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) ||
                        item.match(/<description>([\s\S]*?)<\/description>/i)
      const description = descMatch ? decodeEntities(descMatch[1].trim()) : ''

      // Extract content:encoded (full article content)
      const contentMatch = item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/i)
      let fullContent = ''
      if (contentMatch) {
        fullContent = extractTextFromHTML(contentMatch[1])
      }

      // Extract pubDate
      const dateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)
      const pubDate = dateMatch ? new Date(dateMatch[1].trim()).toISOString() : ''

      // Extract media:content image
      const mediaMatch = item.match(/<media:content[^>]*url="([^"]+)"[^>]*medium="image"/i) ||
                         item.match(/<media:content[^>]*medium="image"[^>]*url="([^"]+)"/i)
      let imageUrl = mediaMatch ? mediaMatch[1] : ''

      // Fallback: extract image from content
      if (!imageUrl && contentMatch) {
        const imgMatch = contentMatch[1].match(/<img[^>]*src="([^"]+)"/i)
        if (imgMatch) {
          imageUrl = imgMatch[1]
        }
      }

      if (title && url) {
        articles.push({
          title,
          url,
          description,
          fullContent: fullContent || description,
          pubDate,
          imageUrl,
        })
      }
    }

    return articles
  } catch (error) {
    console.error(`CGTN RSS fetch failed for ${feedUrl}:`, error.message)
    return []
  }
}

/**
 * Extract clean text from HTML content
 */
function extractTextFromHTML(html) {
  // Remove scripts, styles, and other non-content
  let clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '') // Remove figures
    .replace(/<video[^>]*>[\s\S]*?<\/video>/gi, '') // Remove video embeds
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // Extract paragraphs
  const paragraphs = []
  const pMatches = clean.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []

  for (const p of pMatches) {
    const text = p
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (text.length > 20 && !isJunkContent(text)) {
      paragraphs.push(text)
    }
  }

  // If no paragraphs found, try general text extraction
  if (paragraphs.length === 0) {
    const text = clean
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (text.length > 50) {
      return text
    }
  }

  return paragraphs.join('\n\n')
}

/**
 * Decode HTML entities
 */
function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
}

/**
 * Filter out junk content
 */
function isJunkContent(text) {
  const junkPatterns = [
    /^Share$/i,
    /^Read more$/i,
    /^Related/i,
    /^Subscribe/i,
    /^Follow us/i,
    /^Copyright/i,
    /^CGTN/i,
    /^Download/i,
    /^Watch/i,
    /^Click here/i,
  ]

  for (const pattern of junkPatterns) {
    if (pattern.test(text.substring(0, 20))) return true
  }

  return false
}

/**
 * Fetch content from article page if RSS content is insufficient
 */
async function extractArticleContent(url) {
  try {
    const response = await fetch(url, {
      headers: {
        ...HDRS,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const html = await response.text()

    // Clean HTML
    const cleanHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')

    // Extract article content
    const paragraphs = []

    // Look for article body
    const articleMatch = cleanHtml.match(/<div[^>]*class="[^"]*content-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                         cleanHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i)

    if (articleMatch) {
      const pMatches = articleMatch[1].match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []
      for (const p of pMatches) {
        const text = p.replace(/<[^>]*>/g, '').trim()
        if (text.length > 30 && !isJunkContent(text)) {
          paragraphs.push(text)
        }
      }
    }

    // Extract OG image
    const ogImageMatch = cleanHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
    const imageUrl = ogImageMatch ? ogImageMatch[1] : ''

    return {
      content: paragraphs.join('\n\n'),
      imageUrl,
    }
  } catch (error) {
    console.error(`CGTN: Failed to extract content from ${url}:`, error.message)
    return null
  }
}

/**
 * Main scraper function - gets articles from multiple feeds
 */
async function scrapeCGTNWithContent() {
  const allArticles = []
  const seenUrls = new Set()

  // Fetch from all feeds
  for (const [section, feedUrl] of Object.entries(RSS_FEEDS)) {
    console.log(`CGTN: Fetching ${section} feed...`)
    const articles = await fromRSS(feedUrl)

    for (const article of articles) {
      // Skip duplicates
      if (seenUrls.has(article.url)) continue
      seenUrls.add(article.url)

      let content = article.fullContent
      let imageUrl = article.imageUrl

      // If content is too short, fetch from article page
      if (content.length < 200) {
        console.log(`CGTN: Fetching full content for ${article.url}`)
        const extracted = await extractArticleContent(article.url)
        if (extracted && extracted.content) {
          content = extracted.content
          imageUrl = extracted.imageUrl || imageUrl
        }
        // Rate limiting for page fetches
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      if (content && content.length > 50) {
        allArticles.push({
          source: 'cgtn',
          url: article.url,
          headline: article.title,
          date: article.pubDate,
          body: content,
          coverImg: imageUrl || 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800&h=400&fit=crop',
          author: 'CGTN',
        })
      }
    }
  }

  // Limit total articles
  const limited = allArticles.slice(0, 20)
  console.log(`CGTN: Successfully scraped ${limited.length} articles`)
  return limited
}

module.exports = {
  fromRSS,
  extractArticleContent,
  scrapeCGTNWithContent,
}
