// Test script for Unsplash integration in the image search system
const { perplexityImageSearch } = require('./lib/perplexity-image-search.ts')

async function testUnsplashIntegration() {
  console.log('🧪 Testing Unsplash integration...')
  
  // Test basic image search with Unsplash priority
  const testQuery = "Hong Kong business district"
  const testCategory = "business"
  
  console.log(`\n🔍 Testing query: "${testQuery}" (category: ${testCategory})`)
  
  try {
    const result = await perplexityImageSearch.findImage(testQuery, testCategory)
    
    console.log('📸 Result:')
    console.log(`   Source: ${result.source}`)
    console.log(`   URL: ${result.url}`)
    console.log(`   License: ${result.license}`)
    console.log(`   Alt: ${result.alt}`)
    console.log(`   Attribution: ${result.attribution}`)
    
    if (result.source === 'unsplash') {
      console.log('✅ Unsplash integration working correctly!')
    } else {
      console.log(`⚠️ Fell back to: ${result.source}`)
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test
testUnsplashIntegration()