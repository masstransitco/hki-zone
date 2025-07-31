import { Suspense } from "react"
import type { Metadata } from "next"
import BackButton from "@/components/back-button"
import ShareButton from "@/components/share-button"
import LoadingSkeleton from "@/components/loading-skeleton"
import ArticleDetailSheet from "@/components/article-detail-sheet"
import { supabase } from "@/lib/supabase"

interface SignalPageProps {
  params: {
    id: string
  }
}

// Function to get signal by ID
async function getSignalById(id: string) {
  try {
    const { data: article, error } = await supabase
      .from('perplexity_news')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error("Error fetching signal:", error)
      return null
    }

    return article
  } catch (error) {
    console.error("Error in getSignalById:", error)
    return null
  }
}

// Generate dynamic metadata for social sharing
export async function generateMetadata({ params }: SignalPageProps): Promise<Metadata> {
  try {
    const article = await getSignalById(params.id)
    
    if (!article) {
      return {
        title: "Signal Not Found - HKI Signals",
        description: "The requested AI-generated signal could not be found."
      }
    }

    const title = article.title || "AI Signal"
    const description = article.summary || article.content?.substring(0, 160) || "Read AI-generated insights and analysis on HKI Signals."
    
    // Use article image or fallback
    let imageUrl = article.image_url || "/hki-logo-black.png"
    if (article.image_metadata && typeof article.image_metadata === 'object') {
      imageUrl = article.image_metadata.optimized || article.image_metadata.original || imageUrl
    }
    
    const url = `https://hki.zone/signals/${params.id}`
    
    return {
      title: `${title} - HKI Signals`,
      description: description.length > 160 ? description.substring(0, 157) + "..." : description,
      keywords: [
        "Hong Kong news",
        "AI analysis",
        "signals",
        "AI insights",
        "香港資訊",
        "人工智能分析"
      ].join(", "),
      openGraph: {
        title: `${title} - HKI Signals`,
        description,
        url,
        siteName: "HKI Signals",
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: title,
          }
        ],
        locale: "en_HK",
        type: "article",
        publishedTime: article.published_at || article.created_at,
        modifiedTime: article.updated_at,
        section: "AI Signals",
        tags: [
          "Hong Kong",
          "AI",
          "signals",
          "analysis"
        ]
      },
      twitter: {
        card: "summary_large_image",
        title: `${title} - HKI Signals`,
        description,
        images: [imageUrl],
        creator: "@hki_zone",
        site: "@hki_zone"
      },
      other: {
        // WhatsApp specific tags
        "og:image:width": "1200",
        "og:image:height": "630",
        "og:image:type": "image/jpeg",
        "og:image:alt": title,
      },
      alternates: {
        canonical: url
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-video-preview": -1,
          "max-image-preview": "large",
          "max-snippet": -1,
        }
      }
    }
  } catch (error) {
    console.error("Error generating metadata:", error)
    return {
      title: "HKI Signals - AI-Generated Hong Kong Insights",
      description: "Read AI-generated insights and analysis about Hong Kong news and trends"
    }
  }
}

async function SignalPageContent({ articleId }: { articleId: string }) {
  const article = await getSignalById(articleId)
  
  if (!article) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
          Signal Not Found
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 text-center">
          The AI signal you're looking for doesn't exist or has been removed.
        </p>
      </div>
    )
  }
  
  return (
    <div className="max-w-4xl mx-auto p-4">
      <ArticleDetailSheet articleId={articleId} />
    </div>
  )
}

export default function SignalPage({ params }: SignalPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="flex items-center justify-between p-4">
          <BackButton />
          <ShareButton 
            articleId={params.id} 
            isPerplexityArticle={true}
            title="" 
            url="" 
          />
        </div>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <SignalPageContent articleId={params.id} />
      </Suspense>
    </div>
  )
}