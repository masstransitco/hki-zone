/**
 * BBC News Asia Scraper
 *
 * Uses BBC RSS feed for article discovery and HTML scraping for content extraction.
 * Focus: Asia news with Hong Kong relevance
 */

const HDRS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/rss+xml, application/xml, text/xml, */*',
}

const RSS_URL = 'https://feeds.bbci.co.uk/news/world/asia/rss.xml'

/**
 * Parse RSS feed and extract article metadata
 */
async function fromRSS() {
  try {
    const response = await fetch(RSS_URL, {
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
      const title = titleMatch ? titleMatch[1].trim() : ''

      // Extract link (remove tracking params)
      const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/i)
      let url = linkMatch ? linkMatch[1].trim() : ''
      url = url.split('?')[0] // Remove tracking params

      // Extract description
      const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) ||
                        item.match(/<description>([\s\S]*?)<\/description>/i)
      const description = descMatch ? descMatch[1].trim() : ''

      // Extract pubDate
      const dateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)
      const pubDate = dateMatch ? new Date(dateMatch[1].trim()).toISOString() : ''

      // Extract media thumbnail
      const mediaMatch = item.match(/<media:thumbnail[^>]*url="([^"]+)"/i)
      const imageUrl = mediaMatch ? mediaMatch[1] : ''

      if (title && url) {
        articles.push({
          title,
          url,
          description,
          pubDate,
          imageUrl,
        })
      }
    }

    console.log(`BBC: Found ${articles.length} articles from RSS`)
    return articles
  } catch (error) {
    console.error('BBC RSS fetch failed:', error.message)
    return []
  }
}

/**
 * Extract full article content from BBC article page
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
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')

    // Extract article body - BBC uses data-component="text-block" for paragraphs
    const paragraphs = []

    // Strategy 1: Look for article text blocks
    const textBlockMatches = cleanHtml.match(/<p[^>]*data-component="text-block"[^>]*>([\s\S]*?)<\/p>/gi) || []
    for (const block of textBlockMatches) {
      const text = block.replace(/<[^>]*>/g, '').trim()
      if (text.length > 20) {
        paragraphs.push(text)
      }
    }

    // Strategy 2: Look for article body paragraphs
    if (paragraphs.length < 3) {
      const articleMatch = cleanHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
      if (articleMatch) {
        const articleParagraphs = articleMatch[1].match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []
        for (const p of articleParagraphs) {
          const text = p.replace(/<[^>]*>/g, '').trim()
          if (text.length > 30 && !isJunkContent(text)) {
            if (!paragraphs.includes(text)) {
              paragraphs.push(text)
            }
          }
        }
      }
    }

    // Strategy 3: General paragraph extraction
    if (paragraphs.length < 3) {
      const allParagraphs = cleanHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []
      for (const p of allParagraphs) {
        const text = p.replace(/<[^>]*>/g, '').trim()
        if (text.length > 50 && !isJunkContent(text)) {
          if (!paragraphs.includes(text)) {
            paragraphs.push(text)
          }
        }
      }
    }

    // Extract author
    const authorMatch = cleanHtml.match(/By\s+<[^>]*>([^<]+)<\/[^>]*>/i) ||
                        cleanHtml.match(/<[^>]*class="[^"]*author[^"]*"[^>]*>([^<]+)<\/[^>]*>/i)
    const author = authorMatch ? authorMatch[1].trim() : 'BBC News'

    // Extract better image if available
    let imageUrl = ''
    const ogImageMatch = cleanHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
    if (ogImageMatch) {
      imageUrl = ogImageMatch[1]
    }

    const content = paragraphs.join('\n\n')

    return {
      content,
      author,
      imageUrl,
    }
  } catch (error) {
    console.error(`BBC: Failed to extract content from ${url}:`, error.message)
    return null
  }
}

/**
 * Filter out junk content
 */
function isJunkContent(text) {
  const junkPatterns = [
    /^Share$/i,
    /^Close$/i,
    /^Menu$/i,
    /^Search BBC$/i,
    /^Sign in$/i,
    /^Register$/i,
    /^More$/i,
    /^Related/i,
    /^Follow us/i,
    /^Subscribe/i,
    /^Advertisement/i,
    /^Copyright/i,
    /^BBC \d{4}/,
    /^Image (source|caption)/i,
    /^Getty Images/i,
    /^Reuters/i,
    /^AFP/i,
    /^PA Media/i,
  ]

  for (const pattern of junkPatterns) {
    if (pattern.test(text)) return true
  }

  return false
}

/**
 * Main scraper function - gets articles with full content
 */
async function scrapeBBCWithContent() {
  const headlines = await fromRSS()
  const articles = []

  for (const headline of headlines.slice(0, 15)) { // Limit to 15 articles
    console.log(`BBC: Extracting content from ${headline.url}`)

    const extracted = await extractArticleContent(headline.url)

    if (extracted && extracted.content && extracted.content.length > 100) {
      articles.push({
        source: 'bbc',
        url: headline.url,
        headline: headline.title,
        date: headline.pubDate,
        body: extracted.content,
        coverImg: extracted.imageUrl || headline.imageUrl || '',
        author: extracted.author,
      })
    } else {
      // Fallback with description only
      articles.push({
        source: 'bbc',
        url: headline.url,
        headline: headline.title,
        date: headline.pubDate,
        body: headline.description,
        coverImg: headline.imageUrl || '',
        author: 'BBC News',
      })
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  console.log(`BBC: Successfully scraped ${articles.length} articles`)
  return articles
}

module.exports = {
  fromRSS,
  extractArticleContent,
  scrapeBBCWithContent,
}
