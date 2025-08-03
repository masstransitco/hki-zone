import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: brief, error } = await supabase
      .from('news_briefs')
      .select(`
        *,
        news_brief_articles(
          article_id,
          inclusion_reason,
          article_weight,
          articles(
            id,
            title,
            category,
            source
          )
        )
      `)
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching news brief:', error)
      throw error
    }

    if (!brief) {
      return NextResponse.json(
        { error: 'News brief not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      brief
    })

  } catch (error) {
    console.error('Error in news brief GET:', error)
    return NextResponse.json({
      error: 'Failed to fetch news brief',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const updates = await request.json()
    
    // Validate updates
    const allowedFields = [
      'title',
      'content', 
      'estimated_duration_seconds',
      'actual_word_count'
    ]
    
    const updateData: any = {}
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateData[key] = value
      }
    }
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Add updated timestamp
    updateData.updated_at = new Date().toISOString()

    const { data: brief, error } = await supabase
      .from('news_briefs')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating news brief:', error)
      throw error
    }

    if (!brief) {
      return NextResponse.json(
        { error: 'News brief not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      brief,
      message: 'News brief updated successfully'
    })

  } catch (error) {
    console.error('Error in news brief PATCH:', error)
    return NextResponse.json({
      error: 'Failed to update news brief',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // First check if the brief exists
    const { data: existingBrief, error: checkError } = await supabase
      .from('news_briefs')
      .select('id, title')
      .eq('id', params.id)
      .single()

    if (checkError || !existingBrief) {
      return NextResponse.json(
        { error: 'News brief not found' },
        { status: 404 }
      )
    }

    // Delete the brief (cascade will handle junction table)
    const { error: deleteError } = await supabase
      .from('news_briefs')
      .delete()
      .eq('id', params.id)

    if (deleteError) {
      console.error('Error deleting news brief:', deleteError)
      throw deleteError
    }

    return NextResponse.json({
      success: true,
      message: `News brief "${existingBrief.title}" deleted successfully`
    })

  } catch (error) {
    console.error('Error in news brief DELETE:', error)
    return NextResponse.json({
      error: 'Failed to delete news brief',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}