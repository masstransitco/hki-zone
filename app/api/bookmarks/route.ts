import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// GET /api/bookmarks - Get user's bookmarks with pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = page * limit

    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 })
    }

    // Get user's bookmarks with article details
    const { data: bookmarksData, error: bookmarksError } = await supabase
      .from('bookmarks')
      .select('id, created_at, article_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (bookmarksError) {
      console.error('Error fetching bookmarks:', bookmarksError)
      return NextResponse.json({ error: 'Failed to fetch bookmarks' }, { status: 500 })
    }

    if (!bookmarksData || bookmarksData.length === 0) {
      return NextResponse.json({
        bookmarks: [],
        nextPage: null,
        totalCount: 0
      })
    }

    // Get article details for each bookmark
    const articleIds = bookmarksData.map(b => b.article_id)
    
    // Try articles table first (where current articles are stored)
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('id, title, summary, content, url, source, category, created_at, image_url')
      .in('id', articleIds)

    if (articlesError) {
      console.error('Error fetching article details:', articlesError)
      return NextResponse.json({ error: 'Failed to fetch article details' }, { status: 500 })
    }

    // Transform the data to match our Article interface
    const transformedBookmarks = bookmarksData.map(bookmark => {
      const article = articles?.find(a => a.id === bookmark.article_id)
      if (!article) return null

      return {
        id: article.id,
        title: article.title,
        summary: article.summary,
        content: article.content,
        url: article.url,
        source: article.source,
        category: article.category,
        publishedAt: article.created_at, // articles table uses created_at
        imageUrl: article.image_url,
        bookmarkId: bookmark.id,
        bookmarkedAt: bookmark.created_at
      }
    }).filter(Boolean) // Remove null entries

    // Check if there are more pages
    const nextPage = transformedBookmarks.length === limit ? page + 1 : null

    return NextResponse.json({
      bookmarks: transformedBookmarks,
      nextPage,
      totalCount: transformedBookmarks.length
    })

  } catch (error) {
    console.error('Error in GET /api/bookmarks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/bookmarks - Add a bookmark
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { articleId } = body

    if (!articleId) {
      return NextResponse.json({ error: 'Article ID is required' }, { status: 400 })
    }

    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 })
    }

    // Verify the article exists
    const { data: article, error: articleError } = await supabase
      .from('articles_unified')
      .select('id')
      .eq('id', articleId)
      .single()

    if (articleError || !article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Add bookmark
    const { data: bookmark, error: bookmarkError } = await supabase
      .from('bookmarks')
      .insert({
        user_id: user.id,
        article_id: articleId
      })
      .select()
      .single()

    if (bookmarkError) {
      if (bookmarkError.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'Article already bookmarked' }, { status: 409 })
      }
      console.error('Error adding bookmark:', bookmarkError)
      return NextResponse.json({ error: 'Failed to add bookmark' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      bookmark: {
        id: bookmark.id,
        articleId: bookmark.article_id,
        createdAt: bookmark.created_at
      }
    })

  } catch (error) {
    console.error('Error in POST /api/bookmarks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/bookmarks - Toggle bookmark status (add if not exists, remove if exists)
export async function PATCH(request: NextRequest) {
  console.log('📚 [BOOKMARK-TOGGLE] PATCH request received')
  
  try {
    const body = await request.json()
    const { articleId } = body

    console.log('📚 [BOOKMARK-TOGGLE] Article ID:', articleId)

    if (!articleId) {
      console.log('📚 [BOOKMARK-TOGGLE] Error: Missing article ID')
      return NextResponse.json({ error: 'Article ID is required' }, { status: 400 })
    }

    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('📚 [BOOKMARK-TOGGLE] Error: Missing auth header')
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.log('📚 [BOOKMARK-TOGGLE] Error: Invalid auth token', authError)
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 })
    }

    console.log('📚 [BOOKMARK-TOGGLE] User authenticated:', user.id)

    // Verify the article exists (check both tables for compatibility)
    let article, articleError
    
    // First try articles_unified table
    const { data: unifiedArticle, error: unifiedError } = await supabase
      .from('articles_unified')
      .select('id, title')
      .eq('id', articleId)
      .single()
    
    if (unifiedArticle) {
      article = unifiedArticle
      articleError = null
    } else {
      // Fall back to articles table
      const { data: regularArticle, error: regularError } = await supabase
        .from('articles')
        .select('id, title')
        .eq('id', articleId)
        .single()
      
      article = regularArticle
      articleError = regularError
    }

    if (articleError || !article) {
      console.log('📚 [BOOKMARK-TOGGLE] Error: Article not found', articleError)
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    console.log('📚 [BOOKMARK-TOGGLE] Article found:', article.title)

    // Check if bookmark already exists
    const { data: existingBookmark } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('user_id', user.id)
      .eq('article_id', articleId)
      .single()

    let isBookmarked: boolean

    if (existingBookmark) {
      // Remove bookmark
      const { error: deleteError } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('article_id', articleId)

      if (deleteError) {
        console.error('📚 [BOOKMARK-TOGGLE] Error removing bookmark:', deleteError)
        return NextResponse.json({ error: 'Failed to remove bookmark' }, { status: 500 })
      }

      isBookmarked = false
      console.log('📚 [BOOKMARK-TOGGLE] Bookmark removed successfully')
    } else {
      // Add bookmark
      const { error: insertError } = await supabase
        .from('bookmarks')
        .insert({
          user_id: user.id,
          article_id: articleId
        })

      if (insertError) {
        console.error('📚 [BOOKMARK-TOGGLE] Error adding bookmark:', insertError)
        return NextResponse.json({ error: 'Failed to add bookmark' }, { status: 500 })
      }

      isBookmarked = true
      console.log('📚 [BOOKMARK-TOGGLE] Bookmark added successfully')
    }

    return NextResponse.json({ 
      success: true,
      isBookmarked: !!isBookmarked,
      action: isBookmarked ? 'added' : 'removed',
      articleId,
      articleTitle: article.title
    })

  } catch (error) {
    console.error('📚 [BOOKMARK-TOGGLE] Error in PATCH /api/bookmarks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}