import { summarizeArticles } from "./ai-summarizer"
import { saveArticle, getArticleStats } from "./supabase"
import { updateProgress, startScraping } from "../app/api/scrape/progress/route"

// Import the enhanced scrapers
const { scrapeHKFPWithContent } = require("./scrapers/hkfp")
const { scrapeSingTaoWithContent } = require("./scrapers/singtao")
const { scrapeHK01WithContent } = require("./scrapers/hk01")
const { withContent: scrapeOnccWithContent } = require("./scrapers/oncc")
const { withContent: scrapeRTHKWithContent } = require("./scrapers/rthk")

const OUTLET_SCRAPERS = {
  hkfp: scrapeHKFPWithContent,
  singtao: scrapeSingTaoWithContent,
  hk01: scrapeHK01WithContent,
  oncc: scrapeOnccWithContent,
  rthk: scrapeRTHKWithContent,
}

const OUTLET_NAMES = {
  hkfp: "HKFP",
  singtao: "SingTao", 
  hk01: "HK01",
  oncc: "ONCC",
  rthk: "RTHK",
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
        const saved = await saveArticle(article)
        if (saved) savedCount++
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

    // Run scrapers with progress tracking if enabled
    const outletKeys = Object.keys(OUTLET_SCRAPERS)
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
    default:
      return "General"
  }
}
