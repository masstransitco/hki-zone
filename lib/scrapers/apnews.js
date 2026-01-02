/**
 * AP News Scraper
 *
 * Uses AP News RSS feeds for article discovery and HTML scraping for content extraction.
 * Focus: Asia-Pacific news with Hong Kong/China relevance
 */

const HDRS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/rss+xml, application/xml, text/xml, */*',
}

// AP News RSS feeds for Asia coverage
const RSS_FEEDS = [
  'https://rsshub.app/apnews/topics/asia-pacific', // Asia-Pacific news
  'https://rsshub.app/apnews/topics/china',        // China-specific
]

/**
 * Parse RSS feed and extract article metadata
 */
async function fromRSS() {
  const articles = []
  const seenUrls = new Set()

  for (const feedUrl of RSS_FEEDS) {
    try {
      console.log(`AP News: Fetching ${feedUrl}`)

      const response = await fetch(feedUrl, {
        headers: HDRS,
        signal: AbortSignal.timeout(15000),
      })

      if (!response.ok) {
        console.warn(`AP News: Feed ${feedUrl} returned ${response.status}`)
        continue
      }

      const xml = await response.text()

      // Extract items from RSS
      const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/gi) || []

      for (const item of itemMatches) {
        // Extract title
        const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) ||
                           item.match(/<title>([\s\S]*?)<\/title>/i)
        const title = titleMatch ? titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : ''

        // Extract link
        const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/i) ||
                          item.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)
        let url = linkMatch ? linkMatch[1].trim() : ''

        // Skip if already seen
        if (!url || seenUrls.has(url)) continue
        seenUrls.add(url)

        // Extract description
        const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) ||
                          item.match(/<description>([\s\S]*?)<\/description>/i)
        let description = descMatch ? descMatch[1].trim() : ''
        // Clean HTML from description
        description = description.replace(/<[^>]*>/g, '').trim()

        // Extract pubDate
        const dateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)
        const pubDate = dateMatch ? new Date(dateMatch[1].trim()).toISOString() : ''

        // Extract media/enclosure image
        const mediaMatch = item.match(/<media:content[^>]*url="([^"]+)"/i) ||
                           item.match(/<enclosure[^>]*url="([^"]+)"/i) ||
                           item.match(/<media:thumbnail[^>]*url="([^"]+)"/i)
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

      await new Promise(resolve => setTimeout(resolve, 300))
    } catch (error) {
      console.warn(`AP News: Failed to fetch ${feedUrl}:`, error.message)
    }
  }

  console.log(`AP News: Found ${articles.length} articles from RSS feeds`)
  return articles
}

/**
 * Scrape directly from AP News website HTML
 */
