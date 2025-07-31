// Debug HK01 paragraph extraction
const HDRS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  "Accept-Language": "zh-HK,zh;q=0.9,en;q=0.8",
};

async function debugHK01Paragraphs() {
  try {
    // Test a specific HK01 article
    const testUrl = 'https://www.hk01.com/政情/60259654/審計報告-六成墮窗樓宇不在強制驗窗之列-帳委會倡好市民獎鼓勵';
    
    console.log('Testing HK01 paragraph extraction...');
    console.log('URL:', testUrl);
    
    const response = await fetch(testUrl, {
      headers: HDRS,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();

    // Remove unwanted elements (same as scraper)
    const cleanHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");

    console.log('\n=== TESTING PARAGRAPH EXTRACTION ===');
    
    // Test the current paragraph regex from the scraper
    const currentRegex = /<p[^>]*>([^<]+(?:<[^>]+>[^<]*<\/[^>]+>[^<]*)*)<\/p>/gi;
    const allParagraphs = cleanHtml.match(currentRegex);
    
    console.log(`Current regex found: ${allParagraphs ? allParagraphs.length : 0} paragraphs`);
    
    if (allParagraphs) {
      // Process them like the scraper does
      const content = allParagraphs
        .map((p) => p.replace(/<[^>]*>/g, "").trim())
        .filter((text) => text.length > 20);
      
      console.log(`After filtering (>20 chars): ${content.length} paragraphs`);
      console.log(`Total content length: ${content.join('\n\n').length} characters`);
      
      // Show first few paragraphs
      console.log('\nFirst 3 paragraphs:');
      content.slice(0, 3).forEach((para, i) => {
        console.log(`${i + 1}: "${para}"`);
      });
      
      // Show last paragraph to see if it's truncated
      if (content.length > 0) {
        console.log(`\nLast paragraph:`);
        console.log(`"${content[content.length - 1]}"`);
        
        const lastPara = content[content.length - 1];
        const endsCleanly = /[。！？\.]$/.test(lastPara);
        console.log(`Ends cleanly: ${endsCleanly ? '✅ Yes' : '❌ No'}`);
      }
    }
    
    // Test a more flexible paragraph regex
    console.log('\n=== TESTING IMPROVED PARAGRAPH EXTRACTION ===');
    const improvedRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    const improvedParagraphs = cleanHtml.match(improvedRegex);
    
    console.log(`Improved regex found: ${improvedParagraphs ? improvedParagraphs.length : 0} paragraphs`);
    
    if (improvedParagraphs) {
      const improvedContent = improvedParagraphs
        .map((p) => p.replace(/<[^>]*>/g, "").trim())
        .filter((text) => text.length > 20 && 
                         !text.includes('廣告') && 
                         !text.includes('相關文章') &&
                         !text.includes('分享'));
      
      console.log(`After improved filtering: ${improvedContent.length} paragraphs`);
      console.log(`Total improved content length: ${improvedContent.join('\n\n').length} characters`);
      
      if (improvedContent.length > content?.length) {
        console.log('🎯 Improved regex found more content!');
        console.log(`Last improved paragraph:`);
        console.log(`"${improvedContent[improvedContent.length - 1]}"`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugHK01Paragraphs();