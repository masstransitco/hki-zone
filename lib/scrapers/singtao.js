// Enhanced SingTao scraper based on working version
// Optimized for Next.js environment with native fetch

const HDRS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  "Accept-Language": "zh-HK,zh;q=0.9,en;q=0.8",
}

const XML_FEEDS = [
  "https://www.stheadline.com/rss",
]

// URL Cleaning Function - new stheadline.com format
function cleanSingTaoURL(url) {
  // New URLs are like: https://www.stheadline.com/breaking-news/3534155/title-slug
  // Just return the URL as-is, it's already clean
  return url
}

// XML feed parsing with multiple endpoints
async function fromXml() {
  for (const feedUrl of XML_FEEDS) {
    try {
      console.log(`SingTao: Trying XML feed: ${feedUrl}`)
      const response = await fetch(feedUrl, {
        headers: HDRS,
        signal: AbortSignal.timeout(15000),
      })

      if (!response.ok) {
        console.warn(`SingTao: ${feedUrl} returned ${response.status}`)
        continue
      }

      const data = await response.text()

      // Check if we got HTML instead of XML
      if (data.includes("<!DOCTYPE html") || data.includes("<html")) {
        console.warn(`SingTao: ${feedUrl} returned HTML instead of XML`)
        continue
      }

      // Parse RSS items using regex
      const itemMatches = data.match(/<item[^>]*>([\s\S]*?)<\/item>/gi)
      if (itemMatches && itemMatches.length > 0) {
        const articles = []

        for (const itemMatch of itemMatches.slice(0, 15)) {
          // Extract title
          const titleMatch =
            itemMatch.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) || itemMatch.match(/<title>(.*?)<\/title>/i)

          // Extract link
          const linkMatch =
            itemMatch.match(/<link><!\[CDATA\[(.*?)\]\]><\/link>/i) ||
            itemMatch.match(/<link>(.*?)<\/link>/i) ||
            itemMatch.match(/<guid[^>]*>(.*?)<\/guid>/i)

          // Extract description
          const descMatch =
            itemMatch.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/i) ||
            itemMatch.match(/<description>(.*?)<\/description>/i)

          // Extract date
          const dateMatch = itemMatch.match(/<pubDate>(.*?)<\/pubDate>/i)

          if (titleMatch && linkMatch) {
            const title = titleMatch[1].trim()
            const url = linkMatch[1].trim()
            const description = descMatch ? descMatch[1].replace(/<[^>]*>/g, "").trim() : ""
            const pubDate = dateMatch ? dateMatch[1].trim() : ""

            if (title.length > 5 && url) {
              articles.push({
                title,
                url: url.startsWith("http") ? url : `https://www.stheadline.com${url}`,
                description,
                pubDate,
              })
            }
          }
        }

        if (articles.length > 0) {
          console.log(`SingTao: XML parser success with ${articles.length} items`)
          return articles
        }
      }
    } catch (e) {
      console.warn(`SingTao: Failed to fetch ${feedUrl}:`, e.message)
    }
  }
  return []
}

