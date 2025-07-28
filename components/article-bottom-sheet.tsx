"use client"

import * as React from "react"
import { X } from "lucide-react"
import HeadphonesIcon from '@mui/icons-material/Headphones'
import PauseIcon from '@mui/icons-material/Pause'
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription, 
  DrawerClose 
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import ArticleDetailSheet from "./article-detail-sheet"
import ShareButton from "./share-button"
import BookmarkButton from "./bookmark-button"
import { useSelector, useDispatch } from 'react-redux'
import { 
  selectTTSCurrentArticle,
  selectTTSPlaybackState,
  selectTTSIsInitialized,
  selectTTSCanPlay,
  selectTTS,
  playArticle,
  pausePlayback,
  resumePlayback,
  stopPlayback 
} from '@/store/ttsSlice'
import type { AppDispatch } from '@/store'
import { useLanguage } from "./language-provider"

interface ArticleBottomSheetProps {
  articleId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isPerplexityArticle?: boolean
}

export default function ArticleBottomSheet({ 
  articleId, 
  open, 
  onOpenChange,
  isPerplexityArticle = false
}: ArticleBottomSheetProps) {
  
  // Debug when open state changes
  React.useEffect(() => {
    console.log('📱 Bottom Sheet - Open state changed:', { 
      open, 
      articleId,
      timestamp: Date.now() 
    })
  }, [open, articleId])
  const { language } = useLanguage()
  const [article, setArticle] = React.useState<any>(null)
  
  const dispatch = useDispatch<AppDispatch>()
  
  // Redux selectors
  const currentTTSArticle = useSelector(selectTTSCurrentArticle)
  const { isPlaying, isPaused, isLoading } = useSelector(selectTTSPlaybackState)
  const ttsIsInitialized = useSelector(selectTTSIsInitialized)
  const ttsCanPlay = useSelector(selectTTSCanPlay)
  const fullTTSState = useSelector(selectTTS)

  // Debug logging for TTS states
  React.useEffect(() => {
    console.log('📱 Bottom Sheet - TTS States:', { 
      isPlaying, 
      isPaused, 
      isLoading, 
      open,
      articleId: article?.id,
      articleTitle: article?.title,
      currentArticleId: currentTTSArticle?.id,
      ttsIsInitialized,
      ttsCanPlay,
      buttonDisabled: isLoading || !ttsIsInitialized || !ttsCanPlay,
      services: {
        hasTTSService: !!fullTTSState.services?.ttsService,
        hasSpeechService: !!fullTTSState.services?.speechService,
        hasAudioService: !!fullTTSState.services?.audioService
      },
      error: fullTTSState.error
    })
  }, [isPlaying, isPaused, isLoading, open, article, currentTTSArticle, ttsIsInitialized, ttsCanPlay, fullTTSState])

  // Fetch article data when articleId changes
  React.useEffect(() => {
    if (!articleId) {
      setArticle(null)
      return
    }

    const fetchArticle = async () => {
      try {
        const response = await fetch(`/api/articles/${articleId}`)
        if (response.ok) {
          const articleData = await response.json()
          setArticle(articleData)
        }
      } catch (error) {
        console.error('Failed to fetch article for TTS:', error)
      }
    }

    fetchArticle()
  }, [articleId])

  const handleTextToSpeech = async () => {
    console.log('📱 Bottom Sheet - handleTextToSpeech called', { 
      hasArticle: !!article, 
      articleId: article?.id,
      articleTitle: article?.title,
      isPlaying,
      isPaused,
      currentArticleId: currentTTSArticle?.id,
      sameArticle: currentTTSArticle?.id === article?.id
    })
    
    if (!article) {
      console.warn('📱 Bottom Sheet - No article available for TTS')
      return
    }

    if (!article.id || !article.title) {
      console.warn('📱 Bottom Sheet - Article missing required fields:', { 
        hasId: !!article.id, 
        hasTitle: !!article.title,
        article: article
      })
      return
    }

    if (!ttsIsInitialized) {
      console.warn('📱 Bottom Sheet - TTS system not initialized yet')
      return
    }

    if (!ttsCanPlay) {
      console.warn('📱 Bottom Sheet - TTS system cannot play yet')
      return
    }

    console.log('📱 Bottom Sheet - Dispatching TTS action with article:', {
      id: article.id,
      title: article.title,
      hasContent: !!article.content,
      hasSummary: !!article.summary,
      contentLength: article.content?.length || 0,
      summaryLength: article.summary?.length || 0,
      currentLanguage: language,
      ttsIsInitialized,
      ttsCanPlay
    })

    try {
      // Handle same article - toggle pause/resume/play
      if (currentTTSArticle?.id === article.id) {
        if (isPlaying) {
          console.log('📱 Bottom Sheet - Pausing currently playing article (same article)')
          dispatch(pausePlayback())
        } else if (isPaused) {
          console.log('📱 Bottom Sheet - Resuming paused article (same article)')
          dispatch(resumePlayback())
        } else {
          console.log('📱 Bottom Sheet - Restarting same article playback')
          dispatch(playArticle({
            id: article.id,
            title: article.title,
            content: article.content || '',
            summary: article.summary || '',
            url: article.url || '',
            source: article.source || '',
            publishedAt: article.publishedAt || new Date().toISOString(),
            category: article.category || 'news'
          }))
        }
      } else {
        // Different article - playArticle will handle stopping previous article
        console.log('📱 Bottom Sheet - Starting new article playback (different article)')
        dispatch(playArticle({
          id: article.id,
          title: article.title,
          content: article.content || '',
          summary: article.summary || '',
          url: article.url || '',
          source: article.source || '',
          publishedAt: article.publishedAt || new Date().toISOString(),
          category: article.category || 'news'
        }))
      }
    } catch (error) {
      console.error('📱 Bottom Sheet - Text-to-speech error:', error)
    }
  }

  // Smart auto-stop: Only stop if opening a different article, not on manual close
  React.useEffect(() => {
    if (!open && (isPlaying || isPaused)) {
      // Don't auto-stop TTS when bottom sheet closes - let it continue with HUD
      console.log('📱 Bottom Sheet - Sheet closed, TTS continues with HUD', {
        open,
        isPlaying,
        isPaused,
        articleId,
        currentArticleId: currentTTSArticle?.id
      })
      // TTS continues playing - user can control via HUD
    }
  }, [open, isPlaying, isPaused, articleId, currentTTSArticle])
  // Freeze body scrolling while drawer is open to prevent bounce
  React.useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  return (
    <>
    <Drawer 
      open={open} 
      onOpenChange={onOpenChange}
      shouldScaleBackground={true}
      modal={false}
    >
      <DrawerContent 
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-[12px] border bg-background overflow-y-auto",
          "focus:outline-none [&>div:first-child]:mt-2"
        )}
        style={{
          /* Always fit inside the current visual viewport */
          maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - 8px)",
          /* Keep clear of the home-indicator */
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          /* Optional: small grab-handle gap */
          marginTop: "8px"
        }}
      >
        {/* Header with close button and share button below drag handle */}
        <div className="relative px-6 pt-4 pb-8 shrink-0">
          {/* Close button positioned with proper spacing from drag handle */}
          <DrawerClose asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-6 top-4 h-10 w-10 p-0 hover:bg-muted"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DrawerClose>
          
          {/* Text-to-speech and Share buttons positioned on the right with proper spacing */}
          {articleId && (
            <div 
              className="absolute right-6 top-4 flex items-center gap-2" 
              style={{ 
                pointerEvents: 'auto', 
                zIndex: 9000,
                isolation: 'isolate' // Create stacking context for better event isolation
              }}
              onClick={(e) => {
                // Prevent clicks on this container from propagating
                e.stopPropagation()
              }}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  e.nativeEvent.stopImmediatePropagation() // Better event isolation
                  console.log('📱 Bottom Sheet - Headphones button clicked!', {
                    buttonDisabled: isLoading || !ttsIsInitialized || !ttsCanPlay,
                    isLoading,
                    ttsIsInitialized,
                    ttsCanPlay,
                    hasArticle: !!article,
                    clickEvent: 'registered'
                  })
                  handleTextToSpeech()
                }}
                disabled={isLoading || !ttsIsInitialized || !ttsCanPlay}
                className="h-10 w-10 p-0 rounded-full transition-all duration-200"
                style={{ 
                  position: 'relative',
                  pointerEvents: 'auto',
                  backgroundColor: 'rgb(var(--tts-control-bg))',
                  color: 'rgb(var(--tts-control-fg))',
                  border: '1px solid rgb(var(--tts-border) / 0.3)',
                  boxShadow: `
                    0 2px 8px rgb(var(--tts-shadow) / 0.1),
                    inset 0 1px 0 rgb(255 255 255 / 0.05)
                  `
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgb(var(--tts-control-bg-hover))'
                  e.currentTarget.style.transform = 'scale(1.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgb(var(--tts-control-bg))'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgb(var(--tts-control-bg-active))'
                  e.currentTarget.style.transform = 'scale(0.95)'
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgb(var(--tts-control-bg-hover))'
                  e.currentTarget.style.transform = 'scale(1.05)'
                }}
              >
                {(isPlaying && currentTTSArticle?.id === article?.id) ? (
                  <PauseIcon 
                    className={cn(
                      "h-5 w-5",
                      isLoading && "animate-pulse"
                    )} 
                    style={{ 
                      pointerEvents: 'none',
                      color: 'rgb(var(--tts-accent))'
                    }}
                  />
                ) : (
                  <HeadphonesIcon 
                    className={cn(
                      "h-5 w-5",
                      isLoading && "animate-pulse"
                    )} 
                    style={{ 
                      pointerEvents: 'none',
                      color: (isPaused && currentTTSArticle?.id === article?.id) 
                        ? 'rgb(var(--tts-accent))' 
                        : 'rgb(var(--tts-control-fg-secondary))'
                    }}
                  />
                )}
                <span className="sr-only">
                  {(isPlaying && currentTTSArticle?.id === article?.id)
                    ? "Pause reading article" 
                    : (isPaused && currentTTSArticle?.id === article?.id)
                      ? "Resume reading article"
                      : "Read article aloud"
                  }
                </span>
              </Button>
              
              <BookmarkButton
                articleId={articleId}
                articleTitle={article?.title}
              />
              
              <ShareButton 
                articleId={articleId} 
                isPerplexityArticle={isPerplexityArticle}
                compact={true}
              />
            </div>
          )}
        </div>
        
        {/* Hidden accessibility elements */}
        <DrawerTitle className="sr-only">Article Details</DrawerTitle>
        <DrawerDescription className="sr-only">
          Full article content and details
        </DrawerDescription>

        {/* Article content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {articleId && (
            <ArticleDetailSheet articleId={articleId} />
          )}
        </div>
      </DrawerContent>
    </Drawer>
    </>
  )
}