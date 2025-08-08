const { runSingleScraper } = require('./lib/scraper-orchestrator.ts');

async function main() {
  console.log('Starting The Standard scraper with database saving...');
  
  try {
    const result = await runSingleScraper('thestandard', true);
    
    console.log('\n=== Scraping Complete ===');
    console.log('Outlet:', result.outlet);
    console.log('Articles found:', result.articlesFound);
    console.log('Articles saved to database:', result.articlesSaved);
    
    if (result.articles && result.articles.length > 0) {
      console.log('\nFirst 3 articles saved:');
      result.articles.slice(0, 3).forEach((article, i) => {
        console.log(`\n${i + 1}. ${article.headline}`);
        console.log(`   URL: ${article.url}`);
        console.log(`   Source: ${article.source}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error running scraper:', error);
    process.exit(1);
  }
}

main();