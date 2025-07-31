// Test the transformation manually
const testArticle = {
  id: "test-1",
  title: "Test Article",
  category: "business",
  url: "https://example.com/test",
  published_at: "2025-07-09T00:00:00Z",
  created_at: "2025-07-09T00:00:00Z",
  article_status: "ready",
  image_status: "ready",
  article_html: "<p>Test content</p>",
  source: "Perplexity AI",
  author: "AI Generated",
  citations: [
    "https://example.com/source1",
    "https://example.com/source2",
    "https://example.com/source3"
  ],
  structured_sources: {
    sources: [],
    citations: [],
    generated_at: "2025-07-09T00:00:00Z"
  }
};

// Mock the transformation function logic
function mockTransformPerplexityToArticle(perplexityArticle) {
  // Get sources using the same logic as in the real function
  let sources = [];
  
  // First try structured_sources if available and not empty
  if (perplexityArticle.structured_sources?.sources && perplexityArticle.structured_sources.sources.length > 0) {
    sources = perplexityArticle.structured_sources.sources.map(source => ({
      url: source.url,
      title: source.title,
      domain: source.domain || "Unknown",
      snippet: source.description,
      accessedAt: perplexityArticle.structured_sources?.generated_at || perplexityArticle.created_at,
    }));
  }
  // Fallback to citations
  else if (perplexityArticle.citations && perplexityArticle.citations.length > 0) {
    sources = perplexityArticle.citations.map((citation, index) => {
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
        domain: domain,
        snippet: undefined,
        accessedAt: perplexityArticle.created_at,
      };
    });
  }
  
  return {
    id: perplexityArticle.id,
    title: perplexityArticle.title,
    isAiEnhanced: true,
    source: perplexityArticle.source,
    enhancementMetadata: {
      sources: sources
    }
  };
}

console.log("=== Testing Transformation ===");
const result = mockTransformPerplexityToArticle(testArticle);
console.log(`Title: ${result.title}`);
console.log(`isAiEnhanced: ${result.isAiEnhanced}`);
console.log(`Sources count: ${result.enhancementMetadata.sources.length}`);
console.log(`Sources:`, result.enhancementMetadata.sources.map(s => s.title));

// Test the ArticleCard logic
if (result.isAiEnhanced && result.enhancementMetadata?.sources?.length) {
  console.log(`\n✅ ArticleCard would show: InlineSourcesBadge with ${result.enhancementMetadata.sources.length} sources`);
} else {
  console.log(`\n❌ ArticleCard would show: ${result.source.replace(' (AI Enhanced)', '')} + AI`);
}