"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ExternalLink, Globe, ChevronRight } from "lucide-react"

interface SourceCitation {
  url: string
  title: string
  domain: string
  snippet?: string
  accessedAt: string
}

interface PublicSourcesProps {
  sources: SourceCitation[]
  trigger?: React.ReactNode
  className?: string
}

export default function PublicSources({ sources, trigger, className = "" }: PublicSourcesProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!sources || sources.length === 0) {
    return null
  }

  const defaultTrigger = (
    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground">
      {sources.length} sources
      <ChevronRight className="h-3 w-3 ml-1" />
    </Button>
  )

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600" />
            Sources ({sources.length})
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 pr-4">
            {sources.map((source, index) => (
              <SourceCard
                key={`${source.url}-${index}`}
                source={source}
                index={index + 1}
              />
            ))}
          </div>
        </ScrollArea>
        
        <div className="pt-3 border-t text-xs text-muted-foreground">
          Sources collected during AI enhancement research
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface SourceCardProps {
  source: SourceCitation
  index: number
}

function SourceCard({ source, index }: SourceCardProps) {
  const handleClick = () => {
    if (source.url) {
      window.open(source.url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <Card 
      className={`group transition-all hover:shadow-sm ${source.url ? 'cursor-pointer hover:border-blue-300' : ''}`}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Source Number */}
          <div className="flex-shrink-0 w-6 h-6 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
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
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-blue-600 transition-colors flex-shrink-0" />
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {source.domain}
              </Badge>
            </div>
            
            {source.snippet && (
              <blockquote className="mt-2 text-xs text-muted-foreground line-clamp-3 italic">
                "{source.snippet}"
              </blockquote>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Simplified inline sources for article cards
export function InlineSourcesBadge({ sources }: { sources: SourceCitation[] }) {
  if (!sources || sources.length === 0) return null

  return (
    <PublicSources
      sources={sources}
      trigger={
        <Badge
          variant="secondary"
          className="bg-surface text-text-secondary border-border text-xs px-2 py-0.5 hover:bg-muted transition-colors cursor-pointer"
        >
          {sources.length} sources
        </Badge>
      }
    />
  )
}