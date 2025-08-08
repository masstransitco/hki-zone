"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Mic, 
  Play, 
  Pause, 
  Download, 
  Edit, 
  Plus, 
  RefreshCw, 
  Clock, 
  DollarSign,
  FileText,
  Calendar,
  BarChart3,
  Settings,
  Eye,
  Save,
  X,
  Volume2,
  Loader2,
  Trash2
} from "lucide-react"
import { toast } from "sonner"

interface DialogueSegment {
  id: string
  speaker: 'male' | 'female'
  content: string
  estimatedDuration: number
  wordCount: number
}

interface DialogueOperation {
  segmentId: string
  speaker: 'male' | 'female'
  operationName?: string
  outputGcsUri?: string
  audioUrl?: string
  duration?: number
  cost?: number
  error?: string
}

interface ExpandedArticle {
  title: string
  expandedContent: string
  category: string
  wordCount: number
  characterCount: number
}

interface NewsBrief {
  id: string
  title: string
  content: string
  expanded_content?: ExpandedArticle[]
  dialogue_segments?: DialogueSegment[]
  tts_dialogue_operations?: DialogueOperation[]
  language: string
  category: string
  estimated_duration_seconds: number
  actual_word_count: number
  openai_model_used: string
  generation_cost_usd: number
  created_at: string
  audio_url?: string
  audio_duration_seconds?: number
  tts_synthesized_at?: string
  tts_synthesis_cost_usd?: number
  audio_file_size_bytes?: number
  // TTS for expanded content (long audio format)
  expanded_audio_url?: string
  expanded_audio_duration?: number
  expanded_tts_cost?: number
  expanded_tts_operation?: string
  news_brief_articles?: {
    article_id: string
    inclusion_reason: string
    article_weight: number
    articles: {
      id: string
      title: string
      category: string
      source: string
    }
  }[]
}

interface PipelineStats {
  totalBriefs: number
  averageDuration: number
  byLanguageAndCategory: Record<string, number>
  dateRange: {
    from: string
    to: string
    days: number
  }
}

interface GenerationStats {
  configured: boolean
  targetDurationMinutes: number
  targetWordCount: number
  wordsPerMinute: number
  availableArticles: {
    language: string
    articleCount: number
    categories: Record<string, number>
  }[]
  currentBriefType: string
}

interface ArticleRecommendation {
  id: string
  title: string
  category: string
  language_variant: string
  created_at: string
  source: string
  score: number
  reason: string
  content_length: number
  has_summary: boolean
  quality_score: number
}

interface ArticleSelectionStats {
  totalRecommendations: number
  currentlySelected: number
  totalAvailable: number
  selectionCriteria: {
    language: string
    category: string
    hours: number
    maxRecommendations: number
  }
}

interface SelectedArticle {
  id: string
  title: string
  category: string
  language_variant: string
  created_at: string
  source: string
  tts_selection_metadata?: {
    selected_at: string
    selection_reason: string
    selected_by: string
  }
}

