// Debug single ONCC article extraction
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

const HDRS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Accept-Language': 'zh-HK,zh;q=0.9,en;q=0.8'
};

async function debugOnccArticle() {
  try {
    // Get a recent ONCC article URL
    console.log('Getting ONCC homepage for article URLs...');
    const { data: homepageData } = await axios.get('https://hk.on.cc/', { headers: HDRS, timeout: 10000 });
    const $ = cheerio.load(homepageData);
    
    let testUrl = '';
    $('a[href*="/cnt/"], a[href*="/bkn/"]').each((_, a) => {
      const $a = $(a);
      const title = $a.text().trim();
      let url = $a.attr('href');
      if (title && url && title.length > 15) {
        if (!url.startsWith('http')) url = `https://hk.on.cc${url}`;
        if (!testUrl) testUrl = url; // Get first valid URL
      }
    });
    
    if (!testUrl) {
      console.log('No article URLs found on homepage');
      return;
    }
    
    console.log(`Testing URL: ${testUrl}`);
    
    // Fetch the article
    const res = await axios.get(testUrl, {
      headers: HDRS,
      responseType: 'arraybuffer',
      timeout: 15000
    });

    // Detect charset
    const charset = (res.headers['content-type'] || '')
      .match(/charset=([^;]+)/i)?.[1]?.toLowerCase() || 'utf-8';
    
    console.log(`Detected charset: ${charset}`);

    const html = iconv.decode(res.data, charset);
    const $page = cheerio.load(html, { decodeEntities: false });

    // Remove unwanted elements
    $page('script, style, nav, header, footer, .share, .social, .ads').remove();

    console.log('\n=== TESTING CONTENT SELECTORS ===');
    
    const selectors = [
      '#articleContent',
      '.bknContentTxt', 
      '.article__content',
      '[itemprop="articleBody"]',
      'article'
    ];

    for (const sel of selectors) {
      const element = $page(sel);
      if (element.length > 0) {
        const textContent = element.text().trim();
        console.log(`\n--- Selector: ${sel} ---`);
        console.log(`Found elements: ${element.length}`);
        console.log(`Text length: ${textContent.length}`);
        if (textContent.length > 0) {
          console.log(`First 200 chars: "${textContent.substring(0, 200)}..."`);
          
          // Check if it contains problematic content
          const hasProblems = textContent.includes('Tweet') || 
                            textContent.includes('更多新聞短片') ||
                            /\d{4}年\d{2}月\d{2}日/.test(textContent) ||
                            /\s{10,}/.test(textContent);
          
          console.log(`Has formatting problems: ${hasProblems ? '✅ Yes' : '❌ No'}`);
          
          if (textContent.length > 80) {
            console.log('✅ This selector would be used');
            break;
          }
        }
      } else {
        console.log(`\n--- Selector: ${sel} ---`);
        console.log('❌ No elements found');
      }
    }
    
    // Test fallback paragraph extraction
    console.log(`\n--- Fallback: All paragraphs ---`);
    const paragraphs = $page('p').map((_, p) => $page(p).text().trim())
                                 .get().filter(x => x.length > 10);
    console.log(`Found ${paragraphs.length} paragraphs with >10 chars`);
    if (paragraphs.length > 0) {
      const joinedContent = paragraphs.join('\n\n');
      console.log(`Total length: ${joinedContent.length}`);
      console.log(`First 200 chars: "${joinedContent.substring(0, 200)}..."`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugOnccArticle();