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
import AuthDialog from "./auth-dialog"
import { useTTSContext } from "@/contexts/tts-context"
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
  const [showAuthDialog, setShowAuthDialog] = React.useState(false)
  
  const { isPlaying, isPaused, isLoading, currentArticle, playArticle, pause, resume, stop } = useTTSContext()

  // Debug logging for TTS states
  React.useEffect(() => {
    console.log('📱 Bottom Sheet - TTS States:', { 
      isPlaying, 
      isPaused, 
      isLoading, 
      open,
      articleId: article?.id,
      articleTitle: article?.title,
      currentArticleId: currentArticle?.id
    })
  }, [isPlaying, isPaused, isLoading, open, article, currentArticle])

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
      currentArticleId: currentArticle?.id,
      sameArticle: currentArticle?.id === article?.id
    })
    
    if (!article) {
      console.warn('📱 Bottom Sheet - No article available for TTS')
      return
    }

    try {
      // Handle same article - toggle pause/resume/play
      if (currentArticle?.id === article.id) {
        if (isPlaying) {
          console.log('📱 Bottom Sheet - Pausing currently playing article (same article)')
          pause()
        } else if (isPaused) {
          console.log('📱 Bottom Sheet - Resuming paused article (same article)')
          resume()
        } else {
          console.log('📱 Bottom Sheet - Restarting same article playback')
          await playArticle({
            id: article.id,
            title: article.title,
            content: article.content || ''
          })
        }
      } else {
        // Different article - playArticle will handle stopping previous article
        console.log('📱 Bottom Sheet - Starting new article playback (different article)')
        await playArticle({
          id: article.id,
          title: article.title,
          content: article.content || ''
        })
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
        currentArticleId: currentArticle?.id
      })
      // TTS continues playing - user can control via HUD
    }
  }, [open, isPlaying, isPaused, articleId, currentArticle])
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
          "fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[12px] border bg-background overflow-y-auto",
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
            <div className="absolute right-6 top-4 flex items-center gap-2" style={{ pointerEvents: 'auto', zIndex: 9000 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('📱 Bottom Sheet - Headphones button clicked!')
                  handleTextToSpeech()
                }}
                disabled={isLoading}
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
                {(isPlaying && currentArticle?.id === article?.id) ? (
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
                      color: (isPaused && currentArticle?.id === article?.id) 
                        ? 'rgb(var(--tts-accent))' 
                        : 'rgb(var(--tts-control-fg-secondary))'
                    }}
                  />
                )}
                <span className="sr-only">
                  {(isPlaying && currentArticle?.id === article?.id)
                    ? "Pause reading article" 
                    : (isPaused && currentArticle?.id === article?.id)
                      ? "Resume reading article"
                      : "Read article aloud"
                  }
                </span>
              </Button>
              
              <BookmarkButton
                articleId={articleId}
                articleTitle={article?.title}
                onAuthRequired={() => setShowAuthDialog(true)}
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
    
    <AuthDialog
      open={showAuthDialog}
      onOpenChange={setShowAuthDialog}
      title="Sign in required"
      description="Please sign in to bookmark articles for later reading."
    />
    </>
  )
}