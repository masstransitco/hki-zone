"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Clock, 
  Edit, 
  Save,
  X,
  RefreshCw,
  DollarSign,
  Brain,
  ExternalLink,
  Calendar,
  User,
  Tag,
  Image as ImageIcon,
  Trash2,
  Copy
} from "lucide-react"

interface PerplexityArticle {
  id: string
  title: string
  category: string
  url: string
  article_status: "pending" | "enriched" | "ready"
  image_status: "pending" | "ready" | "failed"
  article_html?: string
  lede?: string
  image_url?: string
  source: string
  author: string
  published_at: string
  created_at: string
  generation_cost?: number
  citations?: string[]
  perplexity_model?: string
}

interface PerplexityArticleDetailProps {
  article: PerplexityArticle | null
  onEdit?: (article: PerplexityArticle) => void
  onDelete?: (article: PerplexityArticle) => void
  onRegenerate?: (article: PerplexityArticle) => void
  onSave?: (article: PerplexityArticle) => void
  onClose?: () => void
}

const CATEGORIES = [
  "politics",
  "business", 
  "tech",
  "health",
  "lifestyle",
  "entertainment"
]

export default function PerplexityArticleDetail({
  article,
  onEdit,
  onDelete,
  onRegenerate,
  onSave,
  onClose
}: PerplexityArticleDetailProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedArticle, setEditedArticle] = useState<PerplexityArticle | null>(null)

  if (!article) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Select an article to view details
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ready": return <CheckCircle className="h-4 w-4 text-green-500" />
      case "enriched": return <Clock className="h-4 w-4 text-blue-500" />
      case "pending": return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case "failed": return <XCircle className="h-4 w-4 text-red-500" />
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ready": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "enriched": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "failed": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  const getCategoryColor = (category: string) => {
    const colors = {
      politics: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      business: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      tech: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      health: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      lifestyle: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      entertainment: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
    }
    return colors[category as keyof typeof colors] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
  }

  const handleEdit = () => {
    setEditedArticle({ ...article })
    setIsEditing(true)
  }

  const handleSave = () => {
    if (editedArticle && onSave) {
      onSave(editedArticle)
    }
    setIsEditing(false)
    setEditedArticle(null)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditedArticle(null)
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(article.url)
  }

  const currentArticle = editedArticle || article

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-xl line-clamp-2 mb-2">
              {isEditing ? (
                <Input
                  value={editedArticle?.title || ""}
                  onChange={(e) => setEditedArticle(prev => prev ? { ...prev, title: e.target.value } : null)}
                  className="text-xl font-bold"
                />
              ) : (
                article.title
              )}
            </CardTitle>
            
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Badge className={`text-xs ${getCategoryColor(currentArticle.category)}`}>
                {isEditing ? (
                  <Select 
                    value={editedArticle?.category || ""}
                    onValueChange={(value) => setEditedArticle(prev => prev ? { ...prev, category: value } : null)}
                  >
                    <SelectTrigger className="w-auto h-auto p-0 border-0 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  currentArticle.category
                )}
              </Badge>
              
              <Badge className={`text-xs ${getStatusColor(currentArticle.article_status)}`}>
                <div className="flex items-center gap-1">
                  {getStatusIcon(currentArticle.article_status)}
                  {currentArticle.article_status}
                </div>
              </Badge>
              
              {currentArticle.image_status === "failed" && (
                <Badge className="text-xs bg-red-100 text-red-800">
                  No Image
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button size="sm" onClick={handleSave}>
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={handleEdit}>
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                {onRegenerate && (
                  <Button size="sm" variant="outline" onClick={() => onRegenerate(article)}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button size="sm" variant="outline" onClick={() => onDelete(article)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
            {onClose && (
              <Button size="sm" variant="ghost" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        <CardDescription>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {currentArticle.source}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(currentArticle.created_at).toLocaleDateString()}
            </span>
            {currentArticle.generation_cost && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                ${currentArticle.generation_cost.toFixed(4)}
              </span>
            )}
          </div>
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Summary */}
        {currentArticle.lede && (
          <div>
            <Label className="text-sm font-semibold mb-2 block">Summary</Label>
            {isEditing ? (
              <Textarea
                value={editedArticle?.lede || ""}
                onChange={(e) => setEditedArticle(prev => prev ? { ...prev, lede: e.target.value } : null)}
                rows={3}
                className="resize-none"
              />
            ) : (
              <p className="text-sm text-muted-foreground bg-gray-50 dark:bg-gray-800 p-3 rounded">
                {currentArticle.lede}
              </p>
            )}
          </div>
        )}
        
        {/* Image */}
        {currentArticle.image_url && (
          <div>
            <Label className="text-sm font-semibold mb-2 block">Image</Label>
            <div className="relative">
              <img 
                src={currentArticle.image_url} 
                alt={currentArticle.title}
                className="w-full max-w-md rounded-lg"
              />
              <Badge className="absolute top-2 right-2 bg-black bg-opacity-50 text-white">
                {currentArticle.image_status}
              </Badge>
            </div>
          </div>
        )}
        
        {/* Content */}
        {currentArticle.article_html && (
          <div>
            <Label className="text-sm font-semibold mb-2 block">Article Content</Label>
            <div className="prose prose-sm max-w-none text-sm border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
              {isEditing ? (
                <Textarea
                  value={editedArticle?.article_html || ""}
                  onChange={(e) => setEditedArticle(prev => prev ? { ...prev, article_html: e.target.value } : null)}
                  rows={10}
                  className="resize-none font-mono text-xs"
                />
              ) : (
                <div dangerouslySetInnerHTML={{ __html: currentArticle.article_html }} />
              )}
            </div>
          </div>
        )}
        
        {/* URL */}
        <div>
          <Label className="text-sm font-semibold mb-2 block">URL</Label>
          <div className="flex items-center gap-2">
            <Input
              value={currentArticle.url}
              readOnly
              className="flex-1 bg-gray-50 dark:bg-gray-800"
            />
            <Button size="sm" variant="outline" onClick={handleCopyUrl}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={currentArticle.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
        
        {/* Citations */}
        {currentArticle.citations && currentArticle.citations.length > 0 && (
          <div>
            <Label className="text-sm font-semibold mb-2 block">Citations</Label>
            <div className="space-y-2">
              {currentArticle.citations.map((citation, index) => (
                <div key={index} className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  {citation}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Metadata */}
        <div>
          <Label className="text-sm font-semibold mb-2 block">Metadata</Label>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Model:</span>
              <span className="ml-2 text-muted-foreground">
                {currentArticle.perplexity_model || 'N/A'}
              </span>
            </div>
            <div>
              <span className="font-medium">Author:</span>
              <span className="ml-2 text-muted-foreground">
                {currentArticle.author}
              </span>
            </div>
            <div>
              <span className="font-medium">Published:</span>
              <span className="ml-2 text-muted-foreground">
                {new Date(currentArticle.published_at).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="font-medium">Created:</span>
              <span className="ml-2 text-muted-foreground">
                {new Date(currentArticle.created_at).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}