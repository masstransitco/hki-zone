import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

export async function POST(request: NextRequest) {
  try {
    const { articleId, reason = 'Manual admin selection' } = await request.json()

    if (!articleId) {
      return NextResponse.json(
        { error: 'Article ID is required' },
        { status: 400 }
      )
    }

    console.log(`Marking article ${articleId} for enhancement...`)
    
    // First, get the article details to check for duplicates
    const { data: targetArticle, error: fetchError } = await supabase
      .from('articles')
      .select('id, title, source, selected_for_enhancement, is_ai_enhanced')
      .eq('id', articleId)
      .single()
      
    if (fetchError || !targetArticle) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      )
    }
    
    // Check if already selected or enhanced
    if (targetArticle.selected_for_enhancement) {
      return NextResponse.json(
        { error: 'Article is already marked for enhancement' },
        { status: 400 }
      )
    }
    
    if (targetArticle.is_ai_enhanced) {
      return NextResponse.json(
        { error: 'Article has already been enhanced' },
        { status: 400 }
      )
    }
    
    // Check for recently selected similar titles
    const normalizedTitle = targetArticle.title.trim().toLowerCase().replace(/\s+/g, ' ').substring(0, 50)
    
    const { data: recentlySelected } = await supabase
      .from('articles')
      .select('id, title, selection_metadata')
      .eq('selected_for_enhancement', true)
      .neq('id', articleId)
      .gte('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()) // Last 3 days
      
    if (recentlySelected && recentlySelected.length > 0) {
      const duplicateFound = recentlySelected.find(article => {
        const otherTitle = article.title.trim().toLowerCase().replace(/\s+/g, ' ').substring(0, 50)
        return otherTitle === normalizedTitle
      })
      
      if (duplicateFound) {
        console.warn(`⚠️ Similar article already selected: "${duplicateFound.title}"`)
        return NextResponse.json(
          { 
            error: 'Similar article was recently selected',
            duplicate: {
              id: duplicateFound.id,
              title: duplicateFound.title,
              selectedAt: duplicateFound.selection_metadata?.selected_at
            }
          },
          { status: 400 }
        )
      }
    }

    // Generate standardized session ID
    const sessionId = `admin_selection_${Date.now()}_${Math.random().toString(36).substring(7)}`
    
    // Update the article to mark it for enhancement
    const { data, error } = await supabase
      .from('articles')
      .update({ 
        selected_for_enhancement: true,
        selection_metadata: {
          selected_at: new Date().toISOString(),
          selection_reason: reason,
          priority_score: 80,
          selection_method: 'manual_admin',
          selection_session: sessionId
        }
      })
      .eq('id', articleId)
      .eq('is_ai_enhanced', false) // Only mark non-enhanced articles
      .select('id, title, source')

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to mark article for enhancement' },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Article not found or already enhanced' },
        { status: 404 }
      )
    }

    const article = data[0]
    console.log(`✅ Marked "${article.title}" for enhancement`)

    return NextResponse.json({
      success: true,
      message: 'Article marked for enhancement',
      article: {
        id: article.id,
        title: article.title,
        source: article.source
      }
    })

  } catch (error) {
    console.error('Error marking article for enhancement:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}