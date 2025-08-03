"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useInView } from "react-intersection-observer"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X
} from "lucide-react"
import Image from "next/image"
import { format } from "date-fns"
import PullRefreshIndicator from "./pull-refresh-indicator"
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh"
import { useHeaderVisibility } from "@/contexts/header-visibility"
import LoadingSkeleton from "./loading-skeleton"
import { useRealtimeGovernmentBulletin } from "@/hooks/use-realtime-government-bulletin"
import { useLanguage } from "@/components/language-provider"

interface BulletinItem {
  id: string
  title: string
  body?: string
  category: string
  severity: number
  relevance_score: number
  source_slug: string
  source_updated_at: string
  enrichment_status?: "pending" | "enriched" | "ready" | "failed" | "content_partial" | "content_complete"
  enriched_title?: string
  enriched_summary?: string
  key_points?: string[]
  why_it_matters?: string
  created_at: string
  // New fields from the updated API
  has_translation?: boolean
  original_language?: string
  requested_language?: string
  is_converted?: boolean
  available_languages?: string[]
  word_count?: number
  source_identifier?: string
  link?: string
}

// Map source slugs to their government favicon paths
const getSourceFavicon = (sourceSlug: string): string => {
  const faviconMap: { [key: string]: string } = {
    // HKMA - Hong Kong Monetary Authority (English)
    'hkma_press': '/gov-favicons-output/hkma.jpg',
    'hkma_speeches': '/gov-favicons-output/hkma.jpg',
    'hkma_guidelines': '/gov-favicons-output/hkma.jpg',
    'hkma_circulars': '/gov-favicons-output/hkma.jpg',
    
    // HKMA - Hong Kong Monetary Authority (Chinese)
    'hkma_press_zh_tw': '/gov-favicons-output/hkma.jpg',
    'hkma_speeches_zh_tw': '/gov-favicons-output/hkma.jpg',
    'hkma_guidelines_zh_tw': '/gov-favicons-output/hkma.jpg',
    'hkma_circulars_zh_tw': '/gov-favicons-output/hkma.jpg',
    
    // Government news
    'news_gov_top': '/gov-favicons-output/gov_hk.ico',
    
    // Transport Department (English)
    'td_notices': '/gov-favicons-output/td/raw/td.png',
    'td_press': '/gov-favicons-output/td/raw/td.png',
    'td_special': '/gov-favicons-output/td/raw/td.png',
    
    // Transport Department (Chinese)
    'td_notices_zh_tw': '/gov-favicons-output/td/raw/td.png',
    'td_notices_zh_cn': '/gov-favicons-output/td/raw/td.png',
    'td_press_zh_tw': '/gov-favicons-output/td/raw/td.png',
    'td_press_zh_cn': '/gov-favicons-output/td/raw/td.png',
    
    // Hong Kong Observatory (English)
    'hko_warn': '/gov-favicons-output/hko.ico',
    'hko_eq': '/gov-favicons-output/hko.ico',
    'hko_felt_earthquake': '/gov-favicons-output/hko.ico',
    
    // Hong Kong Observatory (Chinese)
    'hko_warn_zh_tw': '/gov-favicons-output/hko.ico',
    'hko_eq_zh_tw': '/gov-favicons-output/hko.ico',
    'hko_felt_earthquake_zh_tw': '/gov-favicons-output/hko.ico',
    
    // Hong Kong Observatory (New feeds)
    'hko_warnings': '/gov-favicons-output/hko.ico',
    'hko_warnings_v3': '/gov-favicons-output/hko.ico',
    'hko_warning_bulletin': '/gov-favicons-output/hko.ico',
    'hko_current_weather': '/gov-favicons-output/hko.ico',
    'hko_current_v2': '/gov-favicons-output/hko.ico',
    'hko_forecast': '/gov-favicons-output/hko.ico',
    'hko_local_forecast_v2': '/gov-favicons-output/hko.ico',
    'hko_9day_v2': '/gov-favicons-output/hko.ico',
    'hko_earthquakes': '/gov-favicons-output/hko.ico',
    'hko_earthquakes_quick': '/gov-favicons-output/hko.ico',
    'hko_special_tips': '/gov-favicons-output/hko.ico',
    
    // Centre for Health Protection (English)
    'chp_press': '/gov-favicons-output/dh.ico',
    'chp_disease': '/gov-favicons-output/dh.ico',
    'chp_ncd': '/gov-favicons-output/dh.ico',
    'chp_guidelines': '/gov-favicons-output/dh.ico',
    
    // Centre for Health Protection (Chinese)
    'chp_press_zh_tw': '/gov-favicons-output/dh.ico',
    'chp_ncd_zh_tw': '/gov-favicons-output/dh.ico',
    'chp_guidelines_zh_tw': '/gov-favicons-output/dh.ico',
    
    // Hospital Authority
    'ha_ae_waiting': '/gov-favicons-output/healthbureau.ico',
    
    // Utilities
    'emsd_util': '/gov-favicons-output/emsd.ico',
    
    // MTR - fallback to government icon
    'mtr_rail': '/gov-favicons-output/gov_hk.ico'
  }
  
  return faviconMap[sourceSlug] || '/gov-favicons-output/gov_hk.ico'
}

