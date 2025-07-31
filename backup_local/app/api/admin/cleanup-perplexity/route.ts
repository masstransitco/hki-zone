import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "../../../../lib/supabase-server"

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Starting Perplexity news cleanup...')
    
    // Get all articles
    const { data: articles, error } = await supabaseAdmin
      .from('perplexity_news')
      .select('*')
      .order('inserted_at', { ascending: true })
    
    if (error) {
      console.error('Error fetching articles:', error)
      return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 })
    }
    
    console.log(`📊 Found ${articles.length} total articles`)
    
    // Group by title to find duplicates
    const titleGroups: Record<string, any[]> = {}
    articles.forEach(article => {
      const title = article.title.toLowerCase().trim()
      if (!titleGroups[title]) {
        titleGroups[title] = []
      }
      titleGroups[title].push(article)
    })
    
    // Find duplicates and keep only the latest one
    let removedCount = 0
    for (const [title, group] of Object.entries(titleGroups)) {
      if (group.length > 1) {
        console.log(`🔍 Found ${group.length} duplicates for: "${group[0].title}"`)
        
        // Sort by creation date, keep the latest (last one)
        group.sort((a, b) => new Date(a.inserted_at).getTime() - new Date(b.inserted_at).getTime())
        const toRemove = group.slice(0, -1) // Remove all but the last one
        
        for (const article of toRemove) {
          console.log(`❌ Removing duplicate: ${article.id} (${article.inserted_at})`)
          const { error: deleteError } = await supabaseAdmin
            .from('perplexity_news')
            .delete()
            .eq('id', article.id)
          
          if (deleteError) {
            console.error(`Error removing article ${article.id}:`, deleteError)
          } else {
            removedCount++
          }
        }
      }
    }
    
    // Also remove fallback articles
    const { error: fallbackError } = await supabaseAdmin
      .from('perplexity_news')
      .delete()
      .eq('source', 'Perplexity AI (Fallback)')
    
    if (fallbackError) {
      console.error('Error removing fallback articles:', fallbackError)
    } else {
      console.log(`✅ Removed fallback articles`)
    }
    
    return NextResponse.json({
      success: true,
      message: `Removed ${removedCount} duplicate articles and all fallback articles`,
      removedDuplicates: removedCount
    })
    
  } catch (error) {
    console.error('Error in cleanup:', error)
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 })
  }
}