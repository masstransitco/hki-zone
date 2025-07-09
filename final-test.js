// Test with real data structure
const realArticle = {
  id: "test-1",
  title: "Test Article", 
  citations: [
    "https://www.youtube.com/watch?v=Kkn8kV96A4A",
    "https://hongkongfp.com/2025/07/04/tropical-cyclone-closes-in-on-hong-kong-as-t1-warning-remains-in-force-until-noon-saturday-observatory-says/",
    "https://www.scmp.com/news/hong-kong",
    "https://www.jdsupra.com/legalnews/expansion-of-hong-kong-s-anti-bribery-9918796/",
    "https://www.sciencedaily.com/releases/2025/07/250707073351.htm"
  ],
  structured_sources: {
    sources: [],
    citations: [],
    generated_at: "2025-07-09T06:58:19.699Z"
  },
  created_at: "2025-07-09T06:00:00.000Z"
};

console.log("=== Testing Real Data Structure ===");
console.log(`Citations: ${realArticle.citations.length}`);
console.log(`Structured Sources: ${realArticle.structured_sources.sources.length}`);

// Test the fixed logic
function testTransform(article) {
  let sources = [];
  
  // First try structured_sources if available and not empty
  if (article.structured_sources?.sources && article.structured_sources.sources.length > 0) {
    sources = article.structured_sources.sources;
    console.log("✅ Using structured_sources");
  }
  // Fallback to citations for older articles
  else if (article.citations && article.citations.length > 0) {
    sources = article.citations.map((citation, index) => {
      let domain = "Unknown";
      let title = `Source ${index + 1}`;
      
      try {
        const url = new URL(citation);
        domain = url.hostname;
        title = `${domain} - Source ${index + 1}`;
      } catch {
        title = citation.length > 50 ? citation.substring(0, 50) + "..." : citation;
      }
      
      return {
        url: citation,
        title: title,
        domain: domain
      };
    });
    console.log("✅ Using citations fallback");
  }
  else {
    console.log("❌ No sources found");
  }
  
  return {
    isAiEnhanced: true,
    enhancementMetadata: {
      sources: sources
    }
  };
}

const result = testTransform(realArticle);
console.log(`\nResult: ${result.enhancementMetadata.sources.length} sources`);
console.log("Sample sources:", result.enhancementMetadata.sources.slice(0, 2).map(s => s.title));

// Test ArticleCard logic  
if (result.isAiEnhanced && result.enhancementMetadata?.sources?.length) {
  console.log(`\n🎉 SUCCESS: ArticleCard would show "${result.enhancementMetadata.sources.length} sources"`);
} else {
  console.log("\n❌ FAIL: ArticleCard would show 'Perplexity + AI'");
}