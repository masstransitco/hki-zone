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
          selection_session: Date.now()
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