export default function NewsBriefsAdmin() {
  const [activeTab, setActiveTab] = useState("overview")
  const [briefs, setBriefs] = useState<NewsBrief[]>([])
  const [loading, setLoading] = useState(false)
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null)
  const [generationStats, setGenerationStats] = useState<GenerationStats | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState("en")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedBriefType, setSelectedBriefType] = useState("morning")
  const [editingBrief, setEditingBrief] = useState<NewsBrief | null>(null)
  const [editedContent, setEditedContent] = useState("")
  
  // Article selection state
  const [articleRecommendations, setArticleRecommendations] = useState<ArticleRecommendation[]>([])
  const [articleSelectionStats, setArticleSelectionStats] = useState<ArticleSelectionStats | null>(null)
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([])
  const [articleLoading, setArticleLoading] = useState(false)
  const [selectedArticles, setSelectedArticles] = useState<SelectedArticle[]>([])
  
  // TTS synthesis state
  const [synthesizingBriefs, setSynthesizingBriefs] = useState<Set<string>>(new Set())
  const [playingBriefId, setPlayingBriefId] = useState<string | null>(null)
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)
  const [expandedSynthesisStatus, setExpandedSynthesisStatus] = useState<Record<string, { isDone: boolean; progressPercentage: number }>>({})

  // Load briefs and stats
  const loadData = async () => {
    setLoading(true)
    try {
      // Load briefs
      const briefsParams = new URLSearchParams({
        language: selectedLanguage,
        limit: "50",
        days: "7"
      })
      if (selectedCategory) {
        briefsParams.set("category", selectedCategory)
      }

      const [briefsRes, statsRes] = await Promise.all([
        fetch(`/api/news-briefs?${briefsParams}`),
        fetch("/api/news-briefs/generate")
      ])

      if (briefsRes.ok) {
        const briefsData = await briefsRes.json()
        setBriefs(briefsData.briefs || [])
        setPipelineStats(briefsData.stats)
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setGenerationStats(statsData)
      }
    } catch (error) {
      console.error("Error loading data:", error)
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    if (activeTab === 'articles') {
      loadArticleRecommendations()
    }
  }, [selectedLanguage, selectedCategory])

  useEffect(() => {
    if (activeTab === 'articles') {
      loadArticleRecommendations()
    }
  }, [activeTab])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause()
        currentAudio.src = ''
      }
    }
  }, [currentAudio])

  // Load article recommendations and selected articles
  const loadArticleRecommendations = async () => {
    setArticleLoading(true)
    try {
      const params = new URLSearchParams({
        language: selectedLanguage,
        count: "20",
        hours: "24"
      })
      if (selectedCategory) {
        params.set("category", selectedCategory)
      }

      // Load recommendations and stats
      const response = await fetch(`/api/admin/news-briefs/select-articles?${params}`)
      if (response.ok) {
        const data = await response.json()
        setArticleRecommendations(data.recommendations || [])
        setArticleSelectionStats(data.stats)
      }

      // Load currently selected articles
      await loadSelectedArticles()
    } catch (error) {
      console.error("Error loading article recommendations:", error)
      toast.error("Failed to load article recommendations")
    } finally {
      setArticleLoading(false)
    }
  }

  // Load currently selected articles
  const loadSelectedArticles = async () => {
    try {
      const params = new URLSearchParams({
        language: selectedLanguage,
        hours: "24",
        selected_for_tts_brief: "true",
        limit: "50"
      })
      if (selectedCategory) {
        params.set("category", selectedCategory)
      }

      const response = await fetch(`/api/articles?${params}`)
      if (response.ok) {
        const data = await response.json()
        setSelectedArticles(data.articles || [])
        console.log(`📰 Loaded ${data.articles?.length || 0} selected articles for ${selectedLanguage}`)
      } else {
        console.error('Failed to load selected articles:', response.status, response.statusText)
      }
    } catch (error) {
      console.error("Error loading selected articles:", error)
    }
  }

  // Auto-select articles
  const autoSelectArticles = async () => {
    if (articleLoading) {
      console.log('🚫 Auto-selection already in progress, ignoring click')
      return
    }
    
    setArticleLoading(true)
    console.log('🎯 Starting auto-selection process...')
    try {
      const response = await fetch("/api/admin/news-briefs/select-articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "auto_select",
          language: selectedLanguage,
          category: selectedCategory || undefined,
          count: 15
        })
      })

      if (!response.ok) throw new Error("Failed to auto-select articles")

      const result = await response.json()
      
      // Show detailed success message
      const message = result.selectedCount 
        ? `Auto-selected ${result.selectedCount} stories (${result.selectedCount * 3} articles across all languages)`
        : 'Selection completed'
      
      toast.success(message)
      
      // Only reload recommendations if we actually selected something
      if (result.selectedCount > 0) {
        await loadSelectedArticles() // Reload selected articles immediately
        loadArticleRecommendations()
      }
    } catch (error) {
      console.error("Error auto-selecting articles:", error)
      toast.error("Failed to auto-select articles")
    } finally {
      setArticleLoading(false)
    }
  }

  // Manually select articles
  const selectArticles = async () => {
    if (selectedArticleIds.length === 0) {
      toast.error("Please select at least one article")
      return
    }

    setArticleLoading(true)
    try {
      const response = await fetch("/api/admin/news-briefs/select-articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "manual_select",
          articleIds: selectedArticleIds,
          reason: "Manually selected from admin panel"
        })
      })

      if (!response.ok) throw new Error("Failed to select articles")

      const result = await response.json()
      toast.success(`Selected ${result.selectedCount} articles for TTS briefs`)
      setSelectedArticleIds([])
      await loadSelectedArticles()
      loadArticleRecommendations()
    } catch (error) {
      console.error("Error selecting articles:", error)
      toast.error("Failed to select articles")
    } finally {
      setArticleLoading(false)
    }
  }

  // Clear ALL article selections across all languages
  const clearArticleSelection = async () => {
    setArticleLoading(true)
    try {
      const response = await fetch("/api/admin/news-briefs/select-articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear_selection"
          // No language parameter - clear ALL languages
        })
      })

      if (!response.ok) throw new Error("Failed to clear all selections")

      const result = await response.json()
      toast.success(result.message)
      setSelectedArticles([]) // Clear the selected articles list
      loadArticleRecommendations()
    } catch (error) {
      console.error("Error clearing all selections:", error)
      toast.error("Failed to clear all selections")
    } finally {
      setArticleLoading(false)
    }
  }

  // TTS Synthesis functions
  const synthesizeTTS = async (briefId: string) => {
    setSynthesizingBriefs(prev => new Set([...prev, briefId]))
    try {
      const response = await fetch(`/api/news-briefs/${briefId}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || 'Failed to synthesize TTS')
      }

      const result = await response.json()
      toast.success(`TTS synthesis completed! Duration: ${formatDuration(result.duration)}`)
      loadData() // Refresh briefs to show audio
    } catch (error) {
      console.error('Error synthesizing TTS:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to synthesize TTS')
    } finally {
      setSynthesizingBriefs(prev => {
        const next = new Set(prev)
        next.delete(briefId)
        return next
      })
    }
  }

  const deleteTTSAudio = async (briefId: string) => {
    try {
      const response = await fetch(`/api/news-briefs/${briefId}/synthesize`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete audio')

      toast.success('Audio deleted successfully')
      loadData() // Refresh briefs
    } catch (error) {
      console.error('Error deleting TTS audio:', error)
      toast.error('Failed to delete audio')
    }
  }

  const synthesizeExpandedContent = async (briefId: string) => {
    setSynthesizingBriefs(prev => new Set([...prev, briefId]))
    try {
      const response = await fetch(`/api/news-briefs/${briefId}/synthesize-expanded`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || 'Failed to synthesize expanded content')
      }

      const result = await response.json()
      toast.success(`Started expanded content synthesis! Duration: ${formatDuration(result.estimatedDuration || 0)}`)
      
      // Start monitoring this synthesis
      setExpandedSynthesisStatus(prev => ({
        ...prev,
        [briefId]: { isDone: false, progressPercentage: 0 }
      }))
      
      // Start checking status periodically
      checkExpandedSynthesisStatus(briefId)
      
    } catch (error) {
      console.error('Error synthesizing expanded content:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to synthesize expanded content')
      setSynthesizingBriefs(prev => {
        const next = new Set(prev)
        next.delete(briefId)
        return next
      })
    }
  }

  const checkExpandedSynthesisStatus = async (briefId: string) => {
    try {
      const response = await fetch(`/api/news-briefs/${briefId}/synthesize-expanded/status`)
      
      if (response.ok) {
        const status = await response.json()
        
        setExpandedSynthesisStatus(prev => ({
          ...prev,
          [briefId]: { 
            isDone: status.isDone, 
            progressPercentage: status.progressPercentage || 0 
          }
        }))
        
        if (status.isDone) {
          // Synthesis complete
          setSynthesizingBriefs(prev => {
            const next = new Set(prev)
            next.delete(briefId)
            return next
          })
          
          if (status.audioUrl) {
            toast.success('Expanded content audio is ready!')
            loadData() // Refresh to show the audio
          } else if (status.error) {
            toast.error(`Synthesis failed: ${status.error}`)
          }
          
          // Remove from monitoring
          setExpandedSynthesisStatus(prev => {
            const next = { ...prev }
            delete next[briefId]
            return next
          })
        } else {
          // Still in progress, check again in 10 seconds
          setTimeout(() => checkExpandedSynthesisStatus(briefId), 10000)
        }
      }
    } catch (error) {
      console.error('Error checking expanded synthesis status:', error)
    }
  }

  const synthesizeSegment = async (briefId: string, segmentId: string) => {
    setSynthesizingBriefs(prev => new Set([...prev, briefId]))
    try {
      const response = await fetch(`/api/news-briefs/${briefId}/synthesize-segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmentId })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || 'Failed to synthesize segment')
      }

      const result = await response.json()
      toast.success(`Started synthesis for ${segmentId}`)
      
      // Refresh briefs to show updated status
      setTimeout(() => {
        loadData()
      }, 1000)
      
    } catch (error) {
      console.error('Error synthesizing segment:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to synthesize segment')
    } finally {
      setSynthesizingBriefs(prev => {
        const newSet = new Set(prev)
        newSet.delete(briefId)
        return newSet
      })
    }
  }

  const playAudio = async (briefId: string, audioUrl: string) => {
    try {
      // If clicking the same brief that's playing, pause it
      if (playingBriefId === briefId && currentAudio && !currentAudio.paused) {
        currentAudio.pause()
        setPlayingBriefId(null)
        setCurrentAudio(null)
        return
      }

      // Stop any currently playing audio
      if (currentAudio) {
        currentAudio.pause()
        currentAudio.src = '' // Clear the source to free up resources
        setCurrentAudio(null)
      }

      // Reset playing state first
      setPlayingBriefId(null)

      // Create and play new audio
      const audio = new Audio(audioUrl)
      
      // Set up event handlers before setting state
      audio.onloadstart = () => {
        console.log(`🎵 Loading audio for brief ${briefId}`)
      }
      
      audio.oncanplay = () => {
        console.log(`✅ Audio ready for brief ${briefId}`)
        setPlayingBriefId(briefId)
      }
      
      audio.onended = () => {
        console.log(`🏁 Audio ended for brief ${briefId}`)
        setPlayingBriefId(null)
        setCurrentAudio(null)
      }
      
      audio.onerror = (e) => {
        console.error(`❌ Audio error for brief ${briefId}:`, e)
        toast.error('Audio playback failed')
        setPlayingBriefId(null)
        setCurrentAudio(null)
      }

      audio.onpause = () => {
        console.log(`⏸️ Audio paused for brief ${briefId}`)
        if (playingBriefId === briefId) {
          setPlayingBriefId(null)
        }
      }

      // Set audio as current and attempt to play
      setCurrentAudio(audio)
      
      // Play the audio
      await audio.play()
      
    } catch (error) {
      console.error('Failed to play audio:', error)
      toast.error('Failed to play audio')
      setPlayingBriefId(null)
      setCurrentAudio(null)
    }
  }

  // Generate new brief
  const generateBrief = async (briefType?: string, language?: string) => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/news-briefs/generate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          briefType: briefType || generationStats?.currentBriefType,
          language: language || selectedLanguage
        })
      })

      if (!response.ok) throw new Error("Failed to generate brief")

      const result = await response.json()
      toast.success(`Generated ${result.brief.category} brief with ${result.stats.articlesSelected} articles`)
      loadData()
    } catch (error) {
      console.error("Error generating brief:", error)
      toast.error("Failed to generate brief")
    } finally {
      setLoading(false)
    }
  }

  // Manual trigger for all languages
  const triggerAllLanguages = async (briefType: string) => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/news-briefs/generate-all", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          briefType,
          languages: ["en", "zh-TW", "zh-CN"]
        })
      })

      if (!response.ok) throw new Error("Failed to trigger generation")

      const result = await response.json()
      const successCount = result.results?.filter((r: any) => r.status === 'success').length || 0
      toast.success(`Generated ${successCount} briefs across all languages`)
      loadData()
    } catch (error) {
      console.error("Error triggering generation:", error)
      toast.error("Failed to trigger generation")
    } finally {
      setLoading(false)
    }
  }

  // Save edited brief
  const saveBrief = async () => {
    if (!editingBrief) return

    try {
      const wordCount = editedContent.split(/\s+/).length
      const estimatedDuration = Math.round(wordCount / 150 * 60) // 150 WPM

      const response = await fetch(`/api/news-briefs/${editingBrief.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: editedContent,
          actual_word_count: wordCount,
          estimated_duration_seconds: estimatedDuration
        })
      })

      if (!response.ok) throw new Error("Failed to save brief")

      toast.success("Brief saved successfully")
      setEditingBrief(null)
      loadData()
    } catch (error) {
      console.error("Error saving brief:", error)
      toast.error("Failed to save brief")
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(4)}`
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">TTS News Briefs</h1>
          <p className="text-muted-foreground">
            Manage AI-generated news brief scripts for text-to-speech broadcasting
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={loadData} 
            variant="outline" 
            size="sm" 
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="briefs" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Briefs
          </TabsTrigger>
          <TabsTrigger value="articles" className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Articles
          </TabsTrigger>
          <TabsTrigger value="generate" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Briefs</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pipelineStats?.totalBriefs || 0}</div>
                <p className="text-xs text-muted-foreground">Last 7 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {pipelineStats ? formatDuration(pipelineStats.averageDuration) : '0:00'}
                </div>
                <p className="text-xs text-muted-foreground">Minutes:Seconds</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available Articles</CardTitle>
                <Mic className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {generationStats?.availableArticles.find(a => a.language === selectedLanguage)?.articleCount || 0}
                </div>
                <p className="text-xs text-muted-foreground">For {selectedLanguage}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Next Brief</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {generationStats?.currentBriefType || 'Unknown'}
                </div>
                <p className="text-xs text-muted-foreground">Based on HKT time</p>
              </CardContent>
            </Card>
          </div>

          {/* Language breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Brief Distribution</CardTitle>
              <CardDescription>
                Breakdown by language and category over the last 7 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {['en', 'zh-TW', 'zh-CN'].map(lang => (
                  <div key={lang} className="space-y-2">
                    <h4 className="font-medium">{lang}</h4>
                    {['morning', 'afternoon', 'evening'].map(cat => (
                      <div key={cat} className="flex justify-between text-sm">
                        <span className="capitalize">{cat}</span>
                        <span>{pipelineStats?.byLanguageAndCategory[`${lang}_${cat}`] || 0}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Briefs Management Tab */}
        <TabsContent value="briefs" className="space-y-4">
          <div className="flex gap-4 mb-4">
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="zh-TW">Traditional Chinese</SelectItem>
                <SelectItem value="zh-CN">Simplified Chinese</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedCategory || "all"} onValueChange={(value) => setSelectedCategory(value === "all" ? "" : value)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="morning">Morning</SelectItem>
                <SelectItem value="afternoon">Afternoon</SelectItem>
                <SelectItem value="evening">Evening</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4">
            {briefs.map((brief) => (
              <Card key={brief.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{brief.title}</CardTitle>
                      <CardDescription>
                        {new Date(brief.created_at).toLocaleString()} • {brief.language} • {brief.category}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary">
                        {formatDuration(brief.estimated_duration_seconds)}
                      </Badge>
                      <Badge variant="outline">
                        {brief.actual_word_count} words
                      </Badge>
                      <Badge variant="outline">
                        {formatCurrency(brief.generation_cost_usd)}
                      </Badge>
                      {brief.audio_url && (
                        <Badge variant="default" className="bg-green-600">
                          <Volume2 className="h-3 w-3 mr-1" />
                          Audio
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Brief preview */}
                    <div className="bg-muted p-4 rounded-lg">
                      <p className="text-sm line-clamp-3">{brief.content}</p>
                    </div>

                    {/* Expanded Content from Step 1 */}
                    {brief.expanded_content && brief.expanded_content.length > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            <div className="font-medium">Step 1: Expanded Content</div>
                            <div className="text-muted-foreground">
                              {brief.expanded_content.length} articles expanded • 
                              {brief.expanded_content.reduce((sum, article) => sum + article.wordCount, 0)} total words • 
                              {brief.expanded_content.reduce((sum, article) => sum + article.characterCount, 0)} characters
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="secondary">
                              Pre-Broadcast
                            </Badge>
                            {brief.expanded_audio_url ? (
                              <Badge variant="default" className="bg-amber-600">
                                <Volume2 className="h-3 w-3 mr-1" />
                                TTS Ready
                              </Badge>
                            ) : synthesizingBriefs.has(brief.id) ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="animate-pulse">
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Synthesizing... {expandedSynthesisStatus[brief.id]?.progressPercentage || 0}%
                                </Badge>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => synthesizeExpandedContent(brief.id)}
                                disabled={synthesizingBriefs.has(brief.id)}
                              >
                                <Mic className="h-4 w-4 mr-2" />
                                Generate Long Audio
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {/* Show first few expanded articles */}
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {brief.expanded_content.slice(0, 3).map((article, idx) => (
                            <div key={idx} className="text-xs p-2 bg-background/50 rounded">
                              <div className="flex items-center justify-between mb-1">
                                <div className="font-medium truncate">
                                  {article.title}
                                </div>
                                <div className="flex gap-2">
                                  <Badge variant="outline" className="h-5 text-xs">
                                    {article.category}
                                  </Badge>
                                  <span className="text-muted-foreground">
                                    {article.wordCount}w • {article.characterCount}c
                                  </span>
                                </div>
                              </div>
                              <div className="text-muted-foreground line-clamp-2">
                                {article.expandedContent}
                              </div>
                            </div>
                          ))}
                          {brief.expanded_content.length > 3 && (
                            <div className="text-xs text-center text-muted-foreground">
                              +{brief.expanded_content.length - 3} more expanded articles
                            </div>
                          )}
                        </div>

                        {/* Expanded Content TTS Audio Controls */}
                        {brief.expanded_audio_url && (
                          <div className="pt-2 border-t">
                            <div className="flex items-center justify-between">
                              <div className="text-xs">
                                <div className="font-medium">Long Audio Available</div>
                                <div className="text-muted-foreground">
                                  Duration: {formatDuration(brief.expanded_audio_duration || 0)} • 
                                  Cost: {formatCurrency(brief.expanded_tts_cost || 0)}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => playAudio(`${brief.id}-expanded`, brief.expanded_audio_url!)}
                                  disabled={synthesizingBriefs.has(brief.id)}
                                >
                                  {playingBriefId === `${brief.id}-expanded` ? (
                                    <Pause className="h-4 w-4 mr-2" />
                                  ) : (
                                    <Play className="h-4 w-4 mr-2" />
                                  )}
                                  {playingBriefId === `${brief.id}-expanded` ? 'Pause' : 'Play'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const link = document.createElement('a')
                                    link.href = brief.expanded_audio_url!
                                    link.download = `${brief.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_expanded_${brief.language}.wav`
                                    document.body.appendChild(link)
                                    link.click()
                                    document.body.removeChild(link)
                                  }}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  WAV
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const link = document.createElement('a')
                                    link.href = `/api/news-briefs/${brief.id}/download-expanded-mp3`
                                    link.download = `${brief.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_expanded_${brief.language}.mp3`
                                    document.body.appendChild(link)
                                    link.click()
                                    document.body.removeChild(link)
                                  }}
                                >
                                  <Download className="h-4 w-4 mr-2 text-blue-600" />
                                  MP3
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Article breakdown */}
                    {brief.news_brief_articles && brief.news_brief_articles.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">
                          Articles Included ({brief.news_brief_articles.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {brief.news_brief_articles.slice(0, 4).map((articleRef) => (
                            <div key={articleRef.article_id} className="text-xs p-2 bg-muted/50 rounded">
                              <div className="font-medium truncate">
                                {articleRef.articles?.title || 'Unknown Article'}
                              </div>
                              <div className="text-muted-foreground">
                                {articleRef.articles?.source} • {articleRef.articles?.category}
                              </div>
                            </div>
                          ))}
                          {brief.news_brief_articles.length > 4 && (
                            <div className="text-xs p-2 bg-muted/50 rounded flex items-center justify-center">
                              +{brief.news_brief_articles.length - 4} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TTS Audio Section */}
                    {brief.audio_url && (
                      <div className="bg-muted/30 p-3 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            <div className="font-medium">Audio Available</div>
                            <div className="text-muted-foreground">
                              Duration: {formatDuration(brief.audio_duration_seconds || 0)} • 
                              Size: {brief.audio_file_size_bytes ? `${(brief.audio_file_size_bytes / 1024).toFixed(1)} KB` : 'Unknown'} • 
                              Cost: {formatCurrency(brief.tts_synthesis_cost_usd || 0)}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => playAudio(brief.id, brief.audio_url!)}
                              disabled={synthesizingBriefs.has(brief.id)}
                            >
                              {playingBriefId === brief.id ? (
                                <Pause className="h-4 w-4 mr-2" />
                              ) : (
                                <Play className="h-4 w-4 mr-2" />
                              )}
                              {playingBriefId === brief.id ? 'Pause' : 'Play'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const link = document.createElement('a')
                                link.href = brief.audio_url!
                                link.download = `${brief.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${brief.language}.wav`
                                document.body.appendChild(link)
                                link.click()
                                document.body.removeChild(link)
                              }}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              WAV
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const link = document.createElement('a')
                                link.href = `/api/news-briefs/${brief.id}/download-full-mp3`
                                link.download = `${brief.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${brief.language}.mp3`
                                document.body.appendChild(link)
                                link.click()
                                document.body.removeChild(link)
                              }}
                            >
                              <Download className="h-4 w-4 mr-2 text-blue-600" />
                              MP3
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Audio
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete TTS Audio</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the synthesized audio file. 
                                    You can regenerate it later if needed.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteTTSAudio(brief.id)}>
                                    Delete Audio
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Dialogue Segments Section */}
                    {brief.dialogue_segments && brief.dialogue_segments.length > 0 && (
                      <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            <div className="font-medium">Dialogue Format</div>
                            <div className="text-muted-foreground">
                              {brief.dialogue_segments.length} segments • 
                              {brief.dialogue_segments.filter(s => s.speaker === 'male').length} male • 
                              {brief.dialogue_segments.filter(s => s.speaker === 'female').length} female
                            </div>
                          </div>
                          <Badge variant="secondary">
                            Two-Broadcaster
                          </Badge>
                        </div>
                        
                        {/* Show first few dialogue segments */}
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {brief.dialogue_segments.slice(0, 4).map((segment, idx) => (
                            <div key={segment.id} className="text-xs p-2 bg-background/50 rounded">
                              <div className="flex items-center justify-between mb-1">
                                <Badge variant={segment.speaker === 'male' ? 'default' : 'secondary'} className="h-5">
                                  {segment.speaker === 'male' ? '👨 Male' : '👩 Female'}
                                </Badge>
                                <span className="text-muted-foreground">
                                  {segment.wordCount} words • {segment.estimatedDuration}s
                                </span>
                              </div>
                              <div className="text-muted-foreground line-clamp-2">
                                {segment.content}
                              </div>
                            </div>
                          ))}
                          {brief.dialogue_segments.length > 4 && (
                            <div className="text-xs text-center text-muted-foreground">
                              +{brief.dialogue_segments.length - 4} more segments
                            </div>
                          )}
                        </div>

                        {/* Dialogue Operations Status */}
                        {brief.dialogue_segments && brief.dialogue_segments.length > 0 && (
                          <div className="pt-2 border-t">
                            <div className="text-xs font-medium mb-2">Individual Synthesis</div>
                            <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
                              {brief.dialogue_segments.map((segment: DialogueSegment) => {
                                const operation = brief.tts_dialogue_operations?.find((op: DialogueOperation) => op.segmentId === segment.id)
                                return (
                                  <div key={segment.id} className="flex items-center justify-between text-xs p-1 bg-background/30 rounded">
                                    <div className="flex items-center gap-1">
                                      <Badge variant={segment.speaker === 'male' ? 'default' : 'secondary'} className="h-4 text-xs">
                                        {segment.speaker === 'male' ? '👨' : '👩'}
                                      </Badge>
                                      <span className="text-muted-foreground text-xs">{segment.id}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {operation?.error ? (
                                        <Badge variant="destructive" className="h-4 text-xs">Error</Badge>
                                      ) : operation?.audioUrl ? (
                                        <div className="flex items-center gap-1">
                                          <Badge variant="default" className="h-4 text-xs">Ready</Badge>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 w-5 p-0"
                                            onClick={() => {
                                              const link = document.createElement('a')
                                              link.href = operation.audioUrl!
                                              link.download = `${brief.title.replace(/[^a-z0-9]/gi, '_')}_${segment.id}.wav`
                                              document.body.appendChild(link)
                                              link.click()
                                              document.body.removeChild(link)
                                            }}
                                            title="Download WAV"
                                          >
                                            <Download className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 w-5 p-0"
                                            onClick={() => {
                                              const link = document.createElement('a')
                                              link.href = `/api/news-briefs/${brief.id}/download-mp3?segmentId=${segment.id}`
                                              link.download = `${brief.title.replace(/[^a-z0-9]/gi, '_')}_${segment.id}.mp3`
                                              document.body.appendChild(link)
                                              link.click()
                                              document.body.removeChild(link)
                                            }}
                                            title="Download MP3"
                                          >
                                            <Download className="h-3 w-3 text-blue-600" />
                                          </Button>
                                        </div>
                                      ) : operation?.operationName ? (
                                        <Badge variant="secondary" className="h-4 text-xs">Processing</Badge>
                                      ) : (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 w-5 p-0"
                                          onClick={() => synthesizeSegment(brief.id, segment.id)}
                                          disabled={synthesizingBriefs.has(brief.id)}
                                        >
                                          <Mic className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>{brief.title}</DialogTitle>
                            <DialogDescription>
                              {formatDuration(brief.estimated_duration_seconds)} • {brief.actual_word_count} words • {brief.language}
                            </DialogDescription>
                          </DialogHeader>
                          <ScrollArea className="h-96 w-full">
                            <div className="whitespace-pre-wrap text-sm p-4">
                              {brief.content}
                            </div>
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>

                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setEditingBrief(brief)
                          setEditedContent(brief.content)
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>

                      {/* TTS Synthesis Button - only for non-dialogue briefs */}
                      {!brief.audio_url && (!brief.dialogue_segments || brief.dialogue_segments.length === 0) && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => synthesizeTTS(brief.id)}
                          disabled={synthesizingBriefs.has(brief.id)}
                        >
                          {synthesizingBriefs.has(brief.id) ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Mic className="h-4 w-4 mr-2" />
                          )}
                          {synthesizingBriefs.has(brief.id) ? 'Synthesizing...' : 'Generate Audio'}
                        </Button>
                      )}

                      {/* Info for dialogue briefs */}
                      {brief.dialogue_segments && brief.dialogue_segments.length > 0 && !brief.audio_url && (
                        <div className="text-xs text-muted-foreground italic">
                          Use individual segment synthesis 🎙️ below
                        </div>
                      )}

                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          window.open(`/api/news-briefs/${brief.id}/export?format=txt`, '_blank')
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Articles Selection Tab */}
        <TabsContent value="articles" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Article Selection for TTS News Briefs</h3>
              <p className="text-sm text-muted-foreground">
                Select stories for trilingual news briefs. Selection ensures consistent coverage across EN/ZH-CN/ZH-TW.
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={loadArticleRecommendations} 
                variant="outline" 
                size="sm" 
                disabled={articleLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${articleLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Filters and Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <Label htmlFor="article-language">Language</Label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="zh-TW">Traditional Chinese</SelectItem>
                  <SelectItem value="zh-CN">Simplified Chinese</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="article-category">Category</Label>
              <Select value={selectedCategory || "all"} onValueChange={(value) => setSelectedCategory(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="News">News</SelectItem>
                  <SelectItem value="Local">Local</SelectItem>
                  <SelectItem value="Politics">Politics</SelectItem>
                  <SelectItem value="International">International</SelectItem>
                  <SelectItem value="General">General</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Quick Actions</Label>
              <Button 
                onClick={autoSelectArticles} 
                disabled={articleLoading}
                size="sm"
                className="justify-start"
              >
                <Plus className="h-4 w-4 mr-2" />
                AI Auto-Select (Top 15)
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Selection Control</Label>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-start">
                    <X className="h-4 w-4 mr-2" />
                    Clear All Selections
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear All Article Selections</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will clear ALL TTS selection flags across all languages (EN, ZH-CN, ZH-TW). 
                      All previously selected articles will be available for selection again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={clearArticleSelection}>
                      Clear All Selections
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Statistics */}
          {articleSelectionStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Available Articles</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{articleSelectionStats.totalAvailable}</div>
                  <p className="text-xs text-muted-foreground">English stories available</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Currently Selected</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{articleSelectionStats.currentlySelected}</div>
                  <p className="text-xs text-muted-foreground">Stories selected (trilingual)</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{articleSelectionStats.totalRecommendations}</div>
                  <p className="text-xs text-muted-foreground">AI-scored suggestions</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Manual Selection</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{selectedArticleIds.length}</div>
                  <p className="text-xs text-muted-foreground">
                    <Button 
                      onClick={selectArticles} 
                      disabled={selectedArticleIds.length === 0 || articleLoading}
                      size="sm"
                      className="w-full mt-2"
                    >
                      Select {selectedArticleIds.length} Articles
                    </Button>
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Selected Articles List */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Selected Articles for TTS ({selectedArticles.length})
                </CardTitle>
                <CardDescription>
                  Articles currently selected for TTS news brief generation. Showing {selectedLanguage} articles.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedArticles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="h-12 w-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No Articles Selected</h3>
                    <p className="text-muted-foreground mb-6">
                      Use the "AI Auto-Select (Top 15)" button above to intelligently select stories for TTS generation.
                    </p>
                    <div className="text-sm text-muted-foreground">
                      <div className="grid grid-cols-2 gap-4 text-left max-w-md mx-auto">
                        <div>
                          <strong>Selection:</strong> 15 English stories
                        </div>
                        <div>
                          <strong>Result:</strong> 45 total articles (EN/ZH-CN/ZH-TW)
                        </div>
                        <div>
                          <strong>Coverage:</strong> All news categories
                        </div>
                        <div>
                          <strong>Consistency:</strong> Same stories across languages
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-3">
                      {selectedArticles.map((article) => (
                        <div 
                          key={article.id} 
                          className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="secondary" className="text-xs">
                                  {article.category}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {article.language_variant}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {article.source}
                                </span>
                              </div>
                              <h4 className="font-medium text-sm leading-tight mb-2 line-clamp-2">
                                {article.title}
                              </h4>
                              <div className="text-xs text-muted-foreground">
                                Selected: {new Date(article.tts_selection_metadata?.selected_at || article.created_at).toLocaleString()}
                                {article.tts_selection_metadata?.selection_reason && (
                                  <span className="ml-2">
                                    • {article.tts_selection_metadata.selection_reason}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(article.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedArticles.length > 0 && (
                      <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                        <div className="text-sm text-muted-foreground">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <strong>Total Selected:</strong> {selectedArticles.length} articles
                            </div>
                            <div>
                              <strong>Language:</strong> {selectedLanguage}
                            </div>
                            <div>
                              <strong>Categories:</strong> {
                                [...new Set(selectedArticles.map(a => a.category))].join(', ')
                              }
                            </div>
                            <div>
                              <strong>Sources:</strong> {
                                [...new Set(selectedArticles.map(a => a.source))].slice(0, 3).join(', ')
                              }
                              {[...new Set(selectedArticles.map(a => a.source))].length > 3 && ' ...'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Generate Tab */}
        <TabsContent value="generate" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Generate</CardTitle>
                <CardDescription>
                  Generate a single news brief for testing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="gen-language">Language</Label>
                    <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="zh-TW">Traditional Chinese</SelectItem>
                        <SelectItem value="zh-CN">Simplified Chinese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="gen-type">Brief Type</Label>
                    <Select value={selectedBriefType} onValueChange={setSelectedBriefType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="morning">Morning</SelectItem>
                        <SelectItem value="afternoon">Afternoon</SelectItem>
                        <SelectItem value="evening">Evening</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button 
                  onClick={() => generateBrief(selectedBriefType, selectedLanguage)} 
                  disabled={loading}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Brief
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bulk Generate</CardTitle>
                <CardDescription>
                  Generate briefs for all languages at once
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  {['morning', 'afternoon', 'evening'].map(type => (
                    <Button 
                      key={type}
                      variant="outline" 
                      onClick={() => triggerAllLanguages(type)}
                      disabled={loading}
                      className="justify-start"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Generate {type} briefs (All languages)
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>TTS Audio Generation</CardTitle>
                <CardDescription>
                  Synthesize audio for existing news briefs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground mb-4">
                  Generate high-quality TTS audio for 8-12 minute comprehensive news briefs using Google's Studio voices.
                </div>
                <div className="grid gap-2">
                  <div className="text-xs text-muted-foreground">
                    • English: Studio voice (premium quality)
                    • Chinese: WaveNet voices (high quality)
                    • Optimized for news broadcasting
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  disabled={loading}
                  onClick={() => {
                    toast.info("Use the 'Generate Audio' button on individual briefs in the Briefs tab")
                  }}
                  className="w-full"
                >
                  <Volume2 className="h-4 w-4 mr-2" />
                  Audio synthesis available per brief
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generation Settings</CardTitle>
              <CardDescription>
                Configure TTS brief generation parameters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Target Duration</Label>
                  <p className="text-sm text-muted-foreground">
                    8-12 minutes (comprehensive coverage)
                  </p>
                </div>
                <div>
                  <Label>Target Word Count</Label>
                  <p className="text-sm text-muted-foreground">
                    ~1500 words (expanded format)
                  </p>
                </div>
                <div>
                  <Label>Speaking Rate</Label>
                  <p className="text-sm text-muted-foreground">
                    {generationStats?.wordsPerMinute} words per minute
                  </p>
                </div>
                <div>
                  <Label>OpenAI Model</Label>
                  <p className="text-sm text-muted-foreground">
                    gpt-4o-mini
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      {editingBrief && (
        <Dialog open={!!editingBrief} onOpenChange={() => setEditingBrief(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Edit Brief: {editingBrief.title}</DialogTitle>
              <DialogDescription>
                Edit the TTS script content. Word count and duration will be recalculated.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-content">Content</Label>
                <Textarea
                  id="edit-content"
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                  placeholder="Enter TTS script content..."
                />
              </div>
              <div className="text-sm text-muted-foreground">
                Word count: {editedContent.split(/\s+/).length} • 
                Estimated duration: {formatDuration(Math.round(editedContent.split(/\s+/).length / 150 * 60))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingBrief(null)}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={saveBrief}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}