interface GovernmentBulletinProps {
  limit?: number
  autoRefresh?: boolean
  refreshInterval?: number
  showFilters?: boolean
  isActive?: boolean
}

// Available categories for filtering - using translation keys with emojis
const AVAILABLE_CATEGORIES = [
  { value: 'all', labelKey: 'filters.all', emoji: '' },
  { value: 'Finance', labelKey: 'filters.finance', emoji: '💹' },
  { value: 'Gov', labelKey: 'filters.gov', emoji: '🏛️' },
  { value: 'Road', labelKey: 'filters.road', emoji: '🛣️' },
  { value: 'Transport', labelKey: 'filters.transport', emoji: '🚦' },
  { value: 'Weather', labelKey: 'filters.weather', emoji: '🌤️' },
  { value: 'Health', labelKey: 'filters.health', emoji: '🩺' },
  { value: 'Hospital', labelKey: 'filters.hospital', emoji: '🏥' },
  { value: 'Police', labelKey: 'filters.police', emoji: '🚔' },
  { value: 'Emergency', labelKey: 'filters.emergency', emoji: '🚨' },
  { value: 'Education', labelKey: 'filters.education', emoji: '🎓' },
  { value: 'Immigration', labelKey: 'filters.immigration', emoji: '✈️' },
  { value: 'Environment', labelKey: 'filters.environment', emoji: '🌱' },
  { value: 'Utility', labelKey: 'filters.utility', emoji: '⚡' },
  { value: 'Rail', labelKey: 'filters.rail', emoji: '🚆' }
]

