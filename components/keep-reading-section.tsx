"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useLanguage } from "./language-provider"
import type { Article } from "@/lib/types"
import OutletFavicon from "./outlet-favicon"

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
    <div
      onClick={onClick}
      className="flex-shrink-0 w-36 cursor-pointer group transition-transform duration-200 hover:scale-[1.02]"
      style={{
        aspectRatio: "2/3", // Portrait orientation as specified
      }}
    >
      <div className="h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Image section - takes ~60-70% of card height */}
        <div className="relative h-[65%] bg-gray-100 dark:bg-gray-700">
          {article.imageUrl ? (
            <Image
              src={article.imageUrl}
              alt={article.title}
              fill
              className="object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none"
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
              <OutletFavicon 
                source={article.source} 
                size="lg" 
                showFallback={true}
              />
            </div>
          )}
        </div>

        {/* Content section - takes remaining height */}
        <div className="h-[35%] p-3 flex flex-col justify-center">
          {/* Headline */}
          <h3 className="text-xs font-medium text-gray-900 dark:text-white leading-tight" 
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
            {article.title}
          </h3>
        </div>
      </div>
    </div>
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
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Keep Reading
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-36 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"
              style={{ aspectRatio: "2/3" }}
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
    <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Keep Reading
      </h2>
      
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {relatedArticles.map((article) => (
          <KeepReadingCard
            key={article.id}
            article={article}
            onClick={() => onArticleSelect(article.id)}
          />
        ))}
      </div>
    </div>
  )
}