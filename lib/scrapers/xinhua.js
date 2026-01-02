/**
 * Xinhua News Agency Scraper
 *
 * Uses Xinhua English RSS feeds for article discovery and HTML scraping for content.
 * Focus: Official China news agency - mainland perspective on Hong Kong and Asia
 */

const HDRS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/rss+xml, application/xml, text/xml, */*',
}

// Xinhua English RSS feeds
const RSS_FEEDS = [
  'https://rsshub.app/xinhuanet/english/world',  // World news
  'https://rsshub.app/xinhuanet/english/china',  // China news
  'https://rsshub.app/xinhuanet/english/asia',   // Asia-Pacific
]

// Fallback: Direct Xinhua section URLs
const SECTION_URLS = [
  'https://english.news.cn/world/',
  'https://english.news.cn/china/',
  'https://english.news.cn/asiapacific/',
]

/**
 * Parse RSS feed and extract article metadata
 */
async function fromRSS() {
  const articles = []
  const seenUrls = new Set()

  for (const feedUrl of RSS_FEEDS) {
    try {
      console.log(`Xinhua: Fetching ${feedUrl}`)

      const response = await fetch(feedUrl, {
        headers: HDRS,
        signal: AbortSignal.timeout(15000),
      })

      if (!response.ok) {
        console.warn(`Xinhua: Feed ${feedUrl} returned ${response.status}`)
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

        // Skip if already seen or empty
        if (!url || seenUrls.has(url)) continue
        seenUrls.add(url)

        // Extract description
        const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) ||
                          item.match(/<description>([\s\S]*?)<\/description>/i)
        let description = descMatch ? descMatch[1].trim() : ''
        description = description.replace(/<[^>]*>/g, '').trim()

        // Extract pubDate
        const dateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)
        const pubDate = dateMatch ? new Date(dateMatch[1].trim()).toISOString() : ''

        // Extract image
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
      console.warn(`Xinhua: Failed to fetch ${feedUrl}:`, error.message)
    }
  }

  console.log(`Xinhua: Found ${articles.length} articles from RSS feeds`)
  return articles
}

/**
 * Scrape directly from Xinhua website HTML
 */
async function fromHTML() {
  const articles = []
  const seenUrls = new Set()

  for (const sectionUrl of SECTION_URLS) {
    try {
      console.log(`Xinhua: Fetching section ${sectionUrl}`)

      const response = await fetch(sectionUrl, {
        headers: {
          ...HDRS,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      })

      if (!response.ok) {
        console.warn(`Xinhua: Section ${sectionUrl} returned ${response.status}`)
        continue
      }

      const html = await response.text()

      // Extract base path for relative URLs
      const basePath = sectionUrl.replace(/\/[^/]*$/, '')

      // Pattern 1: Full URLs like https://english.news.cn/20260101/xxx/c.html
      const fullUrlPattern = /href="(https?:\/\/english\.news\.cn\/\d{8}\/[a-f0-9]+\/c\.html)"/gi
      let match
      while ((match = fullUrlPattern.exec(html)) !== null) {
        const url = match[1]
        if (!seenUrls.has(url)) {
          seenUrls.add(url)
          articles.push({ title: '', url, description: '', pubDate: '', imageUrl: '' })
        }
      }

      // Pattern 2: Relative URLs like ../20260102/xxx/c.html or ../asiapacific/20260102/xxx/c.html
      const relativePattern = /href="\.\.\/([^"]+\/\d{8}\/[a-f0-9]+\/c\.html)"/gi
      while ((match = relativePattern.exec(html)) !== null) {
        const url = `https://english.news.cn/${match[1]}`
        if (!seenUrls.has(url)) {
          seenUrls.add(url)
          articles.push({ title: '', url, description: '', pubDate: '', imageUrl: '' })
        }
      }

      // Pattern 3: Section-relative URLs like 20260102/xxx/c.html
      const sectionRelPattern = /href="(\d{8}\/[a-f0-9]+\/c\.html)"/gi
      while ((match = sectionRelPattern.exec(html)) !== null) {
        const url = `${basePath}/${match[1]}`
        if (!seenUrls.has(url)) {
          seenUrls.add(url)
          articles.push({ title: '', url, description: '', pubDate: '', imageUrl: '' })
        }
      }

      // Also try to extract titles from the same page
      const titlePattern = /<a[^>]*href="([^"]*\/\d{8}\/[a-f0-9]+\/c\.html)"[^>]*>([^<]+)<\/a>/gi
      while ((match = titlePattern.exec(html)) !== null) {
        let url = match[1]
        const title = match[2].trim()

        if (url.startsWith('../')) {
          url = `https://english.news.cn/${url.replace('../', '')}`
        } else if (url.startsWith('/')) {
          url = `https://english.news.cn${url}`
        } else if (!url.startsWith('http')) {
          url = `${basePath}/${url}`
        }

        // Update existing article with title or add new
        const existing = articles.find(a => a.url === url)
        if (existing && !existing.title) {
          existing.title = title
        } else if (!seenUrls.has(url) && title) {
          seenUrls.add(url)
          articles.push({ title, url, description: '', pubDate: '', imageUrl: '' })
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      console.warn(`Xinhua: Failed to fetch section:`, error.message)
    }
  }

  console.log(`Xinhua: Found ${articles.length} article URLs from HTML`)
  return articles.slice(0, 20)
}

