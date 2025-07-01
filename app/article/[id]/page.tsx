import { Suspense } from "react"
import ArticleDetail from "@/components/article-detail"
import BackButton from "@/components/back-button"
import ShareButton from "@/components/share-button"
import LoadingSkeleton from "@/components/loading-skeleton"

interface ArticlePageProps {
  params: {
    id: string
  }
}

export default function ArticlePage({ params }: ArticlePageProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="flex items-center justify-between p-4">
          <BackButton />
          <ShareButton articleId={params.id} />
        </div>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <ArticleDetail articleId={params.id} />
      </Suspense>
    </div>
  )
}
