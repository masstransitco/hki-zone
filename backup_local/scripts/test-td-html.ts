// Simple test to fetch and examine TD notice HTML
async function testFetchTDNotice() {
  const url = 'http://www.td.gov.hk/tc/traffic_notices/index_id_82058.html'
  
  console.log(`Fetching: ${url}\n`)
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HKI-Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8'
      }
    })
    
    console.log(`Status: ${response.status}`)
    console.log(`Content-Type: ${response.headers.get('content-type')}`)
    
    if (!response.ok) {
      console.error('Failed to fetch page')
      return
    }
    
    const html = await response.text()
    console.log(`\nHTML Length: ${html.length} characters`)
    
    // Save to file for inspection
    const fs = await import('fs/promises')
    await fs.writeFile('td-notice-sample.html', html)
    console.log('\nHTML saved to td-notice-sample.html')
    
    // Quick content check
    console.log('\nSearching for key content...')
    
    // Look for the notice content
    if (html.includes('駕駛人士請注意')) {
      console.log('✓ Found "駕駛人士請注意"')
      
      // Extract a snippet around this text
      const startIndex = html.indexOf('駕駛人士請注意')
      const snippet = html.substring(Math.max(0, startIndex - 200), Math.min(html.length, startIndex + 500))
      console.log('\nContent snippet:')
      console.log('---')
      console.log(snippet)
      console.log('---')
    }
    
    // Check for common TD page structures
    const patterns = [
      '<td class="content"',
      '<div class="content"',
      '<div id="content"',
      '<table',
      '連翔道',
      '青沙公路'
    ]
    
    console.log('\nChecking for common patterns:')
    patterns.forEach(pattern => {
      if (html.includes(pattern)) {
        console.log(`✓ Found: ${pattern}`)
      } else {
        console.log(`✗ Not found: ${pattern}`)
      }
    })
    
  } catch (error) {
    console.error('Error:', error)
  }
}

testFetchTDNotice()