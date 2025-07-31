// Test source extraction from the sample article content
const sampleContent = `Hong Kong Retail Sales Rebound in May, Ending 14-Month Slump—Overall Market Still Lags

**Summary**
Hong Kong's retail sector saw a modest recovery in May 2025, with sales rising 2.4% year-on-year and breaking a 14-month streak of declines. Despite this improvement, total retail sales for the first five months of the year remain down 4.0% compared to 2024, highlighting the ongoing challenges facing the industry[3][5].

**Key Points**
• **Retail sales in May 2025 rose by 2.4% year-on-year to HK$31.3 billion**, outperforming expectations and marking the first monthly increase since early 2024[3][5].  
• **The cumulative retail sales for January–May 2025 are still 4.0% lower than the same period last year**, reflecting a slow and incomplete market recovery[3][5].  
• **Online retail sales accounted for 8.3% of May's total**, reaching HK$2.6 billion, a slight 0.3% increase from a year earlier; however, online sales for the first five months dropped 1.7% year-on-year[2].  
• **Retail sales volume (adjusted for inflation) in May grew 1.9% year-on-year**, but the volume for the first five months fell 5.5%, showing that consumer demand remains subdued[3].  
• **Typical visuals for this story would show busy shopping districts like Causeway Bay and Tsim Sha Tsui, as well as data charts from the Census and Statistics Department**—though no official images have been released yet[2][3].

**Why It Matters**
This tentative rebound signals a possible turning point for Hong Kong's retail sector, which has struggled with weak consumer sentiment, changing shopping habits, and slow tourism recovery since the pandemic. While May's uptick is encouraging, the persistent year-to-date decline underscores the need for continued policy support and adaptation by retailers. The sector's performance will have direct implications for employment, economic growth, and the city's broader efforts to revitalize local consumption and tourism[3][5].`;

function extractSources(content) {
  const sources = [];
  const now = new Date().toISOString();

  // Method 1: Extract citation patterns
  const citationPattern = /(?:according to|source:|per|via|from)\s+([^,\.\n\(]+)/gi;
  let match;
  while ((match = citationPattern.exec(content)) !== null) {
    const sourceName = match[1].trim();
    if (sourceName.length > 3 && sourceName.length < 100) {
      sources.push({
        url: '',
        title: sourceName,
        domain: 'citation',
        snippet: match[0],
        accessedAt: now
      });
    }
  }

  // Method 2: Extract news source patterns
  const newsSourcePatterns = [
    /(?:according to|reports|reported by|says|announced|stated by|per|via)\s+(?:the\s+)?([A-Z][A-Za-z\s&]+(?:News|Post|Times|Herald|Tribune|Journal|Press|Today|Daily|Weekly|Radio|TV|Broadcasting|Media|Agency|Department|Ministry|Government|Office|Bureau|Commission|Authority|Council|Reuters|Bloomberg|Associated Press|BBC|CNN|Wall Street Journal|Financial Times))/gi,
    /(?:the|a|an)\s+([A-Z][A-Za-z\s&]+(?:Department|Ministry|Government|Office|Bureau|Commission|Authority|Council))/gi,
    /([A-Z][A-Za-z\s&]+(?:Statistics Department|Census|Bureau|Commission|Authority|Council|Agency))/gi
  ];

  newsSourcePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const sourceName = match[1].trim();
      if (sourceName.length > 5 && sourceName.length < 80) {
        sources.push({
          url: '',
          title: sourceName,
          domain: 'news-source',
          snippet: match[0].substring(0, 150),
          accessedAt: now
        });
      }
    }
  });

  // Find citation numbers to see how many we should expect
  const citationNumbers = content.match(/\[\d+\]/g) || [];
  const uniqueNumbers = [...new Set(citationNumbers)].sort();
  
  console.log('Citation numbers found:', uniqueNumbers);
  console.log('Sources extracted:', sources.length);
  console.log('Sources:', sources.map(s => s.title));

  return sources;
}

extractSources(sampleContent);