// Enhanced HK01 scraper based on working version
// Optimized for Next.js environment with native fetch

const HDRS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  "Accept-Language": "zh-HK,zh;q=0.9,en;q=0.8",
}

const API_URL = "https://web-data.api.hk01.com/v1/channel/11?per_page=20&page=1"

// Enhanced HTML scraping with category drill-down
async function fromHtml() {
  try {
    const articles = []

    // Key categories to scrape for actual articles
    const categories = [
      { name: "港聞", url: "/zone/1" },
      { name: "政情", url: "/channel/310" },
      { name: "國際", url: "/zone/4" },
    ]

    for (const category of categories) {
      try {
        console.log(`HK01: Fetching articles from ${category.name}...`)
        const response = await fetch(`https://www.hk01.com${category.url}`, {
          headers: HDRS,
          signal: AbortSignal.timeout(10000),
        })

        if (!response.ok) {
          console.warn(`HK01: ${category.name} returned ${response.status}`)
          continue
        }

        const html = await response.text()
        const categoryArticles = []

        // Strategy 1: Look for article links in the content
        const articleLinkRegex = /<a[^>]*href="([^"]*\/article\/[^"]*)"[^>]*>([^<]+)<\/a>/gi
        let match

        while ((match = articleLinkRegex.exec(html)) !== null && categoryArticles.length < 3) {
          const url = match[1]
          const title = match[2].trim()

          if (title && url && title.length > 15 && !title.includes("更多")) {
            categoryArticles.push({
              title: `[${category.name}] ${title}`,
              url: url.startsWith("http") ? url : `https://www.hk01.com${url}`,
            })
          }
        }

        // Strategy 2: Look for links with specific news patterns
        if (categoryArticles.length < 2) {
          const newsLinkRegex = /<a[^>]*href="([^"]*\/(?:港聞|政情|國際)\/[^"]*)"[^>]*>([^<]+)<\/a>/gi

          while ((match = newsLinkRegex.exec(html)) !== null && categoryArticles.length < 3) {
            const url = match[1]
            const title = match[2].trim()

            if (title && url && title.length > 10) {
              categoryArticles.push({
                title: `[${category.name}] ${title}`,
                url: url.startsWith("http") ? url : `https://www.hk01.com${url}`,
              })
            }
          }
        }

        articles.push(...categoryArticles)

        // Rate limiting between requests
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (categoryError) {
        console.warn(`HK01: Failed to fetch ${category.name}:`, categoryError.message)
      }
    }

    // If we got articles from categories, return them
    if (articles.length > 0) {
      return articles.slice(0, 10)
    }

    // Fallback: Try the /latest page for any content
    console.log("HK01: Trying fallback /latest page...")
    const response = await fetch("https://www.hk01.com/latest", {
      headers: HDRS,
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const html = await response.text()
    const fallbackArticles = []

    const linkRegex = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi
    let match

    while ((match = linkRegex.exec(html)) !== null && fallbackArticles.length < 10) {
      const url = match[1]
      const title = match[2].trim()

      // Filter out promotional and non-news URLs
      const isValidNewsUrl = url.includes('/article/') || 
                            url.includes('/政情/') || 
                            url.includes('/港聞/') || 
                            url.includes('/國際/') ||
                            url.includes('/zone/')

      const isPromotionalUrl = url.includes('clk.omgt3.com') ||
                              url.includes('affiliate.klook.com') ||
                              url.includes('trip.com') ||
                              url.includes('promo') ||
                              url.includes('offer')

      if (title && url && title.length > 10 && 
          !title.includes("登入") && !title.includes("更多") &&
          isValidNewsUrl && !isPromotionalUrl) {
        fallbackArticles.push({
          title,
          url: url.startsWith("http") ? url : `https://www.hk01.com${url}`,
        })
      }
    }

    return fallbackArticles
  } catch (e) {
    console.warn("HK01 HTML scraping fail:", e.message)
    return []
  }
}

// Native JSON API (cloudflare-free)
async function fromApi() {
  try {
    const response = await fetch(API_URL, {
      headers: HDRS,
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json()
    const items = data?.data || []

    return items
      .slice(0, 10)
      .map((item) => {
        const title = item.title?.trim()
        const url = item.canonicalUrl || item.url || item.link
        return title && url
          ? {
              title,
              url: url.startsWith("http") ? url : `https://www.hk01.com${url}`,
            }
          : null
      })
      .filter(Boolean)
  } catch (e) {
    console.warn("HK01 API fail:", e.message)
    return []
  }
}

// Sitemap fallback
async function fromSitemap() {
  try {
    const response = await fetch("https://www.hk01.com/sitemap.xml", {
      headers: HDRS,
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.text()
    const articles = []

    // Extract URLs from sitemap
    const urlRegex = /<loc>([^<]+)<\/loc>/gi
    let match

    while ((match = urlRegex.exec(data)) !== null && articles.length < 10) {
      const loc = match[1]
      if (loc.includes("/政情/") || loc.includes("/港聞/") || loc.includes("/article/")) {
        // Extract title from URL slug
        const parts = loc.split("/")
        const titleSlug = parts[parts.length - 1]
        if (titleSlug && titleSlug.length > 5) {
          const title = decodeURIComponent(titleSlug).replace(/-/g, " ")
          articles.push({ title, url: loc })
        }
      }
    }

    return articles
  } catch (e) {
    console.warn("HK01 sitemap fail:", e.message)
    return []
  }
}

// Article Content Extraction
async function extractArticleContent(url) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  try {
    // Strategy 1: Direct article page scraping
    const response = await fetch(url, {
      headers: HDRS,
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const html = await response.text()

    // Remove ads, navigation, and other non-content elements
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
    const authorMatch =
      cleanHtml.match(/<[^>]*class="[^"]*author[^"]*"[^>]*>([^<]+)<\/[^>]*>/i) ||
      cleanHtml.match(/<[^>]*data-testid="author"[^>]*>([^<]+)<\/[^>]*>/i)
    const author = authorMatch ? authorMatch[1].trim() : ""

    // Extract date
    const dateMatch =
      cleanHtml.match(/<time[^>]*datetime="([^"]+)"/i) ||
      cleanHtml.match(/<[^>]*class="[^"]*date[^"]*"[^>]*>([^<]+)<\/[^>]*>/i)
    const publishDate = dateMatch ? dateMatch[1].trim() : ""

    // Extract image
    let imageUrl = ""

    // Strategy 1: Look for article featured image
    const featuredImageMatch =
      cleanHtml.match(/<img[^>]*class="[^"]*featured[^"]*"[^>]*src="([^"]+)"/i) ||
      cleanHtml.match(/<img[^>]*class="[^"]*article-image[^"]*"[^>]*src="([^"]+)"/i) ||
      cleanHtml.match(/<img[^>]*class="[^"]*hero[^"]*"[^>]*src="([^"]+)"/i)

    if (featuredImageMatch) {
      imageUrl = featuredImageMatch[1]
    }

    // Strategy 2: Look for Open Graph image
    if (!imageUrl) {
      const ogImageMatch = cleanHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
      if (ogImageMatch) {
        imageUrl = ogImageMatch[1]
      }
    }

    // Strategy 3: Look for first content image
    if (!imageUrl) {
      const contentImageMatch = cleanHtml.match(/<img[^>]*src="([^"]+)"[^>]*>/i)
      if (contentImageMatch) {
        const src = contentImageMatch[1]
        // Only use if it looks like a real article image (not icons/logos)
        if (src.includes("cdn.hk01.com") || src.includes("images") || src.includes("photo")) {
          imageUrl = src
        }
      }
    }

    // Clean up image URL
    if (imageUrl) {
      // Ensure absolute URL
      if (imageUrl.startsWith("//")) {
        imageUrl = "https:" + imageUrl
      } else if (imageUrl.startsWith("/")) {
        imageUrl = "https://www.hk01.com" + imageUrl
      }

      // Remove query parameters that might cause issues
      imageUrl = imageUrl.split("?")[0]
    }

    // Fallback image if none found
    if (!imageUrl) {
      imageUrl = "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=400&fit=crop"
    }

    // HK01 article content selectors (multiple fallbacks)
    const contentSelectors = [
      "content-article-content",
      "article-content",
      "content-body",
      "entry-content",
      "post-content",
    ]

    let content = ""

    // Extract main content
    for (const selector of contentSelectors) {
      const contentRegex = new RegExp(`<div[^>]*class="[^"]*${selector}[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`, "i")
      const contentMatch = cleanHtml.match(contentRegex)

      if (contentMatch && contentMatch[1].trim().length > 200) {
        // Extract paragraphs from content
        const paragraphMatches = contentMatch[1].match(/<p[^>]*>([^<]+(?:<[^>]+>[^<]*<\/[^>]+>[^<]*)*)<\/p>/gi)
        if (paragraphMatches) {
          content = paragraphMatches
            .map((p) => p.replace(/<[^>]*>/g, "").trim())
            .filter((text) => text.length > 20)
            .join("\n\n")
        }
        break
      }
    }

    // Fallback: get all paragraph text if no content found
    if (!content || content.length < 100) {
      const allParagraphs = cleanHtml.match(/<p[^>]*>([^<]+(?:<[^>]+>[^<]*<\/[^>]+>[^<]*)*)<\/p>/gi)
      if (allParagraphs) {
        content = allParagraphs
          .map((p) => p.replace(/<[^>]*>/g, "").trim())
          .filter((text) => text.length > 20)
          .join("\n\n")
      }
    }

    if (content && content.length > 100) {
      return {
        title,
        url,
        content,
        summary: content.substring(0, 200) + "...",
        publishDate,
        author,
        imageUrl,
        source: "HK01",
      }
    }

    // Strategy 2: Try AMP version if available
    if (url.includes("hk01.com") && !url.includes("/amp/")) {
      const ampUrl = url.replace("hk01.com/", "hk01.com/amp/")
      await sleep(1000)
      return await extractArticleContentFallback(ampUrl)
    }
  } catch (e) {
    console.warn(`HK01: Direct extraction failed for ${url}:`, e.message)
  }

  // Strategy 3: Jina.ai fallback
  await sleep(1500)
  return await extractArticleContentFallback(url)
}

async function extractArticleContentFallback(url) {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`
    const response = await fetch(jinaUrl, {
      headers: HDRS,
      signal: AbortSignal.timeout(12000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.text()
    const lines = data.split("\n").filter((line) => line.trim())
    const title = lines.find((line) => line.startsWith("# "))?.substring(2) || "Untitled"
    const content = lines
      .filter((line) => !line.startsWith("#") && !line.startsWith("*") && line.length > 30)
      .join("\n\n")

    if (content && content.length > 100) {
      return {
        title,
        url,
        content,
        summary: content.substring(0, 200) + "...",
        publishDate: "",
        author: "",
        imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=400&fit=crop",
        source: "HK01",
      }
    }
  } catch (e) {
    console.warn(`HK01: Jina.ai fallback failed for ${url}:`, e.message)
  }

  return null
}

// Enhanced orchestrator with content extraction
async function scrapeHK01WithContent() {
  const headlines = await scrapeHK01()
  const articles = []

  console.log(`HK01: Extracting content for ${headlines.length} articles...`)

  for (let i = 0; i < headlines.length; i++) {
    const headline = headlines[i]
    console.log(`HK01: Extracting ${i + 1}/${headlines.length}: ${headline.title.substring(0, 50)}...`)

    const article = await extractArticleContent(headline.url)
    if (article) {
      articles.push(article)
    } else {
      console.warn(`HK01: Failed to extract content from ${headline.url}`)
      // Still include headline-only data as fallback
      articles.push({
        title: headline.title,
        url: headline.url,
        content: "",
        summary: headline.title,
        publishDate: "",
        author: "",
        imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=400&fit=crop",
        source: "HK01",
      })
    }

    // Rate limiting
    if (i < headlines.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  return articles
}

// Main orchestrator (headlines only)
async function scrapeHK01() {
  console.log("HK01: Trying direct HTML scraping...")
  let articles = await fromHtml()
  if (articles.length) {
    console.log(`HK01: HTML scraping success - ${articles.length} articles`)
    return articles
  }

  console.log("HK01: Trying JSON API...")
  articles = await fromApi()
  if (articles.length) {
    console.log(`HK01: API success - ${articles.length} articles`)
    return articles
  }

  console.log("HK01: Trying sitemap fallback...")
  articles = await fromSitemap()
  console.log(`HK01: Final result - ${articles.length} articles`)
  return articles
}

module.exports = { scrapeHK01, scrapeHK01WithContent }
