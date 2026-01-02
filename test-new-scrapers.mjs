/**
 * Test new scrapers: BBC, CGTN, Reuters
 */

import { scrapeBBCWithContent } from './lib/scrapers/bbc.js'
import { scrapeCGTNWithContent } from './lib/scrapers/cgtn.js'
import { scrapeReutersWithContent } from './lib/scrapers/reuters.js'

async function testScraper(name, scraperFn) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Testing ${name}...`)
  console.log('='.repeat(60))

  try {
    const startTime = Date.now()
    const articles = await scraperFn()
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log(`\n✅ ${name}: ${articles.length} articles in ${duration}s`)

    if (articles.length > 0) {
      console.log('\nSample article:')
      const sample = articles[0]
      console.log(`  Headline: ${sample.headline?.substring(0, 60)}...`)
      console.log(`  URL: ${sample.url}`)
      console.log(`  Date: ${sample.date}`)
      console.log(`  Body length: ${sample.body?.length || 0} chars`)
      console.log(`  Has image: ${!!sample.coverImg}`)
      console.log(`  Author: ${sample.author}`)

      if (sample.body) {
        console.log(`  Body preview: ${sample.body.substring(0, 150)}...`)
      }
    }

    return { name, success: true, count: articles.length, duration }
  } catch (error) {
    console.error(`\n❌ ${name} failed:`, error.message)
    return { name, success: false, error: error.message }
  }
}

async function main() {
  console.log('Testing new scrapers...\n')

  const results = []

  // Test BBC
  results.push(await testScraper('BBC News Asia', scrapeBBCWithContent))

  // Test CGTN
  results.push(await testScraper('CGTN', scrapeCGTNWithContent))

  // Test Reuters
  results.push(await testScraper('Reuters', scrapeReutersWithContent))

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))

  for (const result of results) {
    if (result.success) {
      console.log(`✅ ${result.name}: ${result.count} articles (${result.duration}s)`)
    } else {
      console.log(`❌ ${result.name}: FAILED - ${result.error}`)
    }
  }

  const totalArticles = results.reduce((sum, r) => sum + (r.count || 0), 0)
  console.log(`\nTotal: ${totalArticles} articles from ${results.filter(r => r.success).length}/${results.length} sources`)
}

main().catch(console.error)
