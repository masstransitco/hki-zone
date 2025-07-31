// Test script for enhanced image search with uniqueness tracking
require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Test the image history tracking
async function testImageHistory() {
  console.log('🧪 Testing Image History Tracking System\n')
  
  // 1. Check if the image history table exists
  console.log('1️⃣ Checking image history table...')
  const { data: tables, error: tableError } = await supabase
    .from('perplexity_image_history')
    .select('id')
    .limit(1)
  
  if (tableError && tableError.code === '42P01') {
    console.log('❌ Image history table does not exist. Please run the migration:')
    console.log('   psql $DATABASE_URL -f scripts/add-perplexity-image-tracking.sql')
    return
  }
  
  console.log('✅ Image history table exists')
  
  // 2. Check recently used images
  console.log('\n2️⃣ Checking recently used images...')
  const { data: recentImages, error: recentError } = await supabase
    .from('perplexity_image_history')
    .select('image_url, category, image_source, used_at')
    .order('used_at', { ascending: false })
    .limit(10)
  
  if (recentError) {
    console.error('❌ Error fetching recent images:', recentError)
    return
  }
  
  console.log(`📊 Found ${recentImages?.length || 0} recent images:`)
  recentImages?.forEach((img, i) => {
    console.log(`   ${i + 1}. [${img.category}] ${img.image_source} - ${img.image_url.substring(0, 60)}...`)
    console.log(`      Used at: ${new Date(img.used_at).toLocaleString()}`)
  })
  
  // 3. Check for duplicate usage
  console.log('\n3️⃣ Checking for duplicate image usage...')
  const { data: duplicates, error: dupError } = await supabase
    .rpc('get_recent_used_images', { p_days: 7 })
  
  if (!dupError && duplicates) {
    const multiUseImages = duplicates.filter(img => img.used_count > 1)
    if (multiUseImages.length > 0) {
      console.log(`⚠️  Found ${multiUseImages.length} images used multiple times in last 7 days:`)
      multiUseImages.forEach(img => {
        console.log(`   - ${img.image_url.substring(0, 60)}... (used ${img.used_count} times)`)
      })
    } else {
      console.log('✅ No duplicate image usage in the last 7 days')
    }
  }
  
  // 4. Check category distribution
  console.log('\n4️⃣ Checking image distribution by category...')
  const categories = ['politics', 'business', 'tech', 'health', 'lifestyle', 'entertainment']
  
  for (const category of categories) {
    const { data: catImages, error: catError } = await supabase
      .from('perplexity_image_history')
      .select('id')
      .eq('category', category)
      .gte('used_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    
    if (!catError) {
      console.log(`   ${category}: ${catImages?.length || 0} images used`)
    }
  }
  
  // 5. Test image uniqueness check
  console.log('\n5️⃣ Testing image uniqueness check...')
  const testImageUrl = 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=400&fit=crop&q=80'
  
  const { data: isUsed, error: checkError } = await supabase
    .rpc('is_image_recently_used', { 
      p_image_url: testImageUrl,
      p_days: 7 
    })
  
  if (!checkError) {
    console.log(`   Test image recently used: ${isUsed ? '❌ YES' : '✅ NO'}`)
  }
  
  console.log('\n✅ Image history tracking test completed!')
}

// Test the enhanced search functionality
async function testEnhancedSearch() {
  console.log('\n\n🧪 Testing Enhanced Image Search Features\n')
  
  // Import the search module
  const { PerplexityImageSearch } = require('./lib/perplexity-image-search')
  const imageSearch = new PerplexityImageSearch()
  
  const testQueries = [
    { 
      query: "Hong Kong government announces new housing policy for young families",
      category: "politics"
    },
    {
      query: "Hong Kong Stock Exchange sees record trading volume in tech stocks",
      category: "business"
    },
    {
      query: "Hong Kong hospitals upgrade emergency response systems",
      category: "health"
    }
  ]
  
  console.log('🔍 Running enhanced searches with uniqueness checking...\n')
  
  for (const test of testQueries) {
    console.log(`📝 Testing: "${test.query}"`)
    console.log(`   Category: ${test.category}`)
    
    try {
      const result = await imageSearch.findImage(test.query, test.category)
      console.log(`   ✅ Found image:`)
      console.log(`      Source: ${result.source}`)
      console.log(`      URL: ${result.url.substring(0, 80)}...`)
      console.log(`      Alt: ${result.alt}`)
      console.log(`      Attribution: ${result.attribution}`)
    } catch (error) {
      console.error(`   ❌ Search failed:`, error.message)
    }
    
    console.log()
  }
  
  console.log('✅ Enhanced search test completed!')
}

// Run tests
async function runTests() {
  try {
    await testImageHistory()
    await testEnhancedSearch()
  } catch (error) {
    console.error('💥 Test failed:', error)
  }
}

runTests()