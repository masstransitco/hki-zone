"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { supabaseAuth } from "@/lib/supabase-auth"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import SourceCitations from "./source-citations"
import ImageGallery from "./image-gallery"
import FileUploader from "./file-uploader"
import { 
  ExternalLink, 
  Calendar, 
  Globe, 
  Image as ImageIcon,
  FileText,
  Brain,
  Copy,
  Trash2,
  RefreshCw,
  Sparkles,
  Loader2,
  Edit,
  Save,
  X,
  Wand2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Undo2,
  Eye,
  EyeOff
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { Article } from "@/lib/types"

interface ArticleDetailSheetProps {
  article: Article | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onArticleUpdate?: (updatedArticle: Article) => void
  onArticleDelete?: (articleId: string) => void
}

interface SaveState {
  status: 'idle' | 'saving' | 'saved' | 'error'
  message?: string
  lastSaved?: Date
}

interface UnsavedChanges {
  [key: string]: boolean
}

export default function ArticleDetailSheet({ 
  article, 
  open, 
  onOpenChange, 
  onArticleUpdate,
  onArticleDelete 
}: ArticleDetailSheetProps) {
  // Early return to avoid hook order issues
  if (!article) {
    return null
  }

  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isGeneratingOpenAIImage, setIsGeneratingOpenAIImage] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' })
  const [unsavedChanges, setUnsavedChanges] = useState<UnsavedChanges>({})
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const [previewMode, setPreviewMode] = useState(false)
  const [activeTab, setActiveTab] = useState('content')
  
  // Form state for editing
  const [editForm, setEditForm] = useState({
    title: '',
    summary: '',
    content: '',
    imageUrl: '',
    category: '',
    language: '',
  })
  
  // Track the saved baseline to compare against for unsaved changes
  const [savedBaseline, setSavedBaseline] = useState<typeof editForm | null>(null)
  
  // Reset all states when article changes
  useEffect(() => {
    if (article) {
      // Reset all editor states when article changes
      setIsEditing(false)
      setPreviewMode(false)
      setUnsavedChanges({})
      setSaveState({ status: 'idle' })
      setSavedBaseline(null)
      setActiveTab('content')
      
      // Initialize form with new article data
      const initialForm = {
        title: article.title || '',
        summary: article.summary || '',
        content: article.content || '',
        imageUrl: article.imageUrl || '',
        category: article.category || 'General',
        language: article.language || 'en',
      }
      setEditForm(initialForm)
    }
  }, [article?.id])

  // Initialize form when entering edit mode
  useEffect(() => {
    if (article && isEditing && !savedBaseline) {
      const initialForm = {
        title: article.title || '',
        summary: article.summary || '',
        content: article.content || '',
        imageUrl: article.imageUrl || '',
        category: article.category || 'General',
        language: article.language || 'en',
      }
      setEditForm(initialForm)
      setSavedBaseline(initialForm)
      setUnsavedChanges({})
      setSaveState({ status: 'idle' })
    }
  }, [article?.id, isEditing, savedBaseline])

  // Handle form field changes with change tracking
  const handleFieldChange = useCallback((field: keyof typeof editForm, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }))
    setUnsavedChanges(prev => ({ ...prev, [field]: true }))
    
    // Reset error state when user starts typing
    if (saveState.status === 'error') {
      setSaveState({ status: 'idle' })
    }
  }, [saveState.status])

  // Realtime subscription for article updates
  useEffect(() => {
    if (!article?.id || !open) return

    const channel = supabaseAuth
      .channel(`article-${article.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'articles',
          filter: `id=eq.${article.id}`,
        },
        (payload) => {
          console.log('📡 Realtime article update received:', payload)
          
          // Check if this is an external change (not from current session)
          if (payload.new && payload.old) {
            const updatedArticle = payload.new as any
            
            // Update the article data via callback
            if (onArticleUpdate) {
              onArticleUpdate(updatedArticle)
            }
            
            // If not currently editing, update form state as well
            if (!isEditing) {
              const newFormData = {
                title: updatedArticle.title || '',
                summary: updatedArticle.summary || '',
                content: updatedArticle.content || '',
                imageUrl: updatedArticle.image_url || '',
                category: updatedArticle.category || '',
                language: updatedArticle.enhancement_metadata?.language || updatedArticle.language_variant || '',
              }
              
              setEditForm(newFormData)
              setSavedBaseline(newFormData)
              setUnsavedChanges({})
              
              // Show toast notification for external changes
              if (updatedArticle.image_url !== article.imageUrl) {
                toast.info('Article image updated from another session', {
                  description: 'The article image has been synchronized'
                })
              } else {
                toast.info('Article updated from another session', {
                  description: 'The article has been modified externally'
                })
              }
            }
          }
        }
      )
      .subscribe()

    return () => {
      console.log('🔌 Unsubscribing from article realtime updates')
      supabaseAuth.removeChannel(channel)
    }
  }, [article?.id, open, isEditing, onArticleUpdate])

  // Handle image URL changes with automatic trilingual sync
  const handleImageUrlChange = useCallback(async (newImageUrl: string) => {
    // Update form state immediately
    handleFieldChange('imageUrl', newImageUrl)
    
    // If this is an AI enhanced article, sync the image across trilingual versions
    if (article.isAiEnhanced && newImageUrl) {
      try {
        const response = await fetch(`/api/admin/articles/${article.id}/sync-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageUrl: newImageUrl }),
        })

        const result = await response.json()

        if (response.ok && result.success) {
          toast.success(result.message, {
            description: result.languages ? `Languages: ${result.languages}` : undefined
          })
        } else {
          console.warn('Image sync failed:', result.error)
          // Don't show error toast as the main update still worked
        }
      } catch (error) {
        console.error('Error syncing image URL:', error)
        // Silent fail - main update still worked
      }
    }
  }, [article, handleFieldChange])

  // Check for unsaved changes against saved baseline
  const hasUnsavedChanges = useMemo(() => {
    if (!savedBaseline || !isEditing) return false
    return (
      editForm.title !== savedBaseline.title ||
      editForm.summary !== savedBaseline.summary ||
      editForm.content !== savedBaseline.content ||
      editForm.imageUrl !== savedBaseline.imageUrl ||
      editForm.category !== savedBaseline.category ||
      editForm.language !== savedBaseline.language
    )
  }, [savedBaseline, editForm, isEditing])

  const handleSave = useCallback(async (isAutoSave = false) => {
    if (saveState.status === 'saving') return
    
    setSaveState({ status: 'saving', message: isAutoSave ? 'Auto-saving...' : 'Saving...' })
    
    try {
      const response = await fetch(`/api/admin/articles/${article.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editForm.title,
          summary: editForm.summary,
          content: editForm.content,
          imageUrl: editForm.imageUrl || null,
          category: editForm.category,
          language: editForm.language === 'en' ? null : editForm.language,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update article')
      }
      
      // Create updated article object
      const updatedArticle: Article = {
        ...article,
        title: editForm.title,
        summary: editForm.summary,
        content: editForm.content,
        imageUrl: editForm.imageUrl || undefined,
        category: editForm.category,
        language: editForm.language === 'en' ? undefined : editForm.language,
      }
      
      // Update React Query cache optimistically
      queryClient.setQueryData(['admin-articles'], (oldData: any) => {
        if (!oldData) return oldData
        
        const updatedPages = oldData.pages.map((page: any) => ({
          ...page,
          articles: page.articles.map((a: Article) => 
            a.id === article.id ? updatedArticle : a
          )
        }))
        
        return { ...oldData, pages: updatedPages }
      })
      
      // Call the parent update callback
      if (onArticleUpdate) {
        onArticleUpdate(updatedArticle)
      }
      
      setSaveState({ 
        status: 'saved', 
        message: isAutoSave ? 'Auto-saved' : 'Saved successfully',
        lastSaved: new Date()
      })
      
      if (!isAutoSave) {
        toast.success('Article updated successfully')
        setIsEditing(false)
      }
      
      setUnsavedChanges({})
      
      // Update the saved baseline to current form values
      setSavedBaseline({ ...editForm })
      
      // Clear saved status after 3 seconds
      setTimeout(() => {
        setSaveState(prev => prev.status === 'saved' ? { status: 'idle' } : prev)
      }, 3000)
      
    } catch (error) {
      console.error('Error saving article:', error)
      setSaveState({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Failed to save'
      })
      
      if (!isAutoSave) {
        toast.error('Failed to save article', {
          description: error instanceof Error ? error.message : 'Unknown error occurred'
        })
      }
    }
  }, [article, editForm, queryClient, onArticleUpdate, saveState.status])

  // Auto-save functionality
  useEffect(() => {
    if (!autoSaveEnabled || !hasUnsavedChanges || saveState.status === 'saving') return

    const autoSaveTimer = setTimeout(() => {
      handleSave(true) // true indicates auto-save
    }, 3000) // Auto-save after 3 seconds of inactivity

    return () => clearTimeout(autoSaveTimer)
  }, [editForm, hasUnsavedChanges, autoSaveEnabled, saveState.status, handleSave])

  const publishedDate = article.publishedAt ? new Date(article.publishedAt) : new Date()
  const hasImage = article.imageUrl && !article.imageUrl.includes("placeholder")
  const contentLength = article.content?.length || 0
  const summaryLength = article.summary?.length || 0

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(article.url)
    toast.success("URL copied to clipboard")
  }, [article])

  const handleCopyField = useCallback((fieldName: string, value: string) => {
    if (!value) {
      toast.error(`No ${fieldName} to copy`)
      return
    }
    navigator.clipboard.writeText(value)
    toast.success(`${fieldName} copied to clipboard`)
  }, [])

  const handleOpenOriginal = useCallback(() => {
    window.open(article.url, '_blank')
  }, [article])
  
  const handleDelete = useCallback(async () => {
    
    setSaveState({ status: 'saving', message: 'Deleting article...' })
    
    try {
      const response = await fetch(`/api/admin/articles/${article.id}`, {
        method: 'DELETE',
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete article')
      }
      
      // Update React Query cache optimistically
      queryClient.setQueryData(['admin-articles'], (oldData: any) => {
        if (!oldData) return oldData
        
        const updatedPages = oldData.pages.map((page: any) => ({
          ...page,
          articles: page.articles.filter((a: Article) => a.id !== article.id)
        }))
        
        return { ...oldData, pages: updatedPages }
      })
      
      // Call the parent delete callback
      if (onArticleDelete) {
        onArticleDelete(article.id)
      }
      
      toast.success('Article deleted successfully')
      onOpenChange(false)
      
    } catch (error) {
      console.error('Error deleting article:', error)
      setSaveState({ status: 'error', message: 'Failed to delete article' })
      toast.error('Failed to delete article', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    } finally {
      setShowDeleteDialog(false)
    }
  }, [article, queryClient, onArticleDelete, onOpenChange])
  
  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmDiscard = confirm('You have unsaved changes. Are you sure you want to discard them?')
      if (!confirmDiscard) return
    }
    
    setIsEditing(false)
    setPreviewMode(false)
    setUnsavedChanges({})
    setSaveState({ status: 'idle' })
    setSavedBaseline(null) // Reset baseline so form reinitializes next time
    
    // Reset form to original values
    if (article) {
      setEditForm({
        title: article.title || '',
        summary: article.summary || '',
        content: article.content || '',
        imageUrl: article.imageUrl || '',
        category: article.category || 'General',
        language: article.language || 'en',
      })
    }
  }, [hasUnsavedChanges, article])

  const handleGenerateAIImage = useCallback(async () => {
    if (!article.imageUrl) {
      toast.error('No image URL available for generation')
      return
    }

    setIsGeneratingImage(true)
    const toastId = 'getimg-generation'
    
    toast.loading('🚀 Starting generic scene generation...', { id: toastId })
    
    try {
      const response = await fetch('/api/admin/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: article.imageUrl,
          articleId: article.id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate AI image')
      }

      // Update the form with the new image URL and sync across trilingual articles
      if (data.imageUrl) {
        toast.loading('🔄 Syncing across languages...', { id: toastId })
        await handleImageUrlChange(data.imageUrl)
      }
      
      toast.success('✅ Generic scene generated successfully!', { id: toastId })
    } catch (error) {
      console.error('AI image generation error:', error)
      toast.error('Failed to generate generic scene', {
        id: toastId,
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    } finally {
      setIsGeneratingImage(false)
    }
  }, [article])

  const handleGenerateOpenAIImage = useCallback(async () => {
    if (!article.imageUrl) {
      toast.error('No image URL available for enhancement')
      return
    }

    setIsGeneratingOpenAIImage(true)
    
    // Use a single toast with ID to update its content
    const toastId = 'openai-generation'
    
    toast.loading('🚀 Starting AI image generation...', { id: toastId })
    
    try {
      toast.loading('📝 Analyzing article content with GPT-4...', { id: toastId })
      
      const response = await fetch('/api/admin/generate-openai-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: article.imageUrl,
          articleId: article.id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enhance image')
      }

      toast.loading('🎨 Generating image with DALL-E 3...', { id: toastId })
      
      // Update the form with the new image URL and sync across trilingual articles
      if (data.imageUrl) {
        toast.loading('🔄 Syncing across languages...', { id: toastId })
        await handleImageUrlChange(data.imageUrl)
      }
      
      toast.success('✅ Editorial image generated successfully!', { id: toastId })
    } catch (error) {
      console.error('OpenAI image enhancement error:', error)
      toast.error('Failed to generate editorial image', {
        id: toastId,
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    } finally {
      setIsGeneratingOpenAIImage(false)
    }
  }, [article])


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[90vw] lg:max-w-[60vw] overflow-y-auto">
        <SheetHeader className="space-y-3 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                {isEditing ? (
                  <div className="flex-1">
                    <div className="flex gap-1">
                      <Input
                        value={editForm.title}
                        onChange={(e) => handleFieldChange('title', e.target.value)}
                        className={`text-xl font-semibold transition-colors ${
                          unsavedChanges.title ? 'border-amber-300 bg-amber-50/30' : ''
                        }`}
                        placeholder="Article title"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyField('Title', editForm.title)}
                        className="h-14 px-3"
                        title="Copy title"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    {unsavedChanges.title && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                        <Clock className="h-3 w-3" />
                        <span>Unsaved changes</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <SheetTitle className="text-xl font-semibold leading-tight line-clamp-3 flex-1">
                      {article.title}
                    </SheetTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyField('Title', article.title)}
                      className="h-8 px-2 flex-shrink-0"
                      title="Copy title"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    {article.isAiEnhanced && (
                      <Sparkles className="h-5 w-5 text-purple-600 flex-shrink-0 mt-1" />
                    )}
                  </>
                )}
              </div>
              <SheetDescription className="mt-2 text-base flex items-center gap-2">
                {isEditing ? (
                  <>
                    <span>Edit article details</span>
                    {saveState.status !== 'idle' && (
                      <div className="flex items-center gap-1">
                        {saveState.status === 'saving' && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {saveState.status === 'saved' && (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        )}
                        {saveState.status === 'error' && (
                          <AlertCircle className="h-3 w-3 text-red-500" />
                        )}
                        <span className="text-xs">{saveState.message}</span>
                      </div>
                    )}
                  </>
                ) : (
                  'Full-screen article editor and management'
                )}
              </SheetDescription>
            </div>
            <div className="flex flex-col gap-2">
              {!isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Badge variant="secondary" className="text-sm">{article.source}</Badge>
                  {article.isAiEnhanced && (
                    <Badge variant="outline" className="text-sm bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Enhanced
                    </Badge>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleSave(false)}
                      disabled={saveState.status === 'saving'}
                      className={hasUnsavedChanges ? 'bg-green-600 hover:bg-green-700' : ''}
                    >
                      {saveState.status === 'saving' ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-1" />
                      )}
                      {hasUnsavedChanges ? 'Save Changes' : 'Save'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewMode(!previewMode)}
                      disabled={saveState.status === 'saving'}
                    >
                      {previewMode ? (
                        <Edit className="h-4 w-4 mr-1" />
                      ) : (
                        <Eye className="h-4 w-4 mr-1" />
                      )}
                      {previewMode ? 'Edit' : 'Preview'}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancel}
                      disabled={saveState.status === 'saving'}
                    >
                      {hasUnsavedChanges ? (
                        <Undo2 className="h-4 w-4 mr-1" />
                      ) : (
                        <X className="h-4 w-4 mr-1" />
                      )}
                      {hasUnsavedChanges ? 'Discard' : 'Cancel'}
                    </Button>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        id="autosave"
                        checked={autoSaveEnabled}
                        onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                        className="h-3 w-3"
                      />
                      <label htmlFor="autosave">Auto-save</label>
                    </div>
                  </div>
                  {saveState.lastSaved && (
                    <div className="text-xs text-muted-foreground">
                      Last saved: {formatDistanceToNow(saveState.lastSaved, { addSuffix: true })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Unsaved Changes Alert */}
        {hasUnsavedChanges && isEditing && (
          <Alert className="border-amber-200 bg-amber-50/30">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              You have unsaved changes. {autoSaveEnabled ? 'Changes will be auto-saved in a few seconds.' : 'Don\'t forget to save your changes.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Article Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Article Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Published:</span>
                <span>{formatDistanceToNow(publishedDate, { addSuffix: true })}</span>
              </div>
              
              {article.category && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {article.category}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quality Indicators */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Content Quality</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <QualityIndicator
                label="Content Length"
                value={contentLength}
                threshold={200}
                unit="characters"
                icon={<FileText className="h-4 w-4" />}
              />
              <QualityIndicator
                label="Summary Length"
                value={summaryLength}
                threshold={50}
                unit="characters"
                icon={<Brain className="h-4 w-4" />}
              />
              <QualityIndicator
                label="Has Image"
                value={hasImage ? 1 : 0}
                threshold={1}
                unit=""
                icon={<ImageIcon className="h-4 w-4" />}
                isBoolean
              />
            </CardContent>
          </Card>

          {/* Article Image */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Article Image</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="imageUrl">Image URL</Label>
                    {article.isAiEnhanced && (
                      <div className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
                        <Sparkles className="h-3 w-3" />
                        <span>Syncs across languages</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Input
                      id="imageUrl"
                      type="url"
                      value={editForm.imageUrl}
                      onChange={(e) => handleImageUrlChange(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className={unsavedChanges.imageUrl ? 'border-amber-300 bg-amber-50/30' : ''}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyField('Image URL', editForm.imageUrl)}
                      className="px-3"
                      title="Copy image URL"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  {unsavedChanges.imageUrl && (
                    <div className="flex items-center gap-1 text-xs text-amber-600">
                      <Clock className="h-3 w-3" />
                      <span>Unsaved changes</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Or</span>
                    <FileUploader
                      articleId={article.id}
                      onUpload={(url) => handleImageUrlChange(url)}
                      disabled={saveState.status === 'saving'}
                    />
                  </div>
                  {editForm.imageUrl && (
                    <div className="relative aspect-video overflow-hidden rounded-lg bg-muted max-w-2xl mt-3">
                      <img
                        src={editForm.imageUrl}
                        alt="Preview"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          e.currentTarget.nextElementSibling?.classList.remove('hidden')
                        }}
                      />
                      <div className="hidden flex h-full w-full items-center justify-center">
                        <span className="text-muted-foreground">Invalid image URL</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                article.imageUrl && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Image URL</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyField('Image URL', article.imageUrl)}
                        className="h-8 px-2"
                        title="Copy image URL"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <div className="relative aspect-video overflow-hidden rounded-lg bg-muted max-w-2xl">
                      {hasImage ? (
                        <img
                          src={article.imageUrl}
                          alt={article.title}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                      ) : null}
                      <div className={`flex h-full w-full items-center justify-center ${hasImage ? 'hidden' : ''}`}>
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">No image</span>
                      </div>
                    </div>
                  </div>
                )
              )}
            </CardContent>
          </Card>

          {/* Content Tabs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Article Content</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      value={editForm.category}
                      onChange={(e) => handleFieldChange('category', e.target.value)}
                      placeholder="General"
                      className={unsavedChanges.category ? 'border-amber-300 bg-amber-50/30' : ''}
                    />
                    {unsavedChanges.category && (
                      <div className="flex items-center gap-1 text-xs text-amber-600">
                        <Clock className="h-3 w-3" />
                        <span>Unsaved changes</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select
                      value={editForm.language || 'en'}
                      onValueChange={(value) => handleFieldChange('language', value)}
                    >
                      <SelectTrigger id="language">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="zh-TW">繁體中文</SelectItem>
                        <SelectItem value="zh-CN">简体中文</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="summary">Summary</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyField('Summary', editForm.summary)}
                        className="h-6 px-2 text-xs"
                        title="Copy summary"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <Textarea
                      id="summary"
                      value={editForm.summary}
                      onChange={(e) => handleFieldChange('summary', e.target.value)}
                      placeholder="Article summary..."
                      rows={3}
                      className={`resize-none ${unsavedChanges.summary ? 'border-amber-300 bg-amber-50/30' : ''}`}
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {unsavedChanges.summary && (
                          <>
                            <Clock className="h-3 w-3 text-amber-600" />
                            <span className="text-amber-600">Unsaved changes</span>
                          </>
                        )}
                      </div>
                      <span>{editForm.summary.length} characters</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="content">Full Content</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyField('Content', editForm.content)}
                        className="h-6 px-2 text-xs"
                        title="Copy content"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <Textarea
                      id="content"
                      value={editForm.content}
                      onChange={(e) => handleFieldChange('content', e.target.value)}
                      placeholder="Full article content..."
                      rows={10}
                      className={`resize-none ${unsavedChanges.content ? 'border-amber-300 bg-amber-50/30' : ''}`}
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {unsavedChanges.content && (
                          <>
                            <Clock className="h-3 w-3 text-amber-600" />
                            <span className="text-amber-600">Unsaved changes</span>
                          </>
                        )}
                      </div>
                      <span>{editForm.content.length} characters</span>
                    </div>
                  </div>
                </div>
              ) : previewMode ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Preview Mode</h4>
                    <Badge variant="outline">Live Preview</Badge>
                  </div>
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="content">Content</TabsTrigger>
                      <TabsTrigger value="metadata">Metadata</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="content" className="mt-4 space-y-4">
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">Title</Label>
                          <h2 className="text-xl font-semibold">{editForm.title || 'Untitled'}</h2>
                        </div>
                        
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">Summary</Label>
                          <div className="mt-1 rounded-md border p-3 min-h-[60px]">
                            <p className="leading-relaxed text-sm">
                              {editForm.summary || 'No summary available'}
                            </p>
                          </div>
                        </div>
                        
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">Content</Label>
                          <div className="mt-1 max-h-60 overflow-y-auto rounded-md border p-3">
                            <p className="leading-relaxed whitespace-pre-wrap text-sm">
                              {editForm.content || 'No content available'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="metadata" className="mt-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Category</span>
                          <Badge variant="outline">{editForm.category}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Language</span>
                          <Badge variant="outline">
                            {editForm.language === 'en' ? 'English' : 
                             editForm.language === 'zh-TW' ? '繁體中文' : 
                             editForm.language === 'zh-CN' ? '简体中文' : editForm.language}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Content Length</span>
                          <span className="text-sm text-muted-foreground">{editForm.content.length} chars</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Summary Length</span>
                          <span className="text-sm text-muted-foreground">{editForm.summary.length} chars</span>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              ) : (
                <Tabs defaultValue="summary" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="content">Full Content</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="summary" className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Summary</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyField('Summary', article.summary || '')}
                        className="h-6 px-2 text-xs"
                        title="Copy summary"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <div className="max-h-60 overflow-y-auto rounded-md border p-4">
                      <p className="leading-relaxed">
                        {article.summary || "No summary available"}
                      </p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="content" className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Full Content</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyField('Content', article.content || '')}
                        className="h-6 px-2 text-xs"
                        title="Copy content"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <div className="max-h-60 overflow-y-auto rounded-md border p-4">
                      <p className="leading-relaxed whitespace-pre-wrap">
                        {article.content || "No content available"}
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          {!isEditing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={handleOpenOriginal}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Original
                </Button>
                <Button variant="outline" onClick={handleCopyUrl}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy URL
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-scrape
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleGenerateAIImage}
                  disabled={isGeneratingImage || !article.imageUrl}
                  className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-blue-100"
                >
                  {isGeneratingImage ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-2" />
                  )}
                  {isGeneratingImage ? 'Generating...' : 'Generate Generic Scene'}
                </Button>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                <Button 
                  variant="outline"
                  onClick={handleGenerateOpenAIImage}
                  disabled={isGeneratingOpenAIImage || !article.imageUrl}
                  className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-700 hover:from-green-100 hover:to-emerald-100"
                >
                  {isGeneratingOpenAIImage ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-2" />
                  )}
                  {isGeneratingOpenAIImage ? 'Generating...' : 'Generate Editorial Image'}
                </Button>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                <Button 
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={saveState.status === 'saving'}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Article
                </Button>
              </div>
              
              
              {/* Enhanced Article Indicator */}
              {article.isAiEnhanced && (
                <>
                  <Separator className="my-4" />
                  <div className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    <span className="text-purple-700 dark:text-purple-300 font-medium">
                      AI Enhanced Article
                    </span>
                  </div>
                  
                  {article.enhancementMetadata && (
                    <div className="text-sm text-muted-foreground space-y-1 p-3 bg-muted/50 rounded-lg">
                      <div>Sources: {article.enhancementMetadata.sources.length}</div>
                      <div>Research queries: {article.enhancementMetadata.searchQueries.length}</div>
                      {article.enhancementMetadata.extractedImages && (
                        <div>Images: {article.enhancementMetadata.extractedImages.length}</div>
                      )}
                      <div>Enhanced: {new Date(article.enhancementMetadata.enhancedAt).toLocaleDateString()}</div>
                      {article.enhancementMetadata.enhancementCost && (
                        <div>Est. cost: {article.enhancementMetadata.enhancementCost}</div>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          )}
          
          {/* Enhanced Article Sources and Images */}
          {article.isAiEnhanced && article.enhancementMetadata && (
            <>
              {/* Source Citations */}
              {article.enhancementMetadata.sources && article.enhancementMetadata.sources.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Research Sources</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SourceCitations sources={article.enhancementMetadata.sources} />
                  </CardContent>
                </Card>
              )}
              
              {/* Image Gallery */}
              {article.enhancementMetadata.extractedImages && article.enhancementMetadata.extractedImages.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Additional Images</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ImageGallery images={article.enhancementMetadata.extractedImages} />
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </SheetContent>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Article</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this article? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saveState.status === 'saving'}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saveState.status === 'saving'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saveState.status === 'saving' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}

interface QualityIndicatorProps {
  label: string
  value: number
  threshold: number
  unit: string
  icon: React.ReactNode
  isBoolean?: boolean
}

function QualityIndicator({ 
  label, 
  value, 
  threshold, 
  unit, 
  icon, 
  isBoolean = false 
}: QualityIndicatorProps) {
  const isGood = isBoolean ? value >= threshold : value >= threshold
  const percentage = isBoolean ? (value >= threshold ? 100 : 0) : Math.min((value / threshold) * 100, 100)
  
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 flex-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${
              isGood ? 'bg-green-500' : 'bg-yellow-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm text-muted-foreground min-w-[4rem] text-right">
          {isBoolean ? (value >= threshold ? 'Yes' : 'No') : `${value}${unit}`}
        </span>
      </div>
    </div>
  )
}