async function fromHTML() {
  const articles = []
  const seenUrls = new Set()

  const sectionUrls = [
    'https://apnews.com/hub/asia-pacific',
    'https://apnews.com/hub/china',
  ]

  for (const sectionUrl of sectionUrls) {
    try {
      console.log(`AP News: Fetching section ${sectionUrl}`)

      const response = await fetch(sectionUrl, {
        headers: {
          ...HDRS,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      })

      if (!response.ok) {
        console.warn(`AP News: Section ${sectionUrl} returned ${response.status}`)
        continue
      }

      const html = await response.text()

      // Pattern 1: Full AP article URLs embedded in page
      // Format: apnews.com/article/topic-topic-hash
      const fullUrlPattern = /apnews\.com\/article\/([a-z0-9-]+)/gi
      let match
      while ((match = fullUrlPattern.exec(html)) !== null) {
        const slug = match[1]
        // Skip very short slugs (probably not real articles)
        if (slug.length < 20) continue

        const url = `https://apnews.com/article/${slug}`

        if (!seenUrls.has(url)) {
          seenUrls.add(url)

          // Try to extract title from surrounding context
          // AP often has format: href="...">Title</a>
          const titleContext = html.substring(Math.max(0, match.index - 200), match.index + match[0].length + 300)
          const titleMatch = titleContext.match(/>([^<]{20,200})<\/a>/i)
          const title = titleMatch ? titleMatch[1].trim() : ''

          articles.push({
            title,
            url,
            description: '',
            pubDate: '',
            imageUrl: '',
          })
        }
      }

      // Pattern 2: Relative article links
      const relativePattern = /href="(\/article\/[a-z0-9-]+)"/gi
      while ((match = relativePattern.exec(html)) !== null) {
        const path = match[1]
        const url = `https://apnews.com${path}`

        if (!seenUrls.has(url)) {
          seenUrls.add(url)
          articles.push({
            title: '',
            url,
            description: '',
            pubDate: '',
            imageUrl: '',
          })
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      console.warn(`AP News: Failed to fetch section:`, error.message)
    }
  }

  console.log(`AP News: Found ${articles.length} article URLs from HTML`)
  return articles.slice(0, 20)
}

/**
 * Extract full article content from AP News article page
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

    // Extract title
    let title = ''
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    if (titleMatch) {
      title = titleMatch[1].replace(/<[^>]*>/g, '').trim()
    }

    // Try JSON-LD first
    let content = ''
    let author = 'AP News'
    let imageUrl = ''

    const jsonLdMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || []
    for (const match of jsonLdMatches) {
      try {
        const jsonStr = match.replace(/<\/?script[^>]*>/gi, '')
        const ld = JSON.parse(jsonStr)

        if (ld['@type'] === 'NewsArticle' || ld['@type'] === 'Article') {
          content = ld.articleBody || ''
          if (ld.author) {
            if (Array.isArray(ld.author)) {
              author = ld.author.map(a => a.name || a).join(', ') || 'AP News'
            } else {
              author = ld.author.name || ld.author || 'AP News'
            }
          }
          imageUrl = ld.image?.url || (Array.isArray(ld.image) ? ld.image[0]?.url || ld.image[0] : '') || ''
          break
        }
      } catch (e) {
        // Continue
      }
    }

    // Fallback: Extract from HTML
    if (!content || content.length < 100) {
      const cleanHtml = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')

      const paragraphs = []
      const seenText = new Set()

      // Extract all paragraphs that look like article content
      const allPMatches = cleanHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []
      for (const p of allPMatches) {
        let text = p.replace(/<[^>]*>/g, '').trim()

        // Skip duplicates
        if (seenText.has(text)) continue
        seenText.add(text)

        // Skip if too short or junk
        if (text.length < 50) continue
        if (isJunkContent(text)) continue

        // Skip copyright lines
        if (text.includes('Copyright') && text.includes('Associated Press')) continue

        // Skip image captions (often have via AP or similar)
        if (text.match(/\(.*via AP\)$/i)) continue
        if (text.match(/\(AP Photo.*\)$/i)) continue

        // Skip navigation-like text
        if (text.match(/^(Menu|SECTIONS|Sign in|Subscribe|Read more|Related)/i)) continue

        // Must have sentence structure (periods)
        if (!text.includes('.')) continue

        paragraphs.push(text)
      }

      if (paragraphs.length > 0) {
        content = paragraphs.join('\n\n')
      }
    }

    // Get OG image if not found
    if (!imageUrl) {
      const ogMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
      imageUrl = ogMatch ? ogMatch[1] : ''
    }

    // Get title from og:title if not found
    if (!title) {
      const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)
      title = ogTitleMatch ? ogTitleMatch[1].replace(/\s*[|-]\s*AP News$/i, '').trim() : ''
    }

    return {
      title,
      content,
      author,
      imageUrl,
    }
  } catch (error) {
    console.error(`AP News: Failed to extract content from ${url}:`, error.message)
    return null
  }
}

/**
 * Filter out junk content
 */
function isJunkContent(text) {
  const junkPatterns = [
    /^Share$/i,
    /Share\s*Facebook/i,
    /^Read more$/i,
    /^Related/i,
    /^Subscribe/i,
    /^Sign up/i,
    /^Follow/i,
    /^Advertisement/i,
    /^Copyright/i,
    /^AP\s/i,
    /^\(AP\)/i,
    /^Associated Press/i,
    /^FILE\s*[-–]/i,
    /^Caption/i,
    /^Image/i,
    /^Photo/i,
    /^Video/i,
    /^Audio/i,
    /^Download/i,
    /^Print/i,
    /^Email$/i,
    /^Tweet$/i,
    /^Facebook$/i,
    /^LinkedIn$/i,
    /Add AP News/i,
    /preferred source/i,
    /Google$/i,
    /see more of our stories/i,
    /^Produced by/i,
  ]

  for (const pattern of junkPatterns) {
    if (pattern.test(text)) return true
  }

  // Additional checks for social sharing / navigation UI
  if (text.match(/\bShare\b/i) && text.match(/\bFacebook\b/i)) return true
  if (text.match(/\bShare\b/i) && text.match(/\bTwitter\b/i)) return true

  return false
}

/**
 * Main scraper function - gets articles with full content
 */
async function scrapeAPNewsWithContent() {
  // HTML scraping works better - RSS feeds are blocked
  let headlines = await fromHTML()

  if (headlines.length === 0) {
    console.log('AP News: HTML failed, trying RSS fallback...')
    headlines = await fromRSS()
  }

  const articles = []

  for (const headline of headlines.slice(0, 15)) {
    console.log(`AP News: Extracting content from ${headline.url}`)

    const extracted = await extractArticleContent(headline.url)

    if (extracted && extracted.content && extracted.content.length > 100) {
      articles.push({
        source: 'apnews',
        url: headline.url,
        headline: extracted.title || headline.title,
        date: headline.pubDate || new Date().toISOString(),
        body: extracted.content,
        coverImg: extracted.imageUrl || headline.imageUrl || '',
        author: extracted.author,
      })
    } else if (headline.title && headline.description) {
      // Fallback with RSS data
      articles.push({
        source: 'apnews',
        url: headline.url,
        headline: headline.title,
        date: headline.pubDate || new Date().toISOString(),
        body: headline.description,
        coverImg: headline.imageUrl || '',
        author: 'AP News',
      })
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 800))
  }

  console.log(`AP News: Successfully scraped ${articles.length} articles`)
  return articles
}

module.exports = {
  fromRSS,
  fromHTML,
  extractArticleContent,
  scrapeAPNewsWithContent,
}
