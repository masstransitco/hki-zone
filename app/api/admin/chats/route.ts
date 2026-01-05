import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const operation = searchParams.get('operation') || 'list'
    const page = parseInt(searchParams.get('page') || '0')
    const limit = parseInt(searchParams.get('limit') || '50')
    const userId = searchParams.get('userId')
    const articleId = searchParams.get('articleId')

    const startTime = Date.now()

    switch (operation) {
      case 'list':
        return await handleList(page, limit, userId, articleId, startTime)
      case 'stats':
        return await handleStats(startTime)
      case 'conversations':
        return await handleConversations(page, limit, startTime)
      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 })
    }
  } catch (error) {
    console.error('Admin chats API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chat data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function handleList(page: number, limit: number, userId: string | null, articleId: string | null, startTime: number) {
  let query = supabaseAdmin
    .from('article_chats')
    .select(`
      id,
      user_id,
      article_id,
      role,
      content,
      created_at
    `)
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1)

  if (userId) {
    query = query.eq('user_id', userId)
  }
  if (articleId) {
    query = query.eq('article_id', articleId)
  }

  const { data, error, count } = await query

  if (error) {
    throw error
  }

  return NextResponse.json({
    messages: data || [],
    page,
    limit,
    _metadata: {
      operation: 'list',
      executionTime: Date.now() - startTime
    }
  })
}

async function handleStats(startTime: number) {
  // Get overall stats
  const { data: statsData, error: statsError } = await supabaseAdmin
    .rpc('get_chat_stats')
    .single()

  // Fallback if RPC doesn't exist
  if (statsError) {
    const { data: rawData } = await supabaseAdmin
      .from('article_chats')
      .select('id, user_id, article_id, role, created_at')

    const messages = rawData || []
    const uniqueUsers = new Set(messages.map(m => m.user_id))
    const uniqueArticles = new Set(messages.map(m => m.article_id))
    const userMessages = messages.filter(m => m.role === 'user').length
    const assistantMessages = messages.filter(m => m.role === 'assistant').length

    // Messages by day (last 7 days)
    const now = new Date()
    const messagesByDay: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      messagesByDay[dateStr] = 0
    }

    messages.forEach(m => {
      const dateStr = new Date(m.created_at).toISOString().split('T')[0]
      if (messagesByDay[dateStr] !== undefined) {
        messagesByDay[dateStr]++
      }
    })

    return NextResponse.json({
      stats: {
        totalMessages: messages.length,
        uniqueUsers: uniqueUsers.size,
        articlesDiscussed: uniqueArticles.size,
        userMessages,
        assistantMessages,
        messagesByDay: Object.entries(messagesByDay).map(([date, count]) => ({ date, count }))
      },
      _metadata: {
        operation: 'stats',
        executionTime: Date.now() - startTime
      }
    })
  }

  return NextResponse.json({
    stats: statsData,
    _metadata: {
      operation: 'stats',
      executionTime: Date.now() - startTime
    }
  })
}

async function handleConversations(page: number, limit: number, startTime: number) {
  // Get grouped conversations by user + article
  const { data, error } = await supabaseAdmin
    .from('article_chats')
    .select('user_id, article_id, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  // Group by user_id + article_id to get unique conversations
  const conversationMap = new Map<string, { user_id: string; article_id: string; first_message: string; message_count: number }>()

  const messages = data || []
  messages.forEach(msg => {
    const key = `${msg.user_id}:${msg.article_id}`
    if (!conversationMap.has(key)) {
      conversationMap.set(key, {
        user_id: msg.user_id,
        article_id: msg.article_id,
        first_message: msg.created_at,
        message_count: 1
      })
    } else {
      const conv = conversationMap.get(key)!
      conv.message_count++
      if (new Date(msg.created_at) < new Date(conv.first_message)) {
        conv.first_message = msg.created_at
      }
    }
  })

  const conversations = Array.from(conversationMap.values())
    .sort((a, b) => new Date(b.first_message).getTime() - new Date(a.first_message).getTime())
    .slice(page * limit, (page + 1) * limit)

  return NextResponse.json({
    conversations,
    total: conversationMap.size,
    page,
    limit,
    _metadata: {
      operation: 'conversations',
      executionTime: Date.now() - startTime
    }
  })
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const messageId = searchParams.get('id')
    const userId = searchParams.get('userId')
    const articleId = searchParams.get('articleId')

    if (messageId) {
      // Delete single message
      const { error } = await supabaseAdmin
        .from('article_chats')
        .delete()
        .eq('id', messageId)

      if (error) throw error
      return NextResponse.json({ success: true, deleted: 1 })
    }

    if (userId && articleId) {
      // Delete all messages in a conversation
      const { error, count } = await supabaseAdmin
        .from('article_chats')
        .delete()
        .eq('user_id', userId)
        .eq('article_id', articleId)

      if (error) throw error
      return NextResponse.json({ success: true, deleted: count })
    }

    return NextResponse.json({ error: 'Missing id or userId+articleId' }, { status: 400 })
  } catch (error) {
    console.error('Delete chat error:', error)
    return NextResponse.json(
      { error: 'Failed to delete', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
