"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Languages, CheckCircle2, Loader2 } from "lucide-react"

interface TrilingualProgress {
  step: 'headlines' | 'filtering' | 'enhancing' | 'saving' | 'complete'
  currentArticle: number
  totalArticles: number
  currentLanguage: 'en' | 'zh-TW' | 'zh-CN'
  completedByLanguage: {
    english: number
    traditionalChinese: number
    simplifiedChinese: number
  }
  estimatedTimeRemaining: number
  totalCost: number
}

interface Props {
  isOpen: boolean
  onClose: () => void
  progress: TrilingualProgress | null
}

export default function TrilingualAutoSelectModal({ isOpen, onClose, progress }: Props) {
  if (!progress) return null

  const getStepDescription = (step: string) => {
    switch (step) {
      case 'headlines':
        return 'AI selecting best articles from recent non-enhanced articles...'
      case 'filtering':
        return 'Perplexity analyzing articles for impact and enhancement potential...'
      case 'enhancing':
        return 'Creating AI-enhanced trilingual versions...'
      case 'saving':
        return 'Saving enhanced articles to database...'
      case 'complete':
        return 'Process completed successfully!'
      default:
        return 'Processing...'
    }
  }

  const getLanguageName = (lang: string) => {
    switch (lang) {
      case 'en':
        return 'English'
      case 'zh-TW':
        return '繁體中文'
      case 'zh-CN':
        return '简体中文'
      default:
        return lang
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  }

  const totalCompleted = progress.completedByLanguage.english + 
                        progress.completedByLanguage.traditionalChinese + 
                        progress.completedByLanguage.simplifiedChinese

  const progressPercentage = (totalCompleted / 30) * 100

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Trilingual Auto-Enhancement Progress
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Current Step */}
          <div className="flex items-center gap-3">
            {progress.step === 'complete' ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            )}
            <span className="text-sm font-medium">{getStepDescription(progress.step)}</span>
          </div>

          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total Progress</span>
              <span>{totalCompleted}/30 articles</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
          
          {/* Language-Specific Progress */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{progress.completedByLanguage.english}</div>
              <div className="text-sm text-gray-600">English</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{progress.completedByLanguage.traditionalChinese}</div>
              <div className="text-sm text-gray-600">繁體中文</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{progress.completedByLanguage.simplifiedChinese}</div>
              <div className="text-sm text-gray-600">简体中文</div>
            </div>
          </div>
          
          {/* Current Status */}
          {progress.step === 'enhancing' && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Current: Article {progress.currentArticle}/10</span>
                <Badge variant="outline">{getLanguageName(progress.currentLanguage)}</Badge>
              </div>
              <div className="text-xs text-gray-600">
                Processing trilingual enhancement for current article...
              </div>
            </div>
          )}
          
          {/* Time and Cost */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <div className="text-sm text-gray-600">Estimated Time Remaining</div>
              <div className="font-medium">
                {progress.step === 'complete' ? 'Completed' : formatTime(progress.estimatedTimeRemaining)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Estimated Cost</div>
              <div className="font-medium font-mono">${progress.totalCost.toFixed(4)}</div>
            </div>
          </div>

          {/* Success Message */}
          {progress.step === 'complete' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Successfully created 30 AI-enhanced articles!</span>
              </div>
              <div className="mt-2 text-sm text-green-700">
                Perplexity selected and enhanced 10 articles into English, Traditional Chinese, and Simplified Chinese versions.
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}