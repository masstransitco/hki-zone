"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  MessageSquare,
  Users,
  FileText,
  TrendingUp,
  RefreshCw,
  Search,
  Trash2,
  ChevronRight,
  Bot,
  User,
  Calendar,
  AlertCircle,
  Loader2,
  Activity,
  Globe,
  Zap,
  Clock,
  Database
} from "lucide-react"
import { toast } from "sonner"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts"

interface ChatMessage {
  id: string
  user_id: string
  article_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface ChatStats {
  totalMessages: number
  uniqueUsers: number
  articlesDiscussed: number
  userMessages: number
  assistantMessages: number
  messagesByDay: Array<{ date: string; count: number }>
}

interface Conversation {
  user_id: string
  article_id: string
  first_message: string
  message_count: number
}

interface ChatLog {
  id: string
  article_id: string
  user_id: string
  search_triggered: boolean
  search_reason: string | null
  search_query: string | null
  search_cached: boolean
  search_results: {
    answer?: string
    results?: Array<{ title: string; url: string; snippet: string }>
    cached?: boolean
    preview?: string
  } | null
  search_duration_ms: number | null
  model_used: string
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  llm_duration_ms: number | null
  total_duration_ms: number
  created_at: string
}

interface LogsSummary {
  totalLogs: number
  searchTriggered: number
  searchRate: number
  totalTokens: number
  avgDuration: number
}

async function fetchChatStats(): Promise<ChatStats> {
  const res = await fetch('/api/admin/chats?operation=stats')
  if (!res.ok) throw new Error('Failed to fetch stats')
  const data = await res.json()
  return data.stats
}

async function fetchConversations(page: number = 0): Promise<{ conversations: Conversation[]; total: number }> {
  const res = await fetch(`/api/admin/chats?operation=conversations&page=${page}&limit=20`)
  if (!res.ok) throw new Error('Failed to fetch conversations')
  const data = await res.json()
  return { conversations: data.conversations, total: data.total }
}

async function fetchMessages(userId?: string, articleId?: string): Promise<ChatMessage[]> {
  const params = new URLSearchParams({ operation: 'list', limit: '100' })
  if (userId) params.set('userId', userId)
  if (articleId) params.set('articleId', articleId)

  const res = await fetch(`/api/admin/chats?${params}`)
  if (!res.ok) throw new Error('Failed to fetch messages')
  const data = await res.json()
  return data.messages
}

async function deleteConversation(userId: string, articleId: string) {
  const res = await fetch(`/api/admin/chats?userId=${userId}&articleId=${articleId}`, {
    method: 'DELETE'
  })
  if (!res.ok) throw new Error('Failed to delete conversation')
  return res.json()
}

async function fetchLogs(page: number = 0): Promise<{ logs: ChatLog[]; summary: LogsSummary }> {
  const res = await fetch(`/api/admin/chats?operation=logs&page=${page}&limit=50`)
  if (!res.ok) throw new Error('Failed to fetch logs')
  const data = await res.json()
  return { logs: data.logs, summary: data.summary }
}

export default function AdminChatPage() {
  const queryClient = useQueryClient()
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['adminChatStats'],
    queryFn: fetchChatStats,
    refetchInterval: 30000 // Refresh every 30s
  })

  // Fetch conversations
  const { data: conversationsData, isLoading: conversationsLoading, refetch: refetchConversations } = useQuery({
    queryKey: ['adminChatConversations'],
    queryFn: () => fetchConversations(0),
    refetchInterval: 30000
  })

  // Fetch messages for selected conversation
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['adminChatMessages', selectedConversation?.user_id, selectedConversation?.article_id],
    queryFn: () => fetchMessages(selectedConversation?.user_id, selectedConversation?.article_id),
    enabled: !!selectedConversation
  })

  // Fetch agent process logs
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['adminChatLogs'],
    queryFn: () => fetchLogs(0),
    refetchInterval: 30000
  })

  // Selected log for detail view
  const [selectedLog, setSelectedLog] = useState<ChatLog | null>(null)

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: ({ userId, articleId }: { userId: string; articleId: string }) =>
      deleteConversation(userId, articleId),
    onSuccess: () => {
      toast.success('Conversation deleted')
      setSelectedConversation(null)
      queryClient.invalidateQueries({ queryKey: ['adminChatConversations'] })
      queryClient.invalidateQueries({ queryKey: ['adminChatStats'] })
    },
    onError: () => {
      toast.error('Failed to delete conversation')
    }
  })

  const handleRefresh = () => {
    refetchStats()
    refetchConversations()
    refetchLogs()
    toast.success('Data refreshed')
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatShortDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Chat Management</h1>
          <p className="text-gray-400 mt-1">Monitor and manage article discussions</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Messages</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {statsLoading ? '...' : stats?.totalMessages || 0}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Active Users</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {statsLoading ? '...' : stats?.uniqueUsers || 0}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Articles Discussed</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {statsLoading ? '...' : stats?.articlesDiscussed || 0}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Avg Messages/Conv</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {statsLoading ? '...' :
                    stats?.articlesDiscussed
                      ? (stats.totalMessages / stats.articlesDiscussed).toFixed(1)
                      : '0'}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Chart */}
      {stats?.messagesByDay && stats.messagesByDay.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Message Activity (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.messagesByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    stroke="#9ca3af"
                    tickFormatter={formatShortDate}
                  />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations List */}
        <Card className="bg-gray-900 border-gray-800 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversations
            </CardTitle>
            <CardDescription className="text-gray-400">
              {conversationsData?.total || 0} total conversations
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {conversationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : conversationsData?.conversations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No conversations yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800 max-h-[500px] overflow-y-auto">
                {conversationsData?.conversations.map((conv) => (
                  <button
                    key={`${conv.user_id}:${conv.article_id}`}
                    onClick={() => setSelectedConversation(conv)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-800/50 transition-colors ${
                      selectedConversation?.user_id === conv.user_id &&
                      selectedConversation?.article_id === conv.article_id
                        ? 'bg-gray-800'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">
                          Article: {conv.article_id.slice(0, 8)}...
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          User: {conv.user_id.slice(0, 8)}...
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-gray-800">
                          {conv.message_count} msgs
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      {formatDate(conv.first_message)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversation Detail */}
        <Card className="bg-gray-900 border-gray-800 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white">
                {selectedConversation ? 'Conversation Details' : 'Select a Conversation'}
              </CardTitle>
              {selectedConversation && (
                <CardDescription className="text-gray-400 mt-1">
                  Article: {selectedConversation.article_id}
                </CardDescription>
              )}
            </div>
            {selectedConversation && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate({
                  userId: selectedConversation.user_id,
                  articleId: selectedConversation.article_id
                })}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </>
                )}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!selectedConversation ? (
              <div className="text-center py-12 text-gray-500">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p>Select a conversation to view messages</p>
              </div>
            ) : messagesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {messages?.sort((a, b) =>
                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                ).map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === 'user' ? '' : 'flex-row-reverse'}`}
                  >
                    <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                      msg.role === 'user' ? 'bg-blue-500/20' : 'bg-green-500/20'
                    }`}>
                      {msg.role === 'user' ? (
                        <User className="h-4 w-4 text-blue-500" />
                      ) : (
                        <Bot className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <div className={`flex-1 ${msg.role === 'user' ? 'pr-12' : 'pl-12'}`}>
                      <div className={`rounded-lg p-3 ${
                        msg.role === 'user'
                          ? 'bg-blue-500/10 border border-blue-500/20'
                          : 'bg-gray-800 border border-gray-700'
                      }`}>
                        <p className="text-sm text-gray-200 whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agent Process Logs */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Agent Process Logs
              </CardTitle>
              <CardDescription className="text-gray-400 mt-1">
                Track agent decisions, web searches, and LLM usage
              </CardDescription>
            </div>
            {logsData?.summary && (
              <div className="flex gap-4 text-sm">
                <div className="text-center">
                  <p className="text-gray-400">Search Rate</p>
                  <p className="text-lg font-bold text-blue-400">{logsData.summary.searchRate}%</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400">Total Tokens</p>
                  <p className="text-lg font-bold text-green-400">{logsData.summary.totalTokens.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400">Avg Duration</p>
                  <p className="text-lg font-bold text-amber-400">{logsData.summary.avgDuration}ms</p>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : !logsData?.logs.length ? (
            <div className="text-center py-8 text-gray-500">
              <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No agent logs yet. Logs will appear when users chat with articles.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Logs List */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {logsData.logs.map((log) => (
                  <button
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedLog?.id === log.id
                        ? 'bg-gray-800 border-blue-500'
                        : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {log.search_triggered ? (
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                            <Globe className="h-3 w-3 mr-1" />
                            Search
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-700 text-gray-400">
                            <Zap className="h-3 w-3 mr-1" />
                            Direct
                          </Badge>
                        )}
                        {log.search_cached && (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            <Database className="h-3 w-3 mr-1" />
                            Cached
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {log.total_tokens || 0} tokens
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      Article: {log.article_id.slice(0, 8)}...
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      {log.total_duration_ms}ms
                      <span className="text-gray-600">•</span>
                      {formatDate(log.created_at)}
                    </div>
                  </button>
                ))}
              </div>

              {/* Log Detail */}
              <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
                {!selectedLog ? (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>Select a log to view details</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Decision</h4>
                      <div className="flex items-center gap-2">
                        <Badge className={selectedLog.search_triggered ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-400'}>
                          {selectedLog.search_triggered ? 'Web Search Triggered' : 'Direct Response'}
                        </Badge>
                        {selectedLog.search_reason && (
                          <span className="text-xs text-gray-500">
                            Reason: {selectedLog.search_reason}
                          </span>
                        )}
                      </div>
                    </div>

                    {selectedLog.search_triggered && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Search Query</h4>
                        <p className="text-sm text-gray-300 bg-gray-900 p-2 rounded">
                          {selectedLog.search_query || 'N/A'}
                        </p>
                        {selectedLog.search_results?.results && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-500 mb-1">Sources found:</p>
                            <div className="space-y-1">
                              {selectedLog.search_results.results.slice(0, 3).map((r, i) => (
                                <a
                                  key={i}
                                  href={r.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-xs text-blue-400 hover:underline truncate"
                                >
                                  • {r.title}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Timing</h4>
                        <div className="space-y-1 text-sm">
                          {selectedLog.search_duration_ms && (
                            <p className="text-gray-300">
                              Search: <span className="text-blue-400">{selectedLog.search_duration_ms}ms</span>
                            </p>
                          )}
                          <p className="text-gray-300">
                            LLM: <span className="text-green-400">{selectedLog.llm_duration_ms}ms</span>
                          </p>
                          <p className="text-gray-300">
                            Total: <span className="text-amber-400">{selectedLog.total_duration_ms}ms</span>
                          </p>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Token Usage</h4>
                        <div className="space-y-1 text-sm">
                          <p className="text-gray-300">
                            Prompt: <span className="text-purple-400">{selectedLog.prompt_tokens || 0}</span>
                          </p>
                          <p className="text-gray-300">
                            Completion: <span className="text-purple-400">{selectedLog.completion_tokens || 0}</span>
                          </p>
                          <p className="text-gray-300">
                            Total: <span className="text-purple-400 font-medium">{selectedLog.total_tokens || 0}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Model</h4>
                      <Badge className="bg-purple-500/20 text-purple-400">{selectedLog.model_used}</Badge>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty State */}
      {!statsLoading && stats?.totalMessages === 0 && (
        <Alert className="bg-gray-900 border-gray-800">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-gray-400">
            No chat messages yet. Users can start conversations by asking questions about articles in the mobile app.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
