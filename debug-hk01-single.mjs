// Debug single HK01 article extraction
const HDRS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  "Accept-Language": "zh-HK,zh;q=0.9,en;q=0.8",
};

async function debugHK01Article() {
  try {
    // Test a specific HK01 article
    const testUrl = 'https://www.hk01.com/政情/60259654/審計報告-六成墮窗樓宇不在強制驗窗之列-帳委會倡好市民獎鼓勵';
    
    console.log('Testing HK01 article extraction...');
    console.log('URL:', testUrl);
    
    const response = await fetch(testUrl, {
      headers: HDRS,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();

    // Remove unwanted elements
    const cleanHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");

    console.log('\n=== TESTING CONTENT SELECTORS ===');
    
    // Test the selectors used in the scraper
    const contentSelectors = [
      "content-article-content",
      "article-content", 
      "content-body",
      "entry-content",
      "post-content",
    ];

    for (const selector of contentSelectors) {
      console.log(`\n--- Testing selector: ${selector} ---`);
      
      // Test the current regex approach
      const contentRegex = new RegExp(`<div[^>]*class="[^"]*${selector}[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`, "i");
      const contentMatch = cleanHtml.match(contentRegex);
      
      if (contentMatch) {
        const extracted = contentMatch[1].trim();
        console.log(`✅ Found content with current regex`);
        console.log(`   Length: ${extracted.length} characters`);
        console.log(`   First 100 chars: "${extracted.substring(0, 100)}..."`);
        console.log(`   Last 100 chars: "...${extracted.substring(Math.max(0, extracted.length - 100))}"`);
        
        // Check for nested divs that might be causing truncation
        const nestedDivs = (extracted.match(/<\/div>/gi) || []).length;
        console.log(`   Contains ${nestedDivs} closing div tags`);
        
        // Test improved regex with better div matching
        const improvedRegex = new RegExp(`<div[^>]*class="[^"]*${selector}[^"]*"[^>]*>([\\s\\S]*)<\\/div>(?![\\s\\S]*<div[^>]*class="[^"]*${selector}[^"]*")`, "i");
        const improvedMatch = cleanHtml.match(improvedRegex);
        
        if (improvedMatch && improvedMatch[1].length > extracted.length) {
          console.log(`   🎯 Improved regex found more content: ${improvedMatch[1].length} chars`);
        }
        
        break; // Found content with this selector
      } else {
        console.log(`❌ No match found`);
      }
    }
    
    // Also test for any div with "article" in the class name
    console.log(`\n--- Testing general article divs ---`);
    const articleDivs = cleanHtml.match(/<div[^>]*class="[^"]*article[^"]*"[^>]*>/gi) || [];
    console.log(`Found ${articleDivs.length} divs with 'article' in class name:`);
    articleDivs.slice(0, 3).forEach((div, i) => {
      console.log(`  ${i + 1}: ${div}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugHK01Article();