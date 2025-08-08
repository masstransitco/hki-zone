"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { 
  AlertTriangle, 
  ChevronDown, 
  ChevronRight, 
  Search,
  RefreshCw,
  Trash2,
  Edit,
  Eye,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Copy,
  Image,
  AlertCircle
} from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"

interface QualityIssue {
  id: string
  type: 'short_content' | 'missing_metadata' | 'duplicate' | 'unenhanced_selected'
  article: {
    id: string
    title: string
    source: string
    created_at: string
    content_length: number
    selected_for_enhancement: boolean
    is_ai_enhanced: boolean
    image_url?: string
    category?: string
    url?: string
  }
  severity: 'low' | 'medium' | 'high'
  description: string
  auto_fixable: boolean
}

interface QualityIssuesData {
  short_content: QualityIssue[]
  missing_metadata: QualityIssue[]
  duplicates: QualityIssue[]
  unenhanced_selected: QualityIssue[]
  total_count: number
  last_updated: string
}

const ISSUE_TYPES = {
  short_content: {
    title: 'Articles Too Short',
    description: 'Articles with insufficient content (<200 characters)',
    icon: FileText,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800'
  },
  missing_metadata: {
    title: 'Missing Metadata',
    description: 'Articles lacking proper images or metadata',
    icon: Image,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800'
  },
  duplicates: {
    title: 'Potential Duplicates',
    description: 'Articles that may be duplicates or near-duplicates',
    icon: Copy,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800'
  },
  unenhanced_selected: {
    title: 'Enhancement Backlog',
    description: 'Selected articles awaiting AI enhancement',
    icon: Clock,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800'
  }
}

interface QualityIssuesManagerProps {
  timeframe?: string
  sources?: string[]
  onIssueResolved?: (issueId: string, type: string) => void
}

