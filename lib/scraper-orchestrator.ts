import { summarizeArticles } from "./ai-summarizer"
import { saveArticle, getArticleStats, saveHeadlines, cleanupOldHeadlines, type Headline } from "./supabase"
import { saveUnifiedArticle } from "./supabase-unified"
import { updateProgress, startScraping } from "../app/api/scrape/progress/route"

// Import the enhanced scrapers
const { scrapeHKFPWithContent } = require("./scrapers/hkfp")
const { scrapeSingTaoWithContent } = require("./scrapers/singtao")
const { scrapeHK01WithContent } = require("./scrapers/hk01")
const { withContent: scrapeOnccWithContent } = require("./scrapers/oncc")
const { withContent: scrapeRTHKWithContent } = require("./scrapers/rthk")
const { scrape28CarWithContent } = require("./scrapers/28car")

const OUTLET_SCRAPERS = {
  hkfp: scrapeHKFPWithContent,
  singtao: scrapeSingTaoWithContent,
  hk01: scrapeHK01WithContent,
  oncc: scrapeOnccWithContent,
  rthk: scrapeRTHKWithContent,
  '28car': scrape28CarWithContent,
}

const OUTLET_NAMES = {
  hkfp: "HKFP",
  singtao: "SingTao", 
  hk01: "HK01",
  oncc: "ONCC",
  rthk: "RTHK",
  '28car': "28car",
}

// Separate news scrapers from car scrapers for runAllScrapers
// Car scraping is handled by a dedicated cron job at /api/cron/scrape-cars
const NEWS_OUTLET_SCRAPERS = {
  hkfp: scrapeHKFPWithContent,
  singtao: scrapeSingTaoWithContent,
  hk01: scrapeHK01WithContent,
  oncc: scrapeOnccWithContent,
  rthk: scrapeRTHKWithContent,
}

// Individual scraper function with progress tracking
export async function runSingleScraper(outletKey: string, withProgress = false) {
  const scraper = OUTLET_SCRAPERS[outletKey]
  const outletName = OUTLET_NAMES[outletKey]
  
  if (!scraper) {
    throw new Error(`Unknown outlet: ${outletKey}`)
  }

  if (withProgress) {
    updateProgress(outletKey, {
      status: 'running',
      progress: 10,
      message: `Starting ${outletName} scraper...`,
      startTime: Date.now()
    })
  }

  try {
    console.log(`🚀 Starting ${outletName} scraper...`)
    
    if (withProgress) {
      updateProgress(outletKey, {
        progress: 30,
        message: `Fetching ${outletName} articles...`
      })
    }

    const articles = await scraper()
    
    if (!articles || articles.length === 0) {
      console.log(`⚠️ ${outletName}: No articles found`)
      if (withProgress) {
        updateProgress(outletKey, {
          status: 'completed',
          progress: 100,
          message: 'No articles found',
          endTime: Date.now()
        })
      }
      return { outlet: outletName, articlesFound: 0, articlesSaved: 0 }
    }

    console.log(`📰 ${outletName}: Found ${articles.length} articles`)
    
    if (withProgress) {
      updateProgress(outletKey, {
        progress: 60,
        articlesFound: articles.length,
        message: `Processing ${articles.length} articles...`
      })
    }

    // Process articles that need AI summarization
    const articlesNeedingSummary = articles.filter(
      article => !article.content || article.content.length < 100
    )

    if (articlesNeedingSummary.length > 0) {
      console.log(`🤖 ${outletName}: Summarizing ${articlesNeedingSummary.length} articles...`)
      if (withProgress) {
        updateProgress(outletKey, {
          progress: 70,
          message: `AI summarizing ${articlesNeedingSummary.length} articles...`
        })
      }
      await summarizeArticles(articlesNeedingSummary)
    }

    // Save articles to database
    if (withProgress) {
      updateProgress(outletKey, {
        progress: 80,
        message: 'Saving articles to database...'
      })
    }

    let savedCount = 0
    for (const article of articles) {
      try {
        // For cars, save to unified table with images array and specs
        if (outletKey === '28car') {
          const { article: saved, error } = await saveUnifiedArticle({
            title: article.title,
            content: article.content || "",
            summary: article.summary || "",
            lede: article.summary,
            url: article.url,
            source: article.source,
            author: article.author || '28car',
            published_at: article.publishDate || new Date().toISOString(),
            image_url: article.imageUrl,
            images: article.images, // Include images array
            category: 'cars',
            article_type: 'scraped',
            status: 'published',
            processing_status: 'ready',
            features: {
              has_image: !!(article.imageUrl || (article.images && article.images.length > 0)),
              has_ai_content: false,
              has_translation: false
            },
            contextual_data: {
              specs: article.specs, // Store car specifications
              make: article.make,
              model: article.model,
              year: article.year,
              price: article.price
            }
          })
          if (!error && saved) savedCount++
        } else {
          const saved = await saveArticle(article)
          if (saved) savedCount++
        }
      } catch (error) {
        console.error(`💥 Failed to save article: ${article.title}`, error)
      }
    }

    console.log(`✅ ${outletName} completed: ${savedCount}/${articles.length} articles saved`)
    
    if (withProgress) {
      updateProgress(outletKey, {
        status: 'completed',
        progress: 100,
        message: `Completed: ${savedCount}/${articles.length} saved`,
        endTime: Date.now()
      })
    }

    return {
      outlet: outletName,
      articlesFound: articles.length,
      articlesSaved: savedCount,
      articles: articles
    }

  } catch (error) {
    console.error(`💥 ${outletName} scraping failed:`, error)
    
    if (withProgress) {
      updateProgress(outletKey, {
        status: 'error',
        progress: 0,
        message: `Error: ${error.message}`,
        error: error.message,
        endTime: Date.now()
      })
    }
    
    throw error
  }
}

