import * as cheerio from 'cheerio'

// Direct test of the scraping logic
async function testScraping() {
  const url = 'http://www.td.gov.hk/tc/traffic_notices/index_id_82058.html'
  
  console.log(`Testing scraping of: ${url}\n`)
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HKI-Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8'
      }
    })
    
    if (!response.ok) {
      console.error(`Failed to fetch: ${response.status}`)
      return
    }
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    // TD notices have content in div.wrapfield
    const wrapfield = $('.wrapfield').first()
    
    if (wrapfield.length === 0) {
      console.error('No .wrapfield found')
      return
    }
    
    // Remove scripts and styles
    wrapfield.find('script, style').remove()
    
    // Get all paragraphs
    const paragraphs = wrapfield.find('p')
    console.log(`Found ${paragraphs.length} paragraphs`)
    
    // Extract text from each paragraph
    const contentParts: string[] = []
    paragraphs.each((i, elem) => {
      const text = $(elem).text().trim()
      if (text && text.length > 0) {
        contentParts.push(text)
        console.log(`Paragraph ${i + 1}: ${text.substring(0, 50)}...`)
      }
    })
    
    // Join with line breaks
    const content = contentParts.join('\n\n')
    
    console.log(`\nFinal content (${content.length} characters):\n`)
    console.log('---')
    console.log(content)
    console.log('---')
    
  } catch (error) {
    console.error('Error:', error)
  }
}

testScraping()