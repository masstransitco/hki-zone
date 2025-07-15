"use client"

import { useState, useEffect } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  Maximize2,
  Edit,
  Save,
  X
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { Article } from "@/lib/types"

interface ArticleDetailSheetProps {
  article: Article | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ArticleDetailSheet({ article, open, onOpenChange }: ArticleDetailSheetProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  
  // Form state for editing
  const [editForm, setEditForm] = useState({
    title: '',
    summary: '',
    content: '',
    imageUrl: '',
    category: '',
    language: '',
  })
  
  // Initialize form when article changes or edit mode is entered
  useEffect(() => {
    if (article && isEditing) {
      setEditForm({
        title: article.title || '',
        summary: article.summary || '',
        content: article.content || '',
        imageUrl: article.imageUrl || '',
        category: article.category || 'General',
        language: article.language || 'en',
      })
    }
  }, [article, isEditing])

  if (!article) {
    return null
  }

  const publishedDate = article.publishedAt ? new Date(article.publishedAt) : new Date()
  const hasImage = article.imageUrl && !article.imageUrl.includes("placeholder")
  const contentLength = article.content?.length || 0
  const summaryLength = article.summary?.length || 0

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(article.url)
    toast.success("URL copied to clipboard")
  }

  const handleOpenOriginal = () => {
    window.open(article.url, '_blank')
  }
  
  const handleSave = async () => {
    if (!article) return
    
    setIsSaving(true)
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
      
      toast.success('Article updated successfully')
      setIsEditing(false)
      // Refresh the page to show updated data
      window.location.reload()
    } catch (error) {
      console.error('Error saving article:', error)
      toast.error('Failed to save article', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    } finally {
      setIsSaving(false)
    }
  }
  
  const handleDelete = async () => {
    if (!article) return
    
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/admin/articles/${article.id}`, {
        method: 'DELETE',
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete article')
      }
      
      toast.success('Article deleted successfully')
      onOpenChange(false)
      // Refresh the page to update the list
      window.location.reload()
    } catch (error) {
      console.error('Error deleting article:', error)
      toast.error('Failed to delete article', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }
  
  const handleCancel = () => {
    setIsEditing(false)
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
  }


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[90vw] lg:max-w-[60vw] overflow-y-auto">
        <SheetHeader className="space-y-3 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                {isEditing ? (
                  <Input
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="text-xl font-semibold"
                    placeholder="Article title"
                  />
                ) : (
                  <>
                    <SheetTitle className="text-xl font-semibold leading-tight line-clamp-3 flex-1">
                      {article.title}
                    </SheetTitle>
                    {article.isAiEnhanced && (
                      <Sparkles className="h-5 w-5 text-purple-600 flex-shrink-0 mt-1" />
                    )}
                  </>
                )}
              </div>
              <SheetDescription className="mt-2 text-base">
                {isEditing ? 'Edit article details' : 'Full-screen article editor and management'}
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
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </SheetHeader>

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
                  <Label htmlFor="imageUrl">Image URL</Label>
                  <Input
                    id="imageUrl"
                    type="url"
                    value={editForm.imageUrl}
                    onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Or</span>
                    <FileUploader
                      articleId={article.id}
                      onUpload={(url) => setEditForm({ ...editForm, imageUrl: url })}
                      disabled={isSaving}
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
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      placeholder="General"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select
                      value={editForm.language || 'en'}
                      onValueChange={(value) => setEditForm({ ...editForm, language: value })}
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
                    <Label htmlFor="summary">Summary</Label>
                    <Textarea
                      id="summary"
                      value={editForm.summary}
                      onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                      placeholder="Article summary..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="content">Full Content</Label>
                    <Textarea
                      id="content"
                      value={editForm.content}
                      onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                      placeholder="Full article content..."
                      rows={10}
                      className="resize-none"
                    />
                  </div>
                </div>
              ) : (
                <Tabs defaultValue="summary" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="content">Full Content</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="summary" className="mt-4">
                    <div className="max-h-60 overflow-y-auto rounded-md border p-4">
                      <p className="leading-relaxed">
                        {article.summary || "No summary available"}
                      </p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="content" className="mt-4">
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
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete
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
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
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