export async function runAllScrapers(withProgress = false) {
  console.log("🚀 Starting enhanced news scraping process...")
  console.log("📅 Timestamp:", new Date().toISOString())

  if (withProgress) {
    startScraping()
  }

  // Get current database stats
  const initialStats = await getArticleStats()
  if (initialStats) {
    console.log(`📊 Current database: ${initialStats.total} articles`)
    console.log(
      `   Sources: ${Object.entries(initialStats.bySource)
        .map(([source, count]) => `${source}(${count})`)
        .join(", ")}`,
    )
  }

  const allArticles = []
  let scrapingMethod = "enhanced-real"

  try {
    console.log("🔄 Using enhanced scrapers with content extraction...")

    // Run news scrapers only (excluding car scrapers)
    const outletKeys = Object.keys(NEWS_OUTLET_SCRAPERS)
    const results = await Promise.allSettled(
      outletKeys.map(key => runSingleScraper(key, withProgress))
    )

    let hasRealData = false
    let totalArticlesFound = 0
    let totalArticlesSaved = 0

    // Process results
    results.forEach((result, index) => {
      const outletKey = outletKeys[index]
      const outletName = OUTLET_NAMES[outletKey]
      
      if (result.status === "fulfilled") {
        const { articlesFound, articlesSaved, articles } = result.value
        console.log(`✅ ${outletName}: Got ${articlesFound} articles, saved ${articlesSaved}`)
        
        if (articles && articles.length > 0) {
          allArticles.push(...articles)
          hasRealData = true
        }
        
        totalArticlesFound += articlesFound
        totalArticlesSaved += articlesSaved
      } else {
        console.log(`❌ ${outletName}: ${result.reason}`)
      }
    })

    if (!hasRealData) {
      // Fallback to enhanced mock data
      console.log("⚠️ Enhanced scraping failed, using enhanced mock data...")
      scrapingMethod = "enhanced-mock"

      const mockArticles = [
        {
          title: "Hong Kong's Economic Recovery Shows Promising Signs in 2024",
          content:
            "Hong Kong's economy is demonstrating resilience as international travel resumes and business confidence returns. The government has announced several initiatives to boost economic growth, including tax incentives for businesses and increased infrastructure spending. Financial experts predict moderate growth in the coming quarters, with the services sector leading the recovery. The tourism industry, which was severely impacted during the pandemic, is showing signs of revival with increased visitor arrivals from mainland China and other Asian markets.",
          summary:
            "Hong Kong's economy shows recovery signs with government initiatives and moderate growth predicted.",
          url: "https://hongkongfp.com/2024/01/15/hong-kong-economic-recovery",
          imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=400&fit=crop",
          source: "HKFP",
          author: "Economic Reporter",
          publishDate: new Date().toISOString(),
        },
        {
          title: "香港科技發展迎來新機遇，政府推出創科支援計劃",
          content:
            "香港科技園公司宣布推出全新的創科支援計劃，為初創企業提供更多資源和資金支持。該計劃將重點支持人工智能、生物科技和金融科技等領域的創新項目。政府表示，這項計劃將有助於鞏固香港作為國際創科中心的地位，並吸引更多國際人才來港發展。計劃預計將在未來三年內投入超過50億港元，支持超過1000家初創企業。",
          summary: "香港科技園推出創科支援計劃，重點支持AI、生物科技和金融科技領域。",
          url: "https://std.stheadline.com/2024/01/15/tech-development-opportunities",
          imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=400&fit=crop",
          source: "SingTao",
          author: "科技記者",
          publishDate: new Date().toISOString(),
        },
        {
          title: "香港教育制度改革邁向新階段，加強STEM教育",
          content:
            "教育局公布新的教育改革方案，重點加強STEM教育和職業培訓課程。新方案包括增加科技相關課程、改善師資培訓計劃和提升學校硬件設施。教育界人士認為這些改革將有助於培養更多符合未來經濟發展需要的人才，特別是在數碼科技和創新領域。改革計劃將分階段實施，預計在未來五年內全面落實。",
          summary: "教育局公布改革方案，加強STEM教育和職業培訓，培養未來人才。",
          url: "https://www.hk01.com/2024/01/13/education-reform-new-phase",
          imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=400&fit=crop",
          source: "HK01",
          author: "教育記者",
          publishDate: new Date(Date.now() - 172800000).toISOString(),
        },
      ]

      allArticles.push(...mockArticles)
    }

    console.log(`📊 Total articles collected: ${allArticles.length}`)

    if (allArticles.length === 0) {
      return {
        success: false,
        message: "No articles could be scraped or generated",
        method: scrapingMethod,
      }
    }

    // Summarize articles with AI (only if they don't already have good content)
    console.log("🤖 Starting AI summarization for articles without content...")
    const articlesToSummarize = allArticles.filter((article) => !article.content || article.content.length < 100)
    const articlesWithContent = allArticles.filter((article) => article.content && article.content.length >= 100)

    let summarizedArticles = []
    if (articlesToSummarize.length > 0) {
      const summarized = await summarizeArticles(articlesToSummarize)
      summarizedArticles = [...articlesWithContent, ...summarized]
    } else {
      summarizedArticles = articlesWithContent
    }

    console.log(`✨ Processing completed for ${summarizedArticles.length} articles`)

    // Save to Supabase with duplicate tracking
    console.log("💾 Saving articles to database...")
    const savedArticles = []
    const skippedArticles = []
    let saveErrors = 0

    for (const article of summarizedArticles) {
      try {
        const saved = await saveArticle({
          title: article.title,
          content: article.content || "",
          summary: article.summary,
          ai_summary: article.ai_summary || article.summary,
          url: article.url,
          source: article.source,
          author: article.author,
          published_at: article.publishDate || new Date().toISOString(),
          image_url: article.imageUrl,
          images: article.images, // Add images array for cars
          category: getCategoryFromSource(article.source),
        })

        if (saved.skipped) {
          skippedArticles.push(saved)
        } else {
          savedArticles.push(saved)
        }
      } catch (error) {
        console.error(`❌ Error saving article "${article.title}":`, error.message)
        saveErrors++
      }
    }

    const totalProcessed = savedArticles.length + skippedArticles.length
    const successRate = totalProcessed > 0 ? ((totalProcessed / summarizedArticles.length) * 100).toFixed(1) : "0"

    console.log(`✅ Processing complete:`)
    console.log(`   📝 New articles saved: ${savedArticles.length}`)
    console.log(`   ⏭️  Duplicates skipped: ${skippedArticles.length}`)
    console.log(`   ❌ Errors: ${saveErrors}`)
    console.log(`   📊 Success rate: ${successRate}%`)

    // Get final stats
    const finalStats = await getArticleStats()

    return {
      success: true,
      message: `Processed ${totalProcessed} articles (${savedArticles.length} new, ${skippedArticles.length} duplicates)`,
      method: scrapingMethod,
      details: {
        scraped: allArticles.length,
        summarized: summarizedArticles.length,
        saved: savedArticles.length,
        skipped: skippedArticles.length,
        saveErrors: saveErrors,
        successRate: `${successRate}%`,
      },
      sources: {
        HKFP: allArticles.filter((a) => a.source === "HKFP").length,
        SingTao: allArticles.filter((a) => a.source === "SingTao").length,
        HK01: allArticles.filter((a) => a.source === "HK01").length,
        ONCC: allArticles.filter((a) => a.source === "ONCC").length,
        RTHK: allArticles.filter((a) => a.source === "RTHK").length,
      },
      database: {
        before: initialStats,
        after: finalStats,
      },
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error("💥 Critical error in enhanced scraper orchestrator:", error)
    return {
      success: false,
      message: `Enhanced scraping failed: ${error.message}`,
      error: error.message,
      method: scrapingMethod,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    }
  }
}

function getCategoryFromSource(source: string): string {
  switch (source.toLowerCase()) {
    case "hkfp":
      return "Politics"
    case "singtao":
      return "General"
    case "hk01":
      return "Local"
    case "oncc":
      return "Local"
    case "rthk":
      return "News"
    case "28car":
      return "cars"
    default:
      return "General"
  }
}

// Convert articles to headlines based on news-curation.md categories
function categorizeHeadline(article: any): string {
  const title = article.title.toLowerCase()
  const content = (article.content || article.summary || "").toLowerCase()
  const text = `${title} ${content}`

  // Politics & Government
  if (text.includes("government") || text.includes("政府") || text.includes("council") || text.includes("legislative") || 
      text.includes("chief executive") || text.includes("特首") || text.includes("policy") || text.includes("政策") ||
      text.includes("election") || text.includes("選舉") || text.includes("district council") || text.includes("區議會")) {
    return "Politics"
  }

  // Economy & Finance
  if (text.includes("property") || text.includes("housing") || text.includes("房屋") || text.includes("樓價") ||
      text.includes("stock") || text.includes("market") || text.includes("economy") || text.includes("economic") ||
      text.includes("finance") || text.includes("financial") || text.includes("bank") || text.includes("銀行") ||
      text.includes("investment") || text.includes("投資") || text.includes("budget") || text.includes("預算")) {
    return "Economy"
  }

  // Crime & Safety
  if (text.includes("police") || text.includes("警察") || text.includes("arrest") || text.includes("逮捕") ||
      text.includes("crime") || text.includes("罪案") || text.includes("accident") || text.includes("意外") ||
      text.includes("traffic") || text.includes("交通") || text.includes("court") || text.includes("法庭") ||
      text.includes("trial") || text.includes("審訊") || text.includes("smuggling") || text.includes("走私")) {
    return "Crime"
  }

  // Health & Community
  if (text.includes("health") || text.includes("健康") || text.includes("hospital") || text.includes("醫院") ||
      text.includes("medical") || text.includes("醫療") || text.includes("covid") || text.includes("virus") ||
      text.includes("vaccine") || text.includes("疫苗") || text.includes("mental health") || text.includes("精神健康") ||
      text.includes("community") || text.includes("社區")) {
    return "Health"
  }

  // Lifestyle & Entertainment  
  if (text.includes("restaurant") || text.includes("餐廳") || text.includes("food") || text.includes("美食") ||
      text.includes("film") || text.includes("電影") || text.includes("festival") || text.includes("節日") ||
      text.includes("entertainment") || text.includes("娛樂") || text.includes("celebrity") || text.includes("明星") ||
      text.includes("culture") || text.includes("文化") || text.includes("michelin") || text.includes("米芝蓮") ||
      text.includes("travel") || text.includes("旅遊")) {
    return "Lifestyle"
  }

  // International
  if (text.includes("china") || text.includes("中國") || text.includes("mainland") || text.includes("內地") ||
      text.includes("taiwan") || text.includes("台灣") || text.includes("usa") || text.includes("america") ||
      text.includes("美國") || text.includes("trade") || text.includes("貿易") || text.includes("international") ||
      text.includes("global") || text.includes("world") || text.includes("外交")) {
    return "International"
  }

  // Default to the source-based category if no specific match
  return getCategoryFromSource(article.source)
}

function convertArticlesToHeadlines(articles: any[]): Headline[] {
  return articles.map(article => ({
    category: categorizeHeadline(article),
    title: article.title,
    url: article.url,
    source: article.source,
    published_at: article.publishDate || article.published_at || new Date().toISOString(),
    image_url: article.imageUrl || article.image_url,
    author: article.author
  }))
}

function selectTopHeadlinesByCategory(headlines: Headline[]): Headline[] {
  const categories = ["Politics", "Economy", "Crime", "Health", "Lifestyle", "International"]
  const topHeadlines: Headline[] = []

  categories.forEach(category => {
    const categoryHeadlines = headlines
      .filter(h => h.category === category)
      .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
      .slice(0, 10) // Top 10 per category

    topHeadlines.push(...categoryHeadlines)
  })

  return topHeadlines
}

export async function collectDailyHeadlines() {
  try {
    console.log("📰 Starting daily headlines collection...")
    
    // Cleanup old headlines first
    await cleanupOldHeadlines()
    
    // Run all scrapers to get fresh articles
    const scrapingResult = await runAllScrapers(false)
    
    if (!scrapingResult.success || !scrapingResult.details) {
      console.log("⚠️ Scraping failed, using fallback headlines...")
      
      // Fallback headlines if scraping fails
      const fallbackHeadlines: Headline[] = [
        {
          category: "Politics",
          title: "Legislative Council Discusses New Housing Policy Framework",
          url: "https://hongkongfp.com/politics/housing-policy",
          source: "HKFP",
          published_at: new Date().toISOString()
        },
        {
          category: "Economy", 
          title: "Hong Kong Property Prices Show Slight Decline",
          url: "https://hk01.com/economy/property-prices",
          source: "HK01",
          published_at: new Date().toISOString()
        },
        {
          category: "Crime",
          title: "Police Arrest Three in Cross-Border Operation",
          url: "https://oncc.com/crime/arrest",
          source: "ONCC", 
          published_at: new Date().toISOString()
        }
      ]
      
      await saveHeadlines(fallbackHeadlines)
      console.log(`✅ Saved ${fallbackHeadlines.length} fallback headlines`)
      
      return {
        success: true,
        headlinesSaved: fallbackHeadlines.length,
        method: "fallback"
      }
    }

    // Get all collected articles from the scraping result
    const outletKeys = Object.keys(NEWS_OUTLET_SCRAPERS)
    const allArticles: any[] = []

    // Simulate getting articles from each scraper result
    const results = await Promise.allSettled(
      outletKeys.map(key => runSingleScraper(key, false))
    )

    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value.articles) {
        allArticles.push(...result.value.articles)
      }
    })

    if (allArticles.length === 0) {
      console.log("⚠️ No articles found, using fallback headlines")
      return { success: false, message: "No articles to convert to headlines" }
    }

    // Convert articles to headlines with categorization
    const headlines = convertArticlesToHeadlines(allArticles)
    
    // Select top 10 headlines per category
    const topHeadlines = selectTopHeadlinesByCategory(headlines)
    
    // Save headlines to database
    if (topHeadlines.length > 0) {
      await saveHeadlines(topHeadlines)
      console.log(`✅ Saved ${topHeadlines.length} headlines across ${new Set(topHeadlines.map(h => h.category)).size} categories`)
      
      // Log category breakdown
      const categoryCount = topHeadlines.reduce((acc, h) => {
        acc[h.category] = (acc[h.category] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      console.log("📊 Headlines by category:", categoryCount)
    }

    return {
      success: true,
      headlinesSaved: topHeadlines.length,
      categoriesCount: new Set(topHeadlines.map(h => h.category)).size,
      method: "real-data"
    }

  } catch (error) {
    console.error("💥 Error collecting daily headlines:", error)
    return {
      success: false,
      message: `Headlines collection failed: ${error.message}`,
      error: error.message
    }
  }
}
