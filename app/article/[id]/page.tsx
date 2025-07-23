import { Suspense } from "react"
import type { Metadata } from "next"
import ArticleDetail from "@/components/article-detail"
import BackButton from "@/components/back-button"
import ShareButton from "@/components/share-button"
import LoadingSkeleton from "@/components/loading-skeleton"
import { ArticleStructuredData } from "@/components/structured-data"
import { getArticleById } from "@/lib/supabase"

interface ArticlePageProps {
  params: {
    id: string
  }
}

// Generate dynamic metadata for social sharing
export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  try {
    const article = await getArticleById(params.id)
    
    if (!article) {
      return {
        title: "Article Not Found - HKI 香港資訊",
        description: "The requested article could not be found."
      }
    }

    const title = article.title
    const description = article.summary || article.ai_summary || article.content?.substring(0, 160) || "Read the latest Hong Kong news and information."
    
    // Use optimized image from metadata if available, fallback to image_url
    let imageUrl = article.image_url || "/hki-logo-black.png"
    if (article.image_metadata && typeof article.image_metadata === 'object') {
      // Prefer optimized version for general social media
      imageUrl = article.image_metadata.optimized || article.image_metadata.original || imageUrl
    }
    
    const url = `https://hki.zone/article/${params.id}`
    
    return {
      title: `${title} - HKI 香港資訊`,
      description: description.length > 160 ? description.substring(0, 157) + "..." : description,
      keywords: [
        "Hong Kong news",
        "香港新聞",
        "香港資訊", 
        article.source,
        article.category || "news"
      ].join(", "),
      authors: article.author ? [{ name: article.author }] : undefined,
      openGraph: {
        title,
        description,
        url,
        siteName: "HKI 香港資訊",
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
        section: article.category || "News",
        tags: [
          "Hong Kong",
          "news",
          article.source,
          article.category || "general"
        ]
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [imageUrl],
        creator: article.author ? `@${article.author}` : "@hki_zone",
        site: "@hki_zone"
      },
      other: {
        // WhatsApp specific tags
        "og:image:width": "1200",
        "og:image:height": "630",
        "og:image:type": "image/jpeg",
        // Additional WhatsApp optimization
        "og:image:alt": title,
        // Preload hint for faster image loading
        "link:rel:preload": imageUrl,
        "link:as": "image"
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
      title: "HKI 香港資訊 - Hong Kong Information Hub",
      description: "Stay updated with the latest news from Hong Kong's top sources"
    }
  }
}

async function ArticlePageContent({ articleId }: { articleId: string }) {
  const article = await getArticleById(articleId)
  
  return (
    <>
      {article && <ArticleStructuredData article={article} />}
      <ArticleDetail articleId={articleId} />
    </>
  )
}

export default function ArticlePage({ params }: ArticlePageProps) {
  return (
    <div className="relative">
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="flex items-center justify-between p-4">
          <BackButton />
          <ShareButton articleId={params.id} title="" url="" />
        </div>
      </div>

      <div className="pt-[57px]">
        <Suspense fallback={<LoadingSkeleton />}>
          <ArticlePageContent articleId={params.id} />
        </Suspense>
      </div>
    </div>
  )
}
