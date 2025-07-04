// Test URL title extraction
function extractTitleFromUrl(url) {
  try {
    const urlObj = new URL(url)
    const domain = urlObj.hostname.replace('www.', '')
    
    // Common Hong Kong news sources mapping
    const domainTitles = {
      'i-cable.com': 'i-CABLE News',
      'singtaousa.com': 'Sing Tao USA',
      'singtao.ca': 'Sing Tao Canada',
      'hk01.com': 'HK01',
      'mingpao.com': 'Ming Pao',
      'scmp.com': 'South China Morning Post',
      'hongkongfp.com': 'Hong Kong Free Press',
      'rthk.hk': 'RTHK',
      'news.gov.hk': 'Hong Kong Government News',
      'info.gov.hk': 'Hong Kong Government News',
      'on.cc': 'Oriental Daily',
      'hket.com': 'Hong Kong Economic Times',
      'wenweipo.com': 'Wen Wei Po'
    }
    
    return domainTitles[domain] || domain
  } catch (error) {
    return 'News Source'
  }
}

// Test with the URLs from the debug log
const testUrls = [
  'https://www.i-cable.com/新聞資訊/364566/李夏茵獲任為醫管局行政總裁-8月生效-任期三年',
  'https://www.singtaousa.com/2025-07-02/醫衞局副局長李夏茵8-1轉任醫管局行政總裁-范婉雯/5268314',
  'https://www.singtao.ca/7198296/2025-07-02/news-醫衞局副局長李夏茵8.1轉任醫管局行政總裁++范婉雯接任醫衞局副局長/',
  'https://www.hk01.com/政情/60252936/李夏茵8-1起轉任醫管局總裁-范婉雯接任副醫衞局長',
  'https://news.mingpao.com/ins/港聞/article/20250702/s00001/1751444241204/醫衛局副局長李夏茵將轉任醫管局行政總裁-范婉雯接任副局長'
]

console.log('URL title extraction test:')
testUrls.forEach((url, index) => {
  const title = extractTitleFromUrl(url)
  const domain = new URL(url).hostname.replace('www.', '')
  console.log(`${index + 1}. ${title} (${domain})`)
})

// Simulate the source extraction logic
function extractMetadataSources(citations) {
  const sources = []
  const now = new Date().toISOString()
  
  citations.forEach((citation, index) => {
    let url, title, snippet
    if (typeof citation === 'string') {
      url = citation
      title = extractTitleFromUrl(url)
      snippet = ''
    } else if (citation.url) {
      url = citation.url
      title = citation.title || extractTitleFromUrl(url)
      snippet = citation.text || citation.snippet || ''
    }
    
    if (url) {
      try {
        sources.push({
          url: url,
          title: title,
          domain: new URL(url).hostname.replace('www.', ''),
          snippet: snippet,
          accessedAt: now
        })
      } catch (error) {
        console.warn('Invalid URL in citation:', url)
      }
    }
  })
  
  return sources
}

console.log('\nSource extraction from citations:')
const extractedSources = extractMetadataSources(testUrls)
console.log(`Extracted ${extractedSources.length} sources:`)
extractedSources.forEach((source, index) => {
  console.log(`${index + 1}. ${source.title} (${source.domain})`)
})