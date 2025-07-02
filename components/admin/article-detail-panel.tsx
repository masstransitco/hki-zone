"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ExternalLink, 
  Calendar, 
  User, 
  Globe, 
  Image as ImageIcon,
  FileText,
  Brain,
  Copy,
  Trash2,
  RefreshCw
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { Article } from "@/lib/types"

interface ArticleDetailPanelProps {
  article: Article | null
}

export default function ArticleDetailPanel({ article }: ArticleDetailPanelProps) {
  if (!article) {
    return (
      <Card className="h-fit">
        <CardContent className="flex h-96 items-center justify-center text-muted-foreground">
          <div className="text-center">
            <FileText className="mx-auto h-12 w-12 opacity-50" />
            <p className="mt-4">Select an article to view details</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const publishedDate = article.publishedAt ? new Date(article.publishedAt) : new Date()
  const hasImage = article.imageUrl && !article.imageUrl.includes("placeholder")
  const contentLength = article.content?.length || 0
  const summaryLength = article.summary?.length || 0

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(article.url)
  }

  const handleOpenOriginal = () => {
    window.open(article.url, '_blank')
  }

  return (
    <Card className="lg:sticky lg:top-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg leading-tight line-clamp-3">
              {article.title}
            </CardTitle>
            <CardDescription className="mt-2">
              Article details and content review
            </CardDescription>
          </div>
          <Badge variant="secondary">{article.source}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Article Metadata */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Published:</span>
            <span>{formatDistanceToNow(publishedDate, { addSuffix: true })}</span>
          </div>
          
          {article.author && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Author:</span>
              <span>{article.author}</span>
            </div>
          )}
          
          {article.category && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="text-xs">
                {article.category}
              </Badge>
            </div>
          )}
        </div>

        <Separator />

        {/* Quality Indicators */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Content Quality</h4>
          <div className="space-y-2">
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
          </div>
        </div>

        <Separator />

        {/* Article Image */}
        {article.imageUrl && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Article Image</h4>
            <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
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
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">No image</span>
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Content Tabs */}
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="content">Full Content</TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary" className="mt-4">
            <ScrollArea className="h-32">
              <p className="text-sm leading-relaxed">
                {article.summary || "No summary available"}
              </p>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="content" className="mt-4">
            <ScrollArea className="h-32">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {article.content || "No content available"}
              </p>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Action Buttons */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={handleOpenOriginal} className="text-xs">
              <ExternalLink className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Original</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyUrl} className="text-xs">
              <Copy className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Copy URL</span>
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="text-xs">
              <RefreshCw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Re-scrape</span>
            </Button>
            <Button variant="destructive" size="sm" className="text-xs">
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
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
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${
              isGood ? 'bg-green-500' : 'bg-yellow-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground min-w-[3rem] text-right">
          {isBoolean ? (value >= threshold ? 'Yes' : 'No') : `${value}${unit}`}
        </span>
      </div>
    </div>
  )
}