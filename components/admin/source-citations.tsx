"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ExternalLink, Globe, Clock, Quote } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface SourceCitation {
  url: string
  title: string
  domain: string
  snippet?: string
  accessedAt: string
}

interface SourceCitationsProps {
  sources: SourceCitation[]
  className?: string
}

export default function SourceCitations({ sources, className = "" }: SourceCitationsProps) {
  if (!sources || sources.length === 0) {
    return null
  }

  const handleSourceClick = (url: string) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Quote className="h-5 w-5 text-blue-600" />
          Sources & Citations
          <Badge variant="secondary" className="ml-auto">
            {sources.length} sources
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-3">
            {sources.map((source, index) => (
              <SourceCitationCard
                key={`${source.url}-${index}`}
                source={source}
                index={index + 1}
                onClick={() => handleSourceClick(source.url)}
              />
            ))}
          </div>
        </ScrollArea>
        
        <div className="mt-4 pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            Sources automatically collected during AI enhancement. 
            Click on any source to visit the original article.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

interface SourceCitationCardProps {
  source: SourceCitation
  index: number
  onClick: () => void
}

function SourceCitationCard({ source, index, onClick }: SourceCitationCardProps) {
  const accessedDate = new Date(source.accessedAt)

  return (
    <div className="group border rounded-lg p-3 hover:bg-muted/50 transition-colors">
      <div className="flex items-start gap-3">
        {/* Citation Number */}
        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
          <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
            {index}
          </span>
        </div>
        
        {/* Source Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-blue-600 transition-colors">
              {source.title}
            </h4>
            {source.url && (
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={onClick}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1">
              <Globe className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {source.domain}
              </span>
            </div>
            
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(accessedDate, { addSuffix: true })}
              </span>
            </div>
          </div>
          
          {source.snippet && (
            <blockquote className="mt-2 pl-3 border-l-2 border-muted-foreground/20">
              <p className="text-xs text-muted-foreground italic line-clamp-2">
                "{source.snippet}"
              </p>
            </blockquote>
          )}
        </div>
      </div>
    </div>
  )
}