/**
 * Extract full article content from Xinhua article page
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
    const titleMatch = html.match(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
                       html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    if (titleMatch) {
      title = titleMatch[1].replace(/<[^>]*>/g, '').trim()
    }

    // Try og:title if not found
    if (!title) {
      const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)
      title = ogTitleMatch ? ogTitleMatch[1].trim() : ''
    }

    let content = ''
    let author = 'Xinhua'
    let imageUrl = ''

    // Clean HTML
    const cleanHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')

    // Extract paragraphs from article body
    const paragraphs = []

    // Strategy 1: Look for article container
    const articleMatch = cleanHtml.match(/<div[^>]*class="[^"]*(?:article|content|detail)[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                         cleanHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i)

    const searchArea = articleMatch ? articleMatch[1] : cleanHtml

    // Find paragraphs
    const pMatches = searchArea.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []
    for (const p of pMatches) {
      const text = p.replace(/<[^>]*>/g, '').trim()
      if (text.length > 30 && !isJunkContent(text)) {
        paragraphs.push(text)
      }
    }

    // Strategy 2: Look for specific Xinhua content divs
    if (paragraphs.length < 3) {
      const contentDivs = cleanHtml.match(/<div[^>]*id="(?:detail|article)"[^>]*>([\s\S]*?)<\/div>/gi) || []
      for (const div of contentDivs) {
        const divParagraphs = div.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []
        for (const p of divParagraphs) {
          const text = p.replace(/<[^>]*>/g, '').trim()
          if (text.length > 30 && !isJunkContent(text) && !paragraphs.includes(text)) {
            paragraphs.push(text)
          }
        }
      }
    }

    content = paragraphs.join('\n\n')

    // Extract author - Xinhua often has editor info
    const authorMatch = cleanHtml.match(/(?:Editor|Author|By):\s*([^<\n]+)/i)
    if (authorMatch) {
      author = authorMatch[1].trim() || 'Xinhua'
    }

    // Extract image - Xinhua uses relative paths, need to construct full URL
    const ogImageMatch = cleanHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
    imageUrl = ogImageMatch ? ogImageMatch[1] : ''

    // Fallback image from article - skip zxcode_ images (QR codes) and logos
    if (!imageUrl || imageUrl.includes('sharelogo')) {
      // Look for real article images (hash-only filenames, not zxcode_ QR codes)
      const imgMatches = searchArea.match(/<img[^>]*src="([^"]+)"[^>]*>/gi) || []
      for (const imgTag of imgMatches) {
        const srcMatch = imgTag.match(/src="([^"]+)"/i)
        if (!srcMatch) continue

        let imgSrc = srcMatch[1]

        // Skip QR codes (zxcode_), logos, icons
        if (imgSrc.includes('zxcode_') || imgSrc.includes('logo') || imgSrc.includes('icon')) {
          continue
        }

        // Handle relative paths - construct full URL from article URL
        if (!imgSrc.startsWith('http')) {
          const urlParts = url.match(/(https?:\/\/[^/]+\/.*\/\d{8}\/[a-f0-9]+)\//)
          if (urlParts) {
            imgSrc = `${urlParts[1]}/${imgSrc.replace(/^\.\//, '')}`
          }
        }

        imageUrl = imgSrc
        break // Use first valid image
      }
    }

    return {
      title,
      content,
      author,
      imageUrl,
    }
  } catch (error) {
    console.error(`Xinhua: Failed to extract content from ${url}:`, error.message)
    return null
  }
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
    /^Advertisement/i,
    /^Copyright/i,
    /^Xinhua$/i,
    /^\(Xinhua\)/i,
    /^Photo:/i,
    /^Video:/i,
    /^Editor:/i,
    /^Source:/i,
    /^Agencies/i,
    /^File photo/i,
    /^Caption/i,
    /^Download/i,
    /^Print$/i,
    /^Email$/i,
    /^Tweet$/i,
    /^Facebook$/i,
    /^WeChat$/i,
    /^Weibo$/i,
    /^\[Photo\]/i,
    /^\[Video\]/i,
  ]

  for (const pattern of junkPatterns) {
    if (pattern.test(text)) return true
  }

  // Filter out credit lines
  if (text.match(/^\(Photo by [^)]+\)$/i)) return true
  if (text.match(/^\(File photo\)$/i)) return true

  return false
}

/**
 * Main scraper function - gets articles with full content
 */
async function scrapeXinhuaWithContent() {
  // HTML scraping works better - RSS feeds are outdated
  let headlines = await fromHTML()

  if (headlines.length === 0) {
    console.log('Xinhua: HTML failed, trying RSS fallback...')
    headlines = await fromRSS()
  }

  const articles = []

  for (const headline of headlines.slice(0, 15)) {
    console.log(`Xinhua: Extracting content from ${headline.url}`)

    const extracted = await extractArticleContent(headline.url)

    if (extracted && extracted.content && extracted.content.length > 100) {
      articles.push({
        source: 'xinhua',
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
        source: 'xinhua',
        url: headline.url,
        headline: headline.title,
        date: headline.pubDate || new Date().toISOString(),
        body: headline.description,
        coverImg: headline.imageUrl || '',
        author: 'Xinhua',
      })
    }

    // Rate limiting - Xinhua can be slow
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.log(`Xinhua: Successfully scraped ${articles.length} articles`)
  return articles
}

module.exports = {
  fromRSS,
  fromHTML,
  extractArticleContent,
  scrapeXinhuaWithContent,
}
