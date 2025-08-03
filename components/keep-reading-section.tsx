"use client"

import { useState, useEffect } from "react"
import { useLanguage } from "./language-provider"
import type { Article } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import OutletFavicon from "./outlet-favicon"
import { InlineSourcesBadge } from "./public-sources"

interface KeepReadingSectionProps {
  currentArticle: Article
  onArticleSelect: (articleId: string) => void
}

interface KeepReadingCardProps {
  article: Article
  onClick: () => void
}

function KeepReadingCard({ article, onClick }: KeepReadingCardProps) {
  return (
    <Card 
      className="group article-card cursor-pointer h-full"
      onClick={onClick}
    >
      <CardContent className="card-content h-full flex flex-col p-3">
        {/* Fixed aspect ratio image container - portrait oriented */}
        <div className="relative w-full aspect-[3/4] overflow-hidden rounded-lg bg-[rgb(var(--color-surface-200))] mb-3 flex-shrink-0">
          {article.imageUrl ? (
            <img
              src={article.imageUrl}
              alt={article.title}
              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[rgb(var(--color-surface-200))] to-[rgb(var(--color-surface-300))]">
              <OutletFavicon 
                source={article.source} 
                size="lg" 
                showFallback={true}
              />
            </div>
          )}
        </div>

        {/* Title - flex-grow to fill available space */}
        <h3 className="article-card-title line-clamp-3 text-sm leading-tight transition-colors mb-3 flex-grow">
          {article.title}
        </h3>

        {/* Sources - fixed at bottom */}
        <div className="flex items-center justify-between text-xs article-card-meta">
          <div className="flex items-center gap-2">
            {article.isAiEnhanced && article.enhancementMetadata?.sources?.length ? (
              <InlineSourcesBadge sources={article.enhancementMetadata.sources} />
            ) : (
              <div className="flex items-center gap-2">
                <OutletFavicon 
                  source={article.source} 
                  size="sm" 
                  showFallback={true}
                />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function KeepReadingSection({ 
  currentArticle, 
  onArticleSelect 
}: KeepReadingSectionProps) {
  const { t, language } = useLanguage()
  const [relatedArticles, setRelatedArticles] = useState<Article[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchRelatedArticles = async () => {
      try {
        setIsLoading(true)
        
        // Determine which type of articles to fetch based on current article
        const isCurrentAiEnhanced = currentArticle.isAiEnhanced
        const currentSource = currentArticle.source
        
        let url = "/api/articles?"
        const params = new URLSearchParams()
        
        if (isCurrentAiEnhanced) {
          // For AI enhanced articles, use topics API which supports language filtering
          url = `/api/topics?limit=10&language=${language}`
        } else {
          // For normal articles, fetch more from the same source
          params.append("enriched", "false") 
          params.append("limit", "10")
          url += params.toString()
        }
        
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          // Filter out the current article and take first 5 for horizontal scrolling
          const filtered = data.articles
            .filter((article: Article) => article.id !== currentArticle.id)
            .slice(0, 5)
          
          // If we have less than 3 articles and current is not AI enhanced,
          // fetch some AI enhanced articles to fill the gap using topics API
          if (filtered.length < 3 && !isCurrentAiEnhanced) {
            const aiResponse = await fetch(`/api/topics?limit=5&language=${language}`)
            if (aiResponse.ok) {
              const aiData = await aiResponse.json()
              const aiFiltered = aiData.articles
                .filter((article: Article) => article.id !== currentArticle.id)
                .slice(0, 5 - filtered.length)
              filtered.push(...aiFiltered)
            }
          }
          
          setRelatedArticles(filtered)
        }
      } catch (error) {
        console.error("Failed to fetch related articles:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRelatedArticles()
  }, [currentArticle.id, currentArticle.isAiEnhanced, currentArticle.source, language])

  if (isLoading) {
    return (
      <div className="mt-8 pt-6 border-t border-[rgb(var(--color-card-border))]">
        <h2 className="text-headline mb-6 text-[rgb(var(--color-text-100))]">
          {t("keepReading.title")}
        </h2>
        <div className="flex gap-4 md:gap-5 overflow-x-auto pb-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-[180px] sm:w-[200px] md:w-[220px] lg:w-[240px] h-[340px] sm:h-[380px] md:h-[420px] lg:h-[460px] bg-[rgb(var(--color-surface-200))] rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  if (relatedArticles.length === 0) {
    return null
  }

  return (
    <div className="mt-8 pt-6 border-t border-[rgb(var(--color-card-border))]">
      <h2 className="text-headline mb-6 text-[rgb(var(--color-text-100))]">
        {t("keepReading.title")}
      </h2>
      
      <div className="flex gap-4 md:gap-5 overflow-x-auto pb-4 scrollbar-hide">
        {relatedArticles.map((article) => (
          <div
            key={article.id}
            className="flex-shrink-0 w-[180px] sm:w-[200px] md:w-[220px] lg:w-[240px] h-[340px] sm:h-[380px] md:h-[420px] lg:h-[460px]"
          >
            <KeepReadingCard
              article={article}
              onClick={() => onArticleSelect(article.id)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}