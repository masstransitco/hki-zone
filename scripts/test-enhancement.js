#!/usr/bin/env node
/**
 * Test script to verify enhanced perplexity article functionality
 * Run this after migration to test the AI enhancement format
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testEnhancement() {
  console.log('🧪 Testing enhanced perplexity article functionality...')
  
  try {
    // Test 1: Check if enhanced fields exist
    console.log('\n📋 Test 1: Checking enhanced fields...')
    const { data: articles, error } = await supabase
      .from('perplexity_news')
      .select('id, title, enhanced_title, summary, key_points, why_it_matters, structured_sources')
      .limit(5)
    
    if (error) {
      console.error('❌ Error accessing enhanced fields:', error)
      return
    }
    
    console.log(`✅ Found ${articles.length} articles with enhanced field access`)
    
    // Test 2: Show sample enhanced content
    const enhancedArticles = articles.filter(a => a.enhanced_title || a.summary || a.key_points || a.why_it_matters)
    
    if (enhancedArticles.length > 0) {
      console.log('\n📋 Test 2: Sample enhanced content...')
      enhancedArticles.slice(0, 2).forEach((article, index) => {
        console.log(`\n--- Article ${index + 1} ---`)
        console.log(`Original Title: ${article.title}`)
        console.log(`Enhanced Title: ${article.enhanced_title || 'Not set'}`)
        console.log(`Summary: ${article.summary || 'Not set'}`)
        console.log(`Key Points: ${article.key_points ? article.key_points.length + ' points' : 'Not set'}`)
        console.log(`Why It Matters: ${article.why_it_matters ? 'Set' : 'Not set'}`)
        console.log(`Structured Sources: ${article.structured_sources ? 'Set' : 'Not set'}`)
      })
    } else {
      console.log('\n⚠️  No enhanced articles found. Try enriching some articles first.')
    }
    
    // Test 3: Try to update an article with enhanced fields
    if (articles.length > 0) {
      console.log('\n📋 Test 3: Testing enhanced field update...')
      const testArticle = articles[0]
      
      const testUpdate = {
        enhanced_title: 'Test Enhanced Title',
        summary: 'This is a test summary for enhanced article format.',
        key_points: ['Test point 1', 'Test point 2', 'Test point 3'],
        why_it_matters: 'This matters because it tests the enhanced format.',
        structured_sources: {
          citations: ['https://test.com'],
          sources: [{ title: 'Test Source', url: 'https://test.com', domain: 'test.com' }],
          generated_at: new Date().toISOString()
        }
      }
      
      const { error: updateError } = await supabase
        .from('perplexity_news')
        .update(testUpdate)
        .eq('id', testArticle.id)
      
      if (updateError) {
        console.error('❌ Error updating with enhanced fields:', updateError)
      } else {
        console.log('✅ Successfully updated article with enhanced fields')
        
        // Revert the test changes
        await supabase
          .from('perplexity_news')
          .update({
            enhanced_title: testArticle.enhanced_title,
            summary: testArticle.summary,
            key_points: testArticle.key_points,
            why_it_matters: testArticle.why_it_matters,
            structured_sources: testArticle.structured_sources
          })
          .eq('id', testArticle.id)
      }
    }
    
    console.log('\n🎉 Enhanced perplexity article functionality test completed!')
    
  } catch (error) {
    console.error('💥 Test error:', error)
  }
}

testEnhancement()