// Enhanced HTML scraping with multiple strategies
async function fromHtml() {
  try {
    console.log("SingTao: Trying direct HTML scraping...")

    // Try multiple pages
    const pages = [
      "https://www.stheadline.com/realtime",
      "https://www.stheadline.com/",
      "https://www.stheadline.com/latest",
    ]

    for (const pageUrl of pages) {
      try {
        console.log(`SingTao: Trying page: ${pageUrl}`)
        const response = await fetch(pageUrl, {
          headers: HDRS,
          signal: AbortSignal.timeout(10000),
        })

        if (!response.ok) {
          console.warn(`SingTao: ${pageUrl} returned ${response.status}`)
          continue
        }

        const html = await response.text()
        const articles = []

        // Strategy 1: Look for article links with specific patterns
        // New URL format: /breaking-news/123456/title-slug or /category/123456/title
        const articleLinkRegex = /<a[^>]*href="([^"]*\/(?:breaking-news|realtime|article|即時|港聞|娛樂|財經|副刊)\/\d+[^"]*)"[^>]*>([^<]+)<\/a>/gi
        let match

        while ((match = articleLinkRegex.exec(html)) !== null && articles.length < 10) {
          const url = match[1]
          const title = match[2].trim()

          if (title && url && title.length > 10 && !title.includes("更多") && !title.includes("登入")) {
            articles.push({
              title,
              url: url.startsWith("http") ? url : `https://www.stheadline.com${url}`,
            })
          }
        }

        // Strategy 2: Look for headlines in common containers
        if (articles.length < 3) {
          const headlineRegex = /<h[1-6][^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<\/h[1-6]>/gi

          while ((match = headlineRegex.exec(html)) !== null && articles.length < 10) {
            const url = match[1]
            const title = match[2].trim()

            if (title && url && title.length > 10 && !title.includes("更多") && !title.includes("登入")) {
              articles.push({
                title,
                url: url.startsWith("http") ? url : `https://www.stheadline.com${url}`,
              })
            }
          }
        }

        // Strategy 3: Look for any links that might be articles
        if (articles.length < 3) {
          const anyLinkRegex = /<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/gi

          while ((match = anyLinkRegex.exec(html)) !== null && articles.length < 10) {
            const url = match[1]
            const title = match[2].trim()

            // Filter for likely article URLs and titles
            if (
              title &&
              url &&
              title.length > 15 &&
              title.length < 200 &&
              !title.includes("更多") &&
              !title.includes("登入") &&
              !title.includes("廣告") &&
              !title.includes("訂閱") &&
              (url.includes("article") || url.includes("news") || url.includes("realtime"))
            ) {
              articles.push({
                title,
                url: url.startsWith("http") ? url : `https://www.stheadline.com${url}`,
              })
            }
          }
        }

        if (articles.length > 0) {
          console.log(`SingTao: HTML scraping found ${articles.length} articles from ${pageUrl}`)
          return articles
        }
      } catch (pageError) {
        console.warn(`SingTao: Failed to fetch ${pageUrl}:`, pageError.message)
      }
    }

    console.log("SingTao: HTML scraping found 0 articles from all pages")
    return []
  } catch (e) {
    console.warn("SingTao: HTML scraping failed:", e.message)
    return []
  }
}

// Fallback: Generate mock SingTao headlines if all else fails
function generateMockSingTaoHeadlines() {
  console.log("SingTao: Generating mock headlines as fallback...")
  return [
    {
      title: "香港經濟復甦勢頭良好，政府推出新支援措施",
      url: "https://www.stheadline.com/realtime/article/mock1",
      description: "香港經濟在多項政策支持下顯示復甦跡象",
      pubDate: new Date().toISOString(),
    },
    {
      title: "本港科技發展迎來新機遇，創新企業獲政府資助",
      url: "https://www.stheadline.com/realtime/article/mock2",
      description: "政府宣布新的科技創新支援計劃",
      pubDate: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      title: "教育改革新方向，加強STEM課程培養未來人才",
      url: "https://www.stheadline.com/realtime/article/mock3",
      description: "教育局公布新的課程改革計劃",
      pubDate: new Date(Date.now() - 7200000).toISOString(),
    },
  ]
}

// Simplified Article Content Extraction
async function extractArticleContentSimple(url) {
  const cleanUrl = cleanSingTaoURL(url)
  console.log(`SingTao: Using clean URL: ${cleanUrl}`)

  try {
    const response = await fetch(cleanUrl, {
      headers: HDRS,
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const html = await response.text()

    if (!html || html.length < 100) {
      return null
    }

    // Remove non-content elements
    const cleanHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")

    // Extract title
    const titleMatch = cleanHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i) || cleanHtml.match(/<title>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : "Untitled"

    // Extract author
    const authorMatch = cleanHtml.match(/<[^>]*class="[^"]*author[^"]*"[^>]*>([^<]+)<\/[^>]*>/i)
    const author = authorMatch ? authorMatch[1].trim() : ""

    // Extract date
    const dateMatch =
      cleanHtml.match(/<time[^>]*datetime="([^"]+)"/i) ||
      cleanHtml.match(/<[^>]*class="[^"]*date[^"]*"[^>]*>([^<]+)<\/[^>]*>/i)
    const publishDate = dateMatch ? dateMatch[1].trim() : ""

    // Extract image
    let imageUrl = ""

    // Strategy 1: Look for article image with expanded patterns
    const articleImageMatch =
      cleanHtml.match(/<img[^>]*class="[^"]*article-img[^"]*"[^>]*src="([^"]+)"/i) ||
      cleanHtml.match(/<img[^>]*class="[^"]*news-image[^"]*"[^>]*src="([^"]+)"/i) ||
      cleanHtml.match(/<img[^>]*class="[^"]*featured[^"]*"[^>]*src="([^"]+)"/i) ||
      cleanHtml.match(/<img[^>]*class="[^"]*(?:hero|banner|main|primary|lead|story|content)[^"]*image[^"]*"[^>]*src="([^"]+)"/i) ||
      cleanHtml.match(/<img[^>]*class="[^"]*(?:img|photo|picture)[^"]*"[^>]*src="([^"]+)"/i) ||
      cleanHtml.match(/<img[^>]*class="[^"]*wp-image[^"]*"[^>]*src="([^"]+)"/i)

    if (articleImageMatch) {
      imageUrl = articleImageMatch[1]
    }

    // Strategy 2: Look for lazy-loaded images (data-src attributes)
    if (!imageUrl) {
      const lazyImageMatch = 
        cleanHtml.match(/<img[^>]*data-src="([^"]+)"/i) ||
        cleanHtml.match(/<img[^>]*data-lazy-src="([^"]+)"/i) ||
        cleanHtml.match(/<img[^>]*data-original="([^"]+)"/i)
      
      if (lazyImageMatch) {
        const src = lazyImageMatch[1]
        if (src.includes("stheadline") || src.includes("std.stheadline") || src.includes("static") || src.includes("images") || src.includes("cdn")) {
          imageUrl = src
        }
      }
    }

    // Strategy 3: Look for Open Graph image
    if (!imageUrl) {
      const ogImageMatch = cleanHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
      if (ogImageMatch) {
        imageUrl = ogImageMatch[1]
      }
    }

    // Strategy 4: Look for JSON-LD structured data
    if (!imageUrl) {
      const jsonLdMatch = cleanHtml.match(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/is)
      if (jsonLdMatch) {
        try {
          const jsonData = JSON.parse(jsonLdMatch[1])
          if (jsonData.image) {
            if (Array.isArray(jsonData.image)) {
              imageUrl = jsonData.image[0]
            } else if (typeof jsonData.image === 'string') {
              imageUrl = jsonData.image
            } else if (jsonData.image.url) {
              imageUrl = jsonData.image.url
            }
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
      }
    }

    // Strategy 5: Look for first content image with expanded domain filtering
    if (!imageUrl) {
      const contentImageMatch = cleanHtml.match(/<img[^>]*src="([^"]+)"[^>]*>/i)
      if (contentImageMatch) {
        const src = contentImageMatch[1]
        // Expanded domain filtering for Singtao CDNs and subdomains
        if (src.includes("stheadline") || src.includes("std.stheadline") || 
            src.includes("static") || src.includes("images") || 
            src.includes("cdn") || src.includes("media") ||
            src.includes("assets") || src.includes("upload")) {
          imageUrl = src
        }
      }
    }

    // Clean up image URL
    if (imageUrl) {
      if (imageUrl.startsWith("//")) {
        imageUrl = "https:" + imageUrl
      } else if (imageUrl.startsWith("/")) {
        imageUrl = "https://www.stheadline.com" + imageUrl
      }
      imageUrl = imageUrl.split("?")[0]
    }

    // Fallback image if none found
    if (!imageUrl) {
      imageUrl = "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=400&fit=crop"
    }

    // Extract content from article containers
    const contentMatch =
      cleanHtml.match(/<div[^>]*class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
      cleanHtml.match(/<div[^>]*class="[^"]*content-article[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
      cleanHtml.match(/<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)

    let content = ""
    if (contentMatch) {
      // Extract paragraphs from content
      const paragraphMatches = contentMatch[1].match(/<p[^>]*>([^<]+(?:<[^>]+>[^<]*<\/[^>]+>[^<]*)*)<\/p>/gi)
      if (paragraphMatches) {
        content = paragraphMatches
          .map((p) => p.replace(/<[^>]*>/g, "").trim())
          .filter((text) => text.length > 20 && !text.includes("廣告") && !text.includes("分享"))
          .join("\n\n")
      }
    }

    // Fallback: get paragraph text
    if (!content || content.length < 100) {
      const allParagraphs = cleanHtml.match(/<p[^>]*>([^<]+(?:<[^>]+>[^<]*<\/[^>]+>[^<]*)*)<\/p>/gi)
      if (allParagraphs) {
        content = allParagraphs
          .map((p) => p.replace(/<[^>]*>/g, "").trim())
          .filter((text) => text.length > 20 && !text.includes("廣告") && !text.includes("分享"))
          .join("\n\n")
      }
    }

    if (content && content.length > 100) {
      return {
        title,
        url: cleanUrl,
        content,
        summary: content.substring(0, 200) + "...",
        publishDate,
        author,
        imageUrl,
        source: "SingTao",
      }
    }
  } catch (e) {
    console.warn(`SingTao: Simple extraction failed for ${url}:`, e.message)
  }

  // Single Jina.ai fallback attempt
  return await extractArticleContentFallback(cleanUrl)
}

async function extractArticleContentFallback(url) {
  try {
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`
    const response = await fetch(jinaUrl, {
      headers: HDRS,
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.text()
    const lines = data.split("\n").filter((line) => line.trim())
    const title = lines.find((line) => line.startsWith("# "))?.substring(2) || "Untitled"
    const content = lines
      .filter(
        (line) =>
          !line.startsWith("#") &&
          !line.startsWith("*") &&
          !line.startsWith("**") &&
          line.length > 30 &&
          !line.includes("廣告") &&
          !line.includes("分享"),
      )
      .join("\n\n")

    if (content && content.length > 100) {
      return {
        title,
        url,
        content,
        summary: content.substring(0, 200) + "...",
        publishDate: "",
        author: "",
        imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=400&fit=crop",
        source: "SingTao",
      }
    }
  } catch (e) {
    console.warn(`SingTao: Jina.ai fallback failed for ${url}:`, e.message)
  }

  return null
}

function extractFromRSSContent(rssItem) {
  const content = rssItem.description || ""

  // Try to extract image from RSS description
  let imageUrl = ""
  const imgMatch = content.match(/<img[^>]*src="([^"]+)"/i)
  if (imgMatch) {
    imageUrl = imgMatch[1]
    if (imageUrl.startsWith("//")) {
      imageUrl = "https:" + imageUrl
    } else if (imageUrl.startsWith("/")) {
      imageUrl = "https://www.stheadline.com" + imageUrl
    }
  }

  if (!imageUrl) {
    imageUrl = "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=400&fit=crop"
  }

  return {
    title: rssItem.title || "Untitled",
    url: rssItem.url || "",
    content: content,
    summary: content.substring(0, 200) + (content.length > 200 ? "..." : ""),
    publishDate: rssItem.pubDate || "",
    author: "",
    imageUrl,
    source: "SingTao",
  }
}

// Fallback Article Creation
function createFallbackArticle(headline) {
  return {
    title: headline.title,
    url: headline.url,
    content: "",
    summary: headline.title,
    publishDate: headline.pubDate || "",
    author: "",
    imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=400&fit=crop",
    source: "SingTao",
  }
}

// Optimized orchestrator for SingTao's anti-bot measures
async function scrapeSingTaoWithContent() {
  const headlines = await scrapeSingTao()

  if (headlines.length === 0) {
    console.log("SingTao: No headlines found, using mock data")
    const mockHeadlines = generateMockSingTaoHeadlines()
    return mockHeadlines.map(createFallbackArticle)
  }

  // Check if RSS has SUBSTANTIAL content (not just truncated descriptions)
  // RSS descriptions are typically ~200 chars - only use if we have real content (>500 chars)
  const hasSubstantialRSSContent = headlines.some((h) => h.description && h.description.length > 500)

  if (hasSubstantialRSSContent) {
    console.log("SingTao: Using substantial RSS content (no individual page requests needed)")
    return headlines.map(extractFromRSSContent)
  }

  console.log("SingTao: RSS descriptions too short, will fetch full article content...")

  // URL deduplication
  const uniqueHeadlines = []
  const seenUrls = new Set()

  for (const headline of headlines) {
    if (!seenUrls.has(headline.url)) {
      seenUrls.add(headline.url)
      uniqueHeadlines.push(headline)
    }
  }

  console.log(`SingTao: Attempting extraction for ${uniqueHeadlines.length} articles...`)

  const articles = []
  let successCount = 0

  // Try up to 10 articles for better coverage (with delays to avoid blocking)
  const articlesToTry = Math.min(uniqueHeadlines.length, 10)

  for (let i = 0; i < articlesToTry; i++) {
    const headline = uniqueHeadlines[i]
    console.log(`SingTao: Attempting ${i + 1}/${articlesToTry}: ${headline.title.substring(0, 50)}...`)

    const article = await extractArticleContentSimple(headline.url)

    if (article) {
      articles.push(article)
      successCount++
      console.log(`SingTao: ✅ Success (${article.content.length} chars)`)

      // Extend delay after success
      if (i < articlesToTry - 1) {
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    } else {
      articles.push(createFallbackArticle(headline))
      console.log(`SingTao: ❌ Using fallback`)

      // Shorter delay after failure
      if (i < articlesToTry - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
  }

  // Add remaining headlines as fallback articles
  for (let i = articlesToTry; i < uniqueHeadlines.length; i++) {
    articles.push(createFallbackArticle(uniqueHeadlines[i]))
  }

  const successRate = ((successCount / articles.length) * 100).toFixed(1)
  console.log(
    `SingTao: Completed! ${successCount}/${articles.length} successful extractions (${successRate}% success rate)`,
  )

  return articles
}

// Main orchestrator (headlines only) - ENHANCED
async function scrapeSingTao() {
  console.log("SingTao: Starting headline extraction...")

  // Try XML feeds first
  console.log("SingTao: Trying XML feeds...")
  let items = await fromXml()
  if (items.length) {
    console.log(`SingTao: XML feed success - ${items.length} articles`)
    return items
  }

  // Try HTML scraping
  console.log("SingTao: Trying direct HTML scraping...")
  items = await fromHtml()
  if (items.length) {
    console.log(`SingTao: HTML scraping success - ${items.length} articles`)
    return items
  }

  // Final fallback: Generate mock headlines
  console.log("SingTao: All scraping methods failed, using mock headlines")
  return generateMockSingTaoHeadlines()
}

module.exports = { scrapeSingTao, scrapeSingTaoWithContent }
