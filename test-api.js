const fetch = require('node-fetch');

async function testPerplexityAPI() {
  try {
    const response = await fetch('http://localhost:3003/api/perplexity?page=0');
    const data = await response.json();
    
    console.log('=== Perplexity API Test ===');
    console.log(`Total articles: ${data.articles.length}`);
    
    const firstArticle = data.articles[0];
    console.log('\n--- First Article ---');
    console.log(`Title: ${firstArticle.title}`);
    console.log(`isAiEnhanced: ${firstArticle.isAiEnhanced}`);
    console.log(`Sources count: ${firstArticle.enhancementMetadata?.sources?.length || 0}`);
    
    if (firstArticle.enhancementMetadata?.sources?.length > 0) {
      console.log('\n--- Sources ---');
      firstArticle.enhancementMetadata.sources.forEach((source, i) => {
        console.log(`${i + 1}. ${source.title} (${source.domain})`);
        console.log(`   URL: ${source.url}`);
      });
    }
    
    // Check original citations
    console.log('\n--- Original Citations ---');
    console.log(`Citations count: ${firstArticle.citationsText?.split(',').length || 0}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testPerplexityAPI();