#!/usr/bin/env node

/**
 * Detailed Perplexity Debug Script
 * Tests the full pipeline step by step
 */

const { perplexityHKNews } = require('./lib/perplexity-hk-news')
const { savePerplexityHeadlines } = require('./lib/supabase-server')

async function debugPerplexity() {
  console.log('🔍 Detailed Perplexity Debug Script')
  console.log('==================================\n')

  try {
    // Step 1: Test environment variables
    console.log('1️⃣ Checking Environment Variables:')
    console.log('   PERPLEXITY_API_KEY:', process.env.PERPLEXITY_API_KEY ? '✅ Set' : '❌ Missing')
    console.log('   SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing')
    console.log('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing')
    console.log('')

    // Step 2: Test Perplexity API call
    console.log('2️⃣ Testing Perplexity API Call:')
    const startTime = Date.now()
    
    try {
      const { headlines, totalCost } = await perplexityHKNews.fetchHKHeadlines()
      const duration = Date.now() - startTime
      
      console.log(`   ✅ API call successful in ${duration}ms`)
      console.log(`   📰 Generated ${headlines.length} headlines`)
      console.log(`   💰 Cost: $${totalCost.toFixed(6)}`)
      console.log('')

      // Step 3: Test database insertion
      console.log('3️⃣ Testing Database Insertion:')
      if (headlines.length > 0) {
        try {
          const { count } = await savePerplexityHeadlines(headlines)
          console.log(`   ✅ Database insertion successful`)
          console.log(`   💾 Saved ${count} headlines`)
          console.log('')

          // Step 4: Verify data was saved
          console.log('4️⃣ Verifying Saved Data:')
          const { supabaseAdmin } = require('./lib/supabase-server')
          const { data: savedData, error } = await supabaseAdmin
            .from('perplexity_news')
            .select('id, title, category, created_at')
            .order('created_at', { ascending: false })
            .limit(headlines.length)

          if (error) {
            console.log(`   ❌ Error verifying data: ${error.message}`)
          } else {
            console.log(`   ✅ Found ${savedData.length} recent headlines in database`)
            savedData.forEach((item, i) => {
              console.log(`      ${i + 1}. [${item.category}] ${item.title}`)
            })
          }

        } catch (dbError) {
          console.log(`   ❌ Database insertion failed: ${dbError.message}`)
          console.log('   📋 Headlines that failed to save:')
          headlines.forEach((h, i) => {
            console.log(`      ${i + 1}. [${h.category}] ${h.title}`)
          })
        }
      } else {
        console.log('   ⚠️ No headlines to save')
      }

    } catch (apiError) {
      console.log(`   ❌ API call failed: ${apiError.message}`)
      console.log(`   🕐 Duration: ${Date.now() - startTime}ms`)
    }

  } catch (error) {
    console.error('💥 Script failed:', error.message)
    console.error('🔍 Error details:', error)
  }
}

// Run the debug script
debugPerplexity().catch(console.error)