export default function QualityIssuesManager({ 
  timeframe = '24h', 
  sources = [],
  onIssueResolved 
}: QualityIssuesManagerProps) {
  const [data, setData] = useState<QualityIssuesData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Mock data for demonstration - replace with actual API call
  const mockData: QualityIssuesData = {
    short_content: [
      {
        id: '1',
        type: 'short_content',
        article: {
          id: 'art1',
          title: 'Breaking: Market Update',
          source: 'HKFP',
          created_at: '2024-01-15T10:30:00Z',
          content_length: 145,
          selected_for_enhancement: false,
          is_ai_enhanced: false,
          category: 'finance',
          url: 'https://example.com/article1'
        },
        severity: 'medium',
        description: 'Content length: 145 characters (minimum: 200)',
        auto_fixable: false
      },
      {
        id: '2',
        type: 'short_content',
        article: {
          id: 'art2',
          title: 'Weather Alert',
          source: 'RTHK',
          created_at: '2024-01-15T09:15:00Z',
          content_length: 89,
          selected_for_enhancement: true,
          is_ai_enhanced: false,
          category: 'weather',
          url: 'https://example.com/article2'
        },
        severity: 'high',
        description: 'Content length: 89 characters (minimum: 200)',
        auto_fixable: false
      },
      {
        id: '6',
        type: 'short_content',
        article: {
          id: 'art6',
          title: 'Stock Market Brief',
          source: 'Bloomberg',
          created_at: '2024-01-15T07:20:00Z',
          content_length: 123,
          selected_for_enhancement: false,
          is_ai_enhanced: false,
          category: 'finance',
          url: 'https://example.com/article6'
        },
        severity: 'medium',
        description: 'Content length: 123 characters (minimum: 200)',
        auto_fixable: false
      },
      {
        id: '7',
        type: 'short_content',
        article: {
          id: 'art7',
          title: 'Traffic Update Central',
          source: 'HK01',
          created_at: '2024-01-15T06:45:00Z',
          content_length: 167,
          selected_for_enhancement: true,
          is_ai_enhanced: false,
          category: 'traffic',
          url: 'https://example.com/article7'
        },
        severity: 'low',
        description: 'Content length: 167 characters (minimum: 200)',
        auto_fixable: false
      }
    ],
    missing_metadata: [
      {
        id: '3',
        type: 'missing_metadata',
        article: {
          id: 'art3',
          title: 'New Policy Announcement',
          source: 'SingTao',
          created_at: '2024-01-15T08:45:00Z',
          content_length: 850,
          selected_for_enhancement: true,
          is_ai_enhanced: false,
          category: 'politics'
        },
        severity: 'low',
        description: 'Missing featured image and category tags',
        auto_fixable: true
      },
      {
        id: '8',
        type: 'missing_metadata',
        article: {
          id: 'art8',
          title: 'Healthcare Reform Details',
          source: 'SCMP',
          created_at: '2024-01-15T05:30:00Z',
          content_length: 1200,
          selected_for_enhancement: false,
          is_ai_enhanced: false,
          category: 'healthcare'
        },
        severity: 'medium',
        description: 'Missing featured image and source attribution',
        auto_fixable: true
      },
      {
        id: '9',
        type: 'missing_metadata',
        article: {
          id: 'art9',
          title: 'Education System Changes',
          source: 'AM730',
          created_at: '2024-01-15T04:15:00Z',
          content_length: 980,
          selected_for_enhancement: true,
          is_ai_enhanced: false,
          category: 'education'
        },
        severity: 'low',
        description: 'Missing author information and tags',
        auto_fixable: true
      }
    ],
    duplicates: [
      {
        id: '4',
        type: 'duplicate',
        article: {
          id: 'art4',
          title: 'Hong Kong Traffic Update - Central District',
          source: 'HK01',
          created_at: '2024-01-15T07:30:00Z',
          content_length: 420,
          selected_for_enhancement: false,
          is_ai_enhanced: false,
          category: 'traffic'
        },
        severity: 'medium',
        description: 'Similar to article "Traffic Situation in Central" (85% similarity)',
        auto_fixable: false
      }
    ],
    unenhanced_selected: [
      {
        id: '5',
        type: 'unenhanced_selected',
        article: {
          id: 'art5',
          title: 'Economic Outlook for 2024',
          source: 'SCMP',
          created_at: '2024-01-14T16:20:00Z',
          content_length: 1250,
          selected_for_enhancement: true,
          is_ai_enhanced: false,
          category: 'finance',
          image_url: 'https://example.com/image.jpg'
        },
        severity: 'medium',
        description: 'Selected 18 hours ago, awaiting enhancement',
        auto_fixable: true
      }
    ],
    total_count: 9,
    last_updated: '2024-01-15T11:00:00Z'
  }

  useEffect(() => {
    // Simulate API call
    const fetchData = async () => {
      setIsLoading(true)
      // Replace with actual API call
      setTimeout(() => {
        setData(mockData)
        setIsLoading(false)
      }, 1000)
    }

    fetchData()
  }, [timeframe, sources])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    // Simulate refresh
    setTimeout(() => {
      setIsRefreshing(false)
    }, 1500)
  }

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)
  }

  const handleBulkAction = async (action: 'delete' | 'fix' | 'ignore') => {
    // Implement bulk actions
    console.log(`Bulk ${action} for items:`, Array.from(selectedItems))
    setSelectedItems(new Set())
  }

  const getSeverityColor = (severity: QualityIssue['severity']) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const filteredData = data ? Object.entries(data).filter(([key]) => 
    key !== 'total_count' && key !== 'last_updated'
  ) as [string, QualityIssue[]][] : []

  if (isLoading) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Loading Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-t-lg border-b border-slate-200 dark:border-slate-700">
          <div className="p-6 pb-4 animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 bg-slate-300 dark:bg-slate-600 rounded"></div>
                  <div className="h-6 bg-slate-300 dark:bg-slate-600 rounded w-48"></div>
                </div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-72 mt-2"></div>
              </div>
              <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded"></div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded flex-1 max-w-sm"></div>
              <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded"></div>
            </div>
          </div>
        </div>
        
        {/* Loading Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent hover:scrollbar-thumb-slate-400 dark:hover:scrollbar-thumb-slate-500">
          <div className="p-6 pt-4 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-xl p-6 animate-pulse">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-slate-300 dark:bg-slate-600 rounded-lg"></div>
                    <div>
                      <div className="h-5 bg-slate-300 dark:bg-slate-600 rounded w-32 mb-2"></div>
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-48"></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-16 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
                    <div className="w-6 h-6 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-t-lg border-b border-slate-200 dark:border-slate-700">
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Quality Issues Manager
                </h2>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Manage and resolve content quality issues across your pipeline
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedItems.size > 0 && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    {selectedItems.size} selected
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkAction('fix')}
                    className="h-8 hover:bg-green-50 hover:text-green-700 hover:border-green-200 dark:hover:bg-green-900/20 dark:hover:text-green-300"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Auto-fix
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkAction('ignore')}
                    className="h-8 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Ignore
                  </Button>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-8 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
          
          {/* Search and Filter Bar */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder="Search articles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              />
            </div>
            <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-3 py-1">
              {data?.total_count || 0} total issues
            </Badge>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Last updated: {data ? formatDate(data.last_updated) : 'Never'}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent hover:scrollbar-thumb-slate-400 dark:hover:scrollbar-thumb-slate-500">
        <div className="p-6 pt-4 space-y-4">
        {filteredData.map(([issueType, issues]) => {
          const config = ISSUE_TYPES[issueType as keyof typeof ISSUE_TYPES]
          const Icon = config.icon
          const filteredIssues = issues.filter(issue =>
            issue.article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            issue.article.source.toLowerCase().includes(searchTerm.toLowerCase())
          )

          if (filteredIssues.length === 0) return null

          return (
            <Collapsible
              key={issueType}
              open={expandedSections.has(issueType)}
              onOpenChange={() => toggleSection(issueType)}
            >
              <Card className={`bg-gradient-to-br ${config.bgColor} border-2 ${config.borderColor} shadow-sm hover:shadow-md transition-all duration-200`}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-white/80 dark:bg-slate-800/80 shadow-sm`}>
                          <Icon className={`h-5 w-5 ${config.color}`} />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            {config.title}
                          </h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {config.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={`${config.color.replace('text-', 'bg-').replace('-600', '-100')} ${config.color} border-0 font-medium px-3 py-1`}>
                          {filteredIssues.length} issues
                        </Badge>
                        <div className={`p-1 rounded-full bg-white/80 dark:bg-slate-800/80 shadow-sm`}>
                          {expandedSections.has(issueType) ? (
                            <ChevronDown className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <Separator className="mb-4 bg-slate-200 dark:bg-slate-700" />
                    <div className="space-y-3">
                      {filteredIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 group"
                        >
                          <Checkbox
                            checked={selectedItems.has(issue.id)}
                            onCheckedChange={() => handleSelectItem(issue.id)}
                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                                {issue.article.title}
                              </h4>
                              <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 text-xs font-medium">
                                {issue.article.source}
                              </Badge>
                              <Badge className={`text-xs font-medium ${getSeverityColor(issue.severity)}`}>
                                {issue.severity}
                              </Badge>
                              {issue.auto_fixable && (
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs font-medium">
                                  Auto-fixable
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 leading-relaxed">
                              {issue.description}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {issue.article.content_length.toLocaleString()} chars
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(issue.article.created_at)}
                              </span>
                              {issue.article.category && (
                                <span className="capitalize bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                  {issue.article.category}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            {issue.article.url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                                asChild
                              >
                                <a
                                  href={issue.article.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {issue.auto_fixable && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 ml-1 hover:bg-green-50 hover:text-green-700 hover:border-green-200 dark:hover:bg-green-900/20 dark:hover:text-green-300 dark:hover:border-green-700"
                                onClick={() => {
                                  console.log('Auto-fixing issue:', issue.id)
                                  onIssueResolved?.(issue.id, issueType)
                                }}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Fix
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )
        })}

          {filteredData.length === 0 && (
            <div className="text-center py-12">
              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-2xl p-8 max-w-sm mx-auto">
                <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-600 dark:text-green-400" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  No Quality Issues Found
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  All articles meet quality standards for the selected timeframe.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}