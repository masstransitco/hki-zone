import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withAuth } from '@/lib/auth-middleware'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// GET /api/bookmarks/[articleId] - Check if article is bookmarked  
export async function GET(
  request: NextRequest,
  { params }: { params: { articleId: string } }
) {
  return withAuth(request, async (req, { user }) => {
    try {
      const { articleId } = params

      // Check if article is bookmarked using direct query
      const { data: bookmark, error } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('user_id', user.id)
        .eq('article_id', articleId)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking bookmark status:', error)
        return NextResponse.json({ error: 'Failed to check bookmark status' }, { status: 500 })
      }

      return NextResponse.json({ 
        isBookmarked: !!bookmark,
        articleId 
      })

    } catch (error) {
      console.error('Error in GET /api/bookmarks/[articleId]:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}

// DELETE /api/bookmarks/[articleId] - Remove a bookmark
export async function DELETE(
  request: NextRequest,
  { params }: { params: { articleId: string } }
) {
  return withAuth(request, async (req, { user }) => {
    try {
      const { articleId } = params

      // Remove bookmark
      const { data, error: deleteError } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('article_id', articleId)
        .select()

      if (deleteError) {
        console.error('Error removing bookmark:', deleteError)
        return NextResponse.json({ error: 'Failed to remove bookmark' }, { status: 500 })
      }

      if (!data || data.length === 0) {
        return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 })
      }

      return NextResponse.json({ 
        success: true,
        message: 'Bookmark removed successfully',
        articleId
      })

    } catch (error) {
      console.error('Error in DELETE /api/bookmarks/[articleId]:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}