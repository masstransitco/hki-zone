import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseAIEnhancedContent } from '@/lib/content-parser'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { dryRun = false } = body

    console.log(`Starting AI enhanced articles cleanup (dry run: ${dryRun})...`)

    // Fetch all AI enhanced articles
    const { data: articles, error: fetchError } = await supabase
      .from('articles')
      .select('id, title, content, is_ai_enhanced')
      .eq('is_ai_enhanced', true)

    if (fetchError) {
      console.error('Error fetching AI enhanced articles:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch AI enhanced articles', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!articles || articles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No AI enhanced articles found',
        articlesProcessed: 0
      })
    }

    console.log(`Found ${articles.length} AI enhanced articles to process`)

    const processedArticles: Array<{
      id: string
      title: string
      hadEmbeddedSources: boolean
      originalLength: number
      cleanedLength: number
      updated: boolean
    }> = []

    // Process each article
    for (const article of articles) {
      if (!article.content) {
        processedArticles.push({
          id: article.id,
          title: article.title,
          hadEmbeddedSources: false,
          originalLength: 0,
          cleanedLength: 0,
          updated: false
        })
        continue
      }

      const originalContent = article.content
      const originalLength = originalContent.length

      // Parse content to remove embedded sources
      const parsed = parseAIEnhancedContent(originalContent)
      const cleanedContent = parsed.hasStructuredContent 
        ? reconstructCleanContent(parsed)
        : originalContent

      const cleanedLength = cleanedContent.length
      const hadEmbeddedSources = originalLength !== cleanedLength

      console.log(`Article ${article.id}: ${originalLength} -> ${cleanedLength} chars (${hadEmbeddedSources ? 'had sources' : 'clean'})`)

      let updated = false

      // Update article if sources were found and removed
      if (hadEmbeddedSources && !dryRun) {
        const { error: updateError } = await supabase
          .from('articles')
          .update({ 
            content: cleanedContent,
            updated_at: new Date().toISOString()
          })
          .eq('id', article.id)

        if (updateError) {
          console.error(`Failed to update article ${article.id}:`, updateError)
        } else {
          updated = true
          console.log(`✅ Updated article ${article.id}: ${article.title}`)
        }
      }

      processedArticles.push({
        id: article.id,
        title: article.title,
        hadEmbeddedSources,
        originalLength,
        cleanedLength,
        updated: updated || (dryRun && hadEmbeddedSources)
      })
    }

    // Generate summary statistics
    const stats = {
      totalArticles: articles.length,
      articlesWithEmbeddedSources: processedArticles.filter(a => a.hadEmbeddedSources).length,
      articlesUpdated: processedArticles.filter(a => a.updated).length,
      totalCharactersRemoved: processedArticles.reduce((sum, a) => sum + (a.originalLength - a.cleanedLength), 0)
    }

    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun 
        ? `Dry run completed: ${stats.articlesWithEmbeddedSources} articles would be cleaned`
        : `Migration completed: ${stats.articlesUpdated} articles cleaned`,
      stats,
      processedArticles: dryRun 
        ? processedArticles.filter(a => a.hadEmbeddedSources) 
        : processedArticles.filter(a => a.updated)
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper function to reconstruct clean content from parsed structure
function reconstructCleanContent(parsed: any): string {
  let content = ''

  // Add main content
  if (parsed.mainContent) {
    content += parsed.mainContent + '\n\n'
  }

  // Add structured sections with proper formatting
  if (parsed.summary) {
    content += '**Summary**\n' + parsed.summary + '\n\n'
  }

  if (parsed.keyPoints && parsed.keyPoints.length > 0) {
    content += '**Key Points**\n'
    parsed.keyPoints.forEach((point: string) => {
      content += '• ' + point + '\n'
    })
    content += '\n'
  }

  if (parsed.whyItMatters) {
    content += '**Why It Matters**\n' + parsed.whyItMatters + '\n\n'
  }

  return content.trim()
}

// GET endpoint to check how many articles need cleaning
export async function GET() {
  try {
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, content, is_ai_enhanced')
      .eq('is_ai_enhanced', true)

    if (error) {
      return NextResponse.json({
        error: 'Failed to fetch articles',
        details: error.message
      }, { status: 500 })
    }

    const articlesWithSources = articles?.filter(article => {
      if (!article.content) return false
      const parsed = parseAIEnhancedContent(article.content)
      return parsed.mainContent.length !== article.content.length
    }) || []

    return NextResponse.json({
      totalAiEnhancedArticles: articles?.length || 0,
      articlesNeedingCleaning: articlesWithSources.length,
      needsMigration: articlesWithSources.length > 0
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check migration status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}