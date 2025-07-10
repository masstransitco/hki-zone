// Script to reset article status for re-enrichment with new contextual system
require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function resetArticleStatus(options = {}) {
  console.log('🔄 Resetting Article Status for Re-enrichment')
  console.log('============================================\n')
  
  const {
    limit = 10,
    category = null,
    resetAll = false,
    onlyFallback = true
  } = options
  
  try {
    // First, get current statistics
    console.log('📊 Current article statistics:')
    const { data: stats, error: statsError } = await supabase
      .from('perplexity_news')
      .select('article_status, count(*)')
    
    // Get counts by status
    const { data: pendingCount } = await supabase
      .from('perplexity_news')
      .select('id', { count: 'exact' })
      .eq('article_status', 'pending')
    
    const { data: enrichedCount } = await supabase
      .from('perplexity_news')
      .select('id', { count: 'exact' })
      .eq('article_status', 'enriched')
    
    const { data: readyCount } = await supabase
      .from('perplexity_news')
      .select('id', { count: 'exact' })
      .eq('article_status', 'ready')
    
    console.log(`   Pending: ${pendingCount?.length || 0} articles`)
    console.log(`   Enriched: ${enrichedCount?.length || 0} articles`)
    console.log(`   Ready: ${readyCount?.length || 0} articles`)
    console.log()
    
    // Build query for articles to reset
    let query = supabase
      .from('perplexity_news')
      .select('id, title, category, source, article_status, created_at')
    
    // Filter by status
    if (onlyFallback) {
      query = query.eq('source', 'Perplexity AI (Fallback)')
      console.log('🎯 Targeting only fallback articles')
    } else {
      query = query.in('article_status', ['ready', 'enriched'])
      console.log('🎯 Targeting all ready/enriched articles')
    }
    
    // Filter by category if specified
    if (category) {
      query = query.eq('category', category)
      console.log(`🎯 Filtering by category: ${category}`)
    }
    
    // Apply limit unless resetting all
    if (!resetAll) {
      query = query.limit(limit)
      console.log(`🎯 Limiting to ${limit} articles`)
    } else {
      console.log('🎯 Resetting ALL matching articles')
    }
    
    // Order by creation date (oldest first)
    query = query.order('created_at', { ascending: true })
    
    const { data: articles, error: fetchError } = await query
    
    if (fetchError) {
      console.error('❌ Error fetching articles:', fetchError)
      return
    }
    
    if (!articles || articles.length === 0) {
      console.log('ℹ️  No articles found matching criteria')
      return
    }
    
    console.log(`\n📋 Found ${articles.length} articles to reset:\n`)
    articles.forEach((article, i) => {
      console.log(`   ${i + 1}. [${article.category}] ${article.title}`)
      console.log(`      Status: ${article.article_status}, Source: ${article.source}`)
    })
    
    // Ask for confirmation
    console.log(`\n⚠️  This will reset ${articles.length} articles to 'pending' status`)
    console.log('   They will be re-enriched with the new contextual system')
    
    // Get article IDs
    const articleIds = articles.map(a => a.id)
    
    // Reset the articles
    console.log('\n🔄 Resetting article status...')
    const { data: updated, error: updateError } = await supabase
      .from('perplexity_news')
      .update({ 
        article_status: 'pending',
        // Clear existing enrichment data to force re-processing
        article_html: null,
        lede: null,
        enhanced_title: null,
        summary: null,
        key_points: null,
        why_it_matters: null,
        structured_sources: null,
        contextual_data: null
      })
      .in('id', articleIds)
      .select()
    
    if (updateError) {
      console.error('❌ Error updating articles:', updateError)
      return
    }
    
    console.log(`✅ Successfully reset ${updated?.length || 0} articles to pending status`)
    
    // Show next steps
    console.log('\n📌 Next Steps:')
    console.log('   1. Run the enrichment cron job or trigger it manually')
    console.log('   2. Articles will be enriched with contextual data')
    console.log('   3. Monitor the admin panel for progress')
    
  } catch (error) {
    console.error('💥 Unexpected error:', error)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const options = {
  limit: 10,
  category: null,
  resetAll: false,
  onlyFallback: true
}

// Parse arguments
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--limit':
      options.limit = parseInt(args[++i]) || 10
      break
    case '--category':
      options.category = args[++i]
      break
    case '--all':
      options.resetAll = true
      break
    case '--include-real':
      options.onlyFallback = false
      break
    case '--help':
      console.log('Usage: node reset-article-status.js [options]')
      console.log('\nOptions:')
      console.log('  --limit <n>      Number of articles to reset (default: 10)')
      console.log('  --category <cat> Reset only specific category')
      console.log('  --all            Reset all matching articles')
      console.log('  --include-real   Include non-fallback articles')
      console.log('\nExamples:')
      console.log('  node reset-article-status.js --limit 5')
      console.log('  node reset-article-status.js --category business --limit 20')
      console.log('  node reset-article-status.js --all --include-real')
      process.exit(0)
  }
}

// Run the reset
resetArticleStatus(options)