export default function GovernmentBulletin({
  limit = 20,
  autoRefresh = true,
  refreshInterval = 2 * 60 * 1000, // 2 minutes
  showFilters = false,
  isActive = true
}: GovernmentBulletinProps) {
  const [items, setItems] = useState<BulletinItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showCategoryFilter, setShowCategoryFilter] = useState(false)
  const { setScrollPosition } = useHeaderVisibility()
  const tickingRef = useRef(false)
  const { t, language } = useLanguage()
  const [isLanguageReady, setIsLanguageReady] = useState(false)
  const filterDropdownRef = useRef<HTMLDivElement>(null)
  
  // Infinite scroll trigger
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
    rootMargin: '100px'
  })

  // Set up real-time subscription
  const { isConnected } = useRealtimeGovernmentBulletin({
    queryKey: ['government-bulletins', page, limit],
    enabled: isActive && autoRefresh
  })

  // Define loadBulletinItems first
  const loadBulletinItems = useCallback(async (pageNum: number, categoryFilter?: string) => {
    try {
      if (pageNum === 0) setLoading(true)
      else setLoadingMore(true)

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
        language: language || 'en' // Pass user's language preference
      })

      // Add category filter to API call if not 'all'
      const currentCategory = categoryFilter || selectedCategory
      if (currentCategory && currentCategory !== 'all') {
        // Map frontend categories to backend categories
        const categoryMap: { [key: string]: string } = {
          'Finance': 'monetary_press',
          'Road': 'transport_notice', 
          'Transport': 'transport_press',
          'Weather': 'weather_warning',
          'Health': 'health_alert',
          'Gov': 'administrative'
        }
        
        // Also support weather_earthquake as Weather
        if (currentCategory === 'Weather') {
          // For weather, we want both weather_warning and weather_earthquake
          // We'll need to handle this differently - let's just use weather_warning for now
          // and modify the backend to support multiple categories later
        }
        
        const backendCategory = categoryMap[currentCategory]
        if (backendCategory) {
          params.set('category', backendCategory)
        }
      }

      const response = await fetch(`/api/signals-unified?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch bulletin items')

      const data = await response.json()
      
      console.log('📊 [GOV-BULLETIN] API Response:', {
        totalSignals: data.signals?.length || 0,
        hasMore: data.hasMore,
        language: language,
        category: currentCategory,
        firstSignal: data.signals?.[0]
      })
      
      if (pageNum === 0) {
        setItems(data.signals || [])
      } else {
        setItems(prev => [...prev, ...(data.signals || [])])
      }
      
      setHasMore(data.hasMore || false)
      setPage(pageNum)
    } catch (error) {
      console.error('Error loading bulletin items:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [language, limit, selectedCategory])

  // Track when language is ready (after hydration)
  useEffect(() => {
    // Small delay to ensure language provider has loaded saved preference
    const timer = setTimeout(() => {
      setIsLanguageReady(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  // Load data when language is ready or changes
  useEffect(() => {
    if (isLanguageReady) {
      loadBulletinItems(0)
    }
  }, [language, isLanguageReady, loadBulletinItems]) // Reload when language changes or becomes ready

  const handleRefresh = useCallback(async () => {
    console.log('🔄 [GOV-BULLETIN] Manual refresh START')
    await loadBulletinItems(0)
    console.log('✅ [GOV-BULLETIN] Manual refresh COMPLETED')
  }, [loadBulletinItems])

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loadingMore) {
      loadBulletinItems(page + 1, selectedCategory)
    }
  }, [hasMore, loadingMore, loadBulletinItems, page, selectedCategory])

  // Infinite scroll effect
  useEffect(() => {
    if (inView && hasMore && !loadingMore && !loading) {
      handleLoadMore()
    }
  }, [inView, hasMore, loadingMore, loading, handleLoadMore])

  // Use pull-to-refresh hook
  const {
    scrollRef,
    pullDistance,
    isRefreshing,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  } = usePullToRefresh({
    onRefresh: handleRefresh,
    enabled: true
  })

  // Handle scroll events for header visibility
  useEffect(() => {
    if (!isActive) return

    const handleScroll = () => {
      const element = scrollRef.current
      if (!element) return

      if (!tickingRef.current) {
        window.requestAnimationFrame(() => {
          setScrollPosition(element.scrollTop)
          tickingRef.current = false
        })
        tickingRef.current = true
      }
    }

    const checkInterval = setInterval(() => {
      const element = scrollRef.current
      if (element) {
        clearInterval(checkInterval)
        element.addEventListener('scroll', handleScroll, { passive: true })
        // Initial check
        setScrollPosition(element.scrollTop)
      }
    }, 100)

    return () => {
      clearInterval(checkInterval)
      const element = scrollRef.current
      if (element) {
        element.removeEventListener('scroll', handleScroll)
      }
      tickingRef.current = false
    }
  }, [isActive, setScrollPosition])

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

  const handleCategoryFilter = (category: string) => {
    setSelectedCategory(category)
    setShowCategoryFilter(false)
    setPage(0) // Reset pagination
    loadBulletinItems(0, category) // Reload data with new filter
  }

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryFilter(false)
      }
    }

    if (showCategoryFilter) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCategoryFilter])

  // Helper function to get emoji for a category
  const getCategoryEmoji = useCallback((categoryLabel: string) => {
    const category = AVAILABLE_CATEGORIES.find(cat => cat.value === categoryLabel)
    return category?.emoji || ''
  }, [])

  const getCategoryLabel = useCallback((category: string, sourceSlug: string) => {
    // Enhanced categorization for all government feeds including new feed groups
    const sourceLabels: { [key: string]: string } = {
      // New government signals feed groups
      'hkma_press': 'Finance',
      'hkma_circulars': 'Finance',
      'hkma_guidelines': 'Finance',
      
      // Weather feeds - legacy and new
      'hko_warnings': 'Weather',
      'hko_warnings_v3': 'Weather',
      'hko_warning_bulletin': 'Weather',
      'hko_current_weather': 'Weather',
      'hko_current_v2': 'Weather',
      'hko_forecast': 'Weather',
      'hko_local_forecast_v2': 'Weather',
      'hko_9day_v2': 'Weather',
      'hko_earthquakes': 'Weather',
      'hko_earthquakes_quick': 'Weather',
      'hko_felt_earthquake': 'Weather',
      'hko_special_tips': 'Weather',
      
      // Transport feeds - legacy and new
      'td_notices': 'Road', 
      'td_press': 'Transport',
      'td_special_traffic': 'Road',
      'td_clearways': 'Road',
      'td_public_transport': 'Transport',
      'td_road_closure': 'Road',
      'td_expressways': 'Road',
      
      // Health feeds
      'chp_press': 'Health',
      'chp_alerts': 'Health',
      
      // Government news feeds
      'gov_news_main': 'Gov',
      'gov_news_city': 'Gov',
      'gov_news_finance': 'Finance',
      'gov_news_business': 'Gov',
      'gov_news_health': 'Health',
      'gov_news_infrastructure': 'Transport',
      'gov_news_environment': 'Environment',
      
      // Other department feeds
      'hkpf_press': 'Police',
      'fsd_press': 'Emergency',
      'edb_announcements': 'Education',
      'immd_announcements': 'Immigration',
      'lands_press': 'Gov',
      
      // Legacy HKMA feeds
      'hkma_speeches': 'Finance',
      'hkma_guidelines': 'Finance',
      'hkma_circulars': 'Finance',
      
      // Legacy HKMA - Hong Kong Monetary Authority (Chinese)
      'hkma_press_zh_tw': 'Finance',
      'hkma_speeches_zh_tw': 'Finance',
      'hkma_guidelines_zh_tw': 'Finance',
      'hkma_circulars_zh_tw': 'Finance',
      
      // Government news
      'news_gov_top': 'Gov',
      
      // Legacy Transport Department (Chinese)
      'td_notices_zh_tw': 'Road',
      'td_notices_zh_cn': 'Road',
      'td_press_zh_tw': 'Transport',
      'td_press_zh_cn': 'Transport',
      
      // Legacy Hong Kong Observatory
      'hko_warn': 'Weather',
      'hko_eq': 'Weather',
      'hko_felt_earthquake': 'Weather',
      
      // Centre for Health Protection
      'chp_press': 'Health',
      'chp_disease': 'Health',
      'chp_ncd': 'Health',
      'chp_guidelines': 'Health',
      
      // Hospital Authority
      'ha_ae_waiting': 'Hospital',
      
      // Utilities
      'emsd_util': 'Utility',
      
      // MTR
      'mtr_rail': 'Rail'
    }
    
    // Priority check: use direct category mapping from new system
    const categoryMap: { [key: string]: string } = {
      'weather_warning': 'Weather',
      'weather_earthquake': 'Weather', 
      'monetary_press': 'Finance',
      'monetary_circular': 'Finance',
      'transport_notice': 'Road',
      'transport_press': 'Transport',
      'health_alert': 'Health',
      'health_guideline': 'Health',
      'administrative': 'Gov',
      'emergency': 'Emergency',
      'police': 'Police',
      'education': 'Education',
      'immigration': 'Immigration',
      'environment': 'Environment',
      'lands': 'Gov',
      'utility': 'Utility'
    }
    
    // Priority 1: Check new system category mappings first  
    if (categoryMap[category]) {
      return categoryMap[category]
    }
    
    // Priority 2: Check source slug mappings
    if (sourceLabels[sourceSlug]) {
      return sourceLabels[sourceSlug]
    }
    
    // Priority 3: Fallback to legacy category-based labels
    const legacyCategoryMap: { [key: string]: string } = {
      road: 'Road',
      rail: 'Rail',
      weather: 'Weather',
      utility: 'Utility',
      health: 'Health',
      financial: 'Finance',
      gov: 'Gov',
      ae: 'A&E',
      top_signals: 'Priority',
      environment: 'Environment'
    }
    
    return legacyCategoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1)
  }, [])

  // Items are already filtered server-side, so we use them directly
  const filteredItems = items

  const getCategoryColor = () => {
    // Enhanced semantic color system - warm neutral colors
    return "bg-surface-2 text-text-2"
  }

  const getPriorityLevel = (relevanceScore: number) => {
    if (relevanceScore >= 200) return 'important'
    if (relevanceScore >= 150) return 'high'
    if (relevanceScore >= 100) return 'medium'
    return 'low'
  }

  const getPriorityConfig = (level: string) => {
    const configs = {
      important: {
        label: 'Important',
        icon: '⭐',
        className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
        description: 'Key information and notices'
      },
      high: {
        label: 'High',
        icon: '⚡',
        className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800',
        description: 'Notable warnings or notices'
      },
      medium: {
        label: 'Medium',
        icon: '📋',
        className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800',
        description: 'Regular notices'
      },
      low: {
        label: 'Low',
        icon: '📄',
        className: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-700',
        description: 'Archive content'
      }
    }
    return configs[level] || configs.low
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd')
    } catch {
      return dateString
    }
  }

  if (loading) {
    return <LoadingSkeleton variant="bulletin-full" count={5} />
  }

  return (
    <div className="relative h-full overflow-hidden">
      <PullRefreshIndicator 
        pullDistance={pullDistance} 
        isRefreshing={isRefreshing} 
      />
      
      {/* Pull-to-refresh transform wrapper */}
      <div 
        className="h-full"
        style={{ 
          transform: `translateY(${Math.min(pullDistance, 150)}px)`,
          transition: pullDistance > 0 ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        {/* Actual scroll container */}
        <div 
          ref={scrollRef}
          className="isolate overflow-auto h-full"
          style={{ 
            overscrollBehaviorY: 'contain', 
            WebkitOverflowScrolling: 'touch'
          }}
        >
        {/* Invisible spacer for header + category selector height: 57px header + ~50px category selector */}
        <div className="h-[113px] w-full" aria-hidden="true" />
        
        <div className="pt-6 space-y-4 px-4 md:px-6 lg:px-8">
          {/* Filter and Real-time status row */}
          <div className="flex items-center justify-between text-xs">
            {/* Category filter on the left */}
            <div className="relative" ref={filterDropdownRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCategoryFilter(!showCategoryFilter)}
                className="h-7 px-3 text-xs border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <span className="mr-1.5">
                  {selectedCategory === 'all' ? '🇭🇰' : getCategoryEmoji(selectedCategory)}
                </span>
                {selectedCategory === 'all' ? t('filters.all') : t(`filters.${selectedCategory.toLowerCase()}`)}
                <ChevronDown className="h-3 w-3 ml-1.5" />
              </Button>
              
              {/* Dropdown menu */}
              {showCategoryFilter && (
                <div className="absolute top-8 left-0 z-50 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg min-w-[140px]">
                  <div className="py-1">
                    {AVAILABLE_CATEGORIES.map((category) => (
                      <button
                        key={category.value}
                        onClick={() => handleCategoryFilter(category.value)}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
                          selectedCategory === category.value
                            ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                            : 'text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        {category.emoji && <span className="mr-2">{category.emoji}</span>}
                        {t(category.labelKey)}
                        {selectedCategory === category.value && (
                          <span className="ml-2 text-neutral-500">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Real-time connection status on the right */}
            {autoRefresh && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-orange-500'} animate-pulse`} />
                <span>{isConnected ? t('realtime.active') : t('realtime.connecting')}</span>
              </div>
            )}
          </div>

      {/* Bulletin List */}
      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              {selectedCategory === 'all' 
                ? 'No bulletin items found' 
                : `No ${t(`filters.${selectedCategory.toLowerCase()}`)} items found`}
            </CardContent>
          </Card>
        ) : (
          filteredItems.map((item) => {
            const isExpanded = expandedItems.has(item.id)
            
            // Simplified content display - prioritize enriched content if available, otherwise use original body
            const displayTitle = item.enriched_title || item.title
            const displayContent = item.enriched_summary || item.body

            return (
              <Card 
                key={item.id} 
                className="group article-card cursor-pointer"
              >
                <CardContent className="p-3">
                  <div className="space-y-4">
                    {/* Main content area with source logo and title */}
                    <div className="flex items-start gap-3">
                      {/* Source favicon - primary visual identifier */}
                      <div className="flex-shrink-0 mt-0.5">
                        <Image 
                          src={getSourceFavicon(item.source_slug)}
                          alt={`${item.source_slug} favicon`}
                          width={20}
                          height={20}
                          className="object-contain"
                          onError={(e) => {
                            // Fallback to default gov icon if specific favicon fails
                            e.currentTarget.src = '/gov-favicons-output/gov_hk.ico'
                          }}
                        />
                      </div>
                      
                      {/* Content area */}
                      <div className="flex-1 min-w-0">
                        {/* Title */}
                        <h3 className="article-card-title leading-tight mb-2">
                          {displayTitle}
                        </h3>
                        
                        {/* Metadata row */}
                        <div className="flex items-center gap-3 text-xs article-card-meta">
                          <Badge 
                            variant="outline" 
                            className={getCategoryColor()}
                          >
                            {getCategoryLabel(item.category, item.source_slug)}
                          </Badge>
                          
                          {/* Language indicator */}
                          {(item as any).is_converted && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                              {language === 'zh-CN' ? '简体' : 'Converted'}
                            </Badge>
                          )}
                          
                          
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatDate(item.source_updated_at)}</span>
                          </div>
                          
                          {/* Priority Badge */}
                          {(() => {
                            // Use calculated_relevance first, fallback to severity, then to default medium
                            const relevanceScore = item.calculated_relevance || item.severity || item.relevance_score || 100
                            const priorityLevel = getPriorityLevel(relevanceScore)
                            const priorityConfig = getPriorityConfig(priorityLevel)
                            
                            return (
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${priorityConfig.className}`}
                                title={`${priorityConfig.description} (Score: ${relevanceScore})`}
                              >
                                <span className="mr-1">{priorityConfig.icon}</span>
                                {priorityConfig.label}
                              </Badge>
                            )
                          })()}
                        </div>
                      </div>
                      
                      {/* Expand button - show if there's content OR a link */}
                      {((displayContent && displayContent.trim().length > 0) || item.link) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(item.id)}
                          className="h-8 w-8 p-0 flex-shrink-0 text-text-4 hover:text-text-2"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Expandable content */}
                    {isExpanded && (
                      <div className="pt-3 mt-1 border-t border-card-border/60">
                        {displayContent && displayContent.trim().length > 0 ? (
                          <p className="text-sm text-2 leading-relaxed">
                            {displayContent}
                          </p>
                        ) : (
                          item.link && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-3">
                                {t('bulletin.noContent', 'Content not yet available')}
                              </span>
                              <a 
                                href={item.link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {t('bulletin.viewOriginal', 'View original')} →
                              </a>
                            </div>
                          )
                        )}
                        
                        {/* AI-Enhanced Content - only show if enriched fields exist */}
                        {(item.key_points?.length > 0 || item.why_it_matters) && (
                          <div className="mt-4 space-y-3">
                            {item.key_points && item.key_points.length > 0 && (
                              <div>
                                <h4 className="text-xs font-medium text-2 mb-2">
                                  Key Points:
                                </h4>
                                <ul className="text-xs text-3 space-y-1">
                                  {item.key_points.map((point, index) => (
                                    <li key={index} className="flex items-start gap-2">
                                      <span className="text-text-4 mt-1">•</span>
                                      <span>{point}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {item.why_it_matters && (
                              <div>
                                <h4 className="text-xs font-medium text-2 mb-2">
                                  Why It Matters:
                                </h4>
                                <p className="text-xs text-3">
                                  {item.why_it_matters}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Infinite scroll trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="pt-4">
          {loadingMore && (
            <LoadingSkeleton variant="bulletin" count={3} />
          )}
        </div>
      )}
        </div>
      </div>
      </div>
    </div>
  )
}