import { Metadata } from "next"
import { getArticleById } from "@/lib/supabase"
import { notFound } from "next/navigation"

interface DebugPageProps {
  params: {
    id: string
  }
}

export async function generateMetadata({ params }: DebugPageProps): Promise<Metadata> {
  const article = await getArticleById(params.id)
  
  if (!article) {
    return {
      title: "Article Not Found",
      description: "The requested article could not be found."
    }
  }

  // Get all image versions
  const images = {
    original: article.image_url,
    optimized: article.image_metadata?.optimized,
    whatsapp: article.image_metadata?.whatsapp,
    fallback: "/hki-logo-black.png"
  }
  
  const imageUrl = images.optimized || images.original || images.fallback
  
  return {
    title: article.title,
    description: article.summary || article.ai_summary || "Article preview",
    openGraph: {
      title: article.title,
      description: article.summary || article.ai_summary || "Article preview",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: article.title,
        }
      ],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.summary || article.ai_summary || "Article preview",
      images: [imageUrl],
    },
    other: {
      "og:image:width": "1200",
      "og:image:height": "630",
      "og:image:type": "image/jpeg",
    },
  }
}

export default async function DebugOGTags({ params }: DebugPageProps) {
  const article = await getArticleById(params.id)
  
  if (!article) {
    notFound()
  }
  
  const images = {
    original: article.image_url,
    optimized: article.image_metadata?.optimized,
    whatsapp: article.image_metadata?.whatsapp,
  }
  
  const currentImageUrl = images.optimized || images.original || "/hki-logo-black.png"
  
  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Open Graph Tags Debug</h1>
      
      <div className="bg-gray-100 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">Article Information</h2>
        <dl className="space-y-2">
          <div>
            <dt className="font-medium">Title:</dt>
            <dd className="text-gray-700">{article.title}</dd>
          </div>
          <div>
            <dt className="font-medium">ID:</dt>
            <dd className="text-gray-700">{article.id}</dd>
          </div>
          <div>
            <dt className="font-medium">Source:</dt>
            <dd className="text-gray-700">{article.source}</dd>
          </div>
        </dl>
      </div>
      
      <div className="bg-gray-100 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">Image URLs</h2>
        <dl className="space-y-4">
          <div>
            <dt className="font-medium">Current OG Image:</dt>
            <dd className="text-gray-700 break-all">{currentImageUrl}</dd>
          </div>
          {images.original && (
            <div>
              <dt className="font-medium">Original Image:</dt>
              <dd className="text-gray-700 break-all">{images.original}</dd>
            </div>
          )}
          {images.optimized && (
            <div>
              <dt className="font-medium">Optimized Image (1200x630):</dt>
              <dd className="text-gray-700 break-all">{images.optimized}</dd>
            </div>
          )}
          {images.whatsapp && (
            <div>
              <dt className="font-medium">WhatsApp Image (800x800):</dt>
              <dd className="text-gray-700 break-all">{images.whatsapp}</dd>
            </div>
          )}
        </dl>
      </div>
      
      <div className="bg-gray-100 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">Image Preview</h2>
        {currentImageUrl && (
          <img 
            src={currentImageUrl} 
            alt={article.title}
            className="w-full max-w-2xl mx-auto rounded-lg shadow-lg"
          />
        )}
      </div>
      
      <div className="bg-gray-100 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">Testing Tools</h2>
        <div className="space-y-4">
          <a 
            href={`https://developers.facebook.com/tools/debug/?q=https://hki.zone/article/${article.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Test with Facebook Sharing Debugger →
          </a>
          <a 
            href={`https://cards-dev.twitter.com/validator`}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 bg-black text-white rounded-lg hover:bg-gray-900 transition"
          >
            Test with Twitter Card Validator →
          </a>
          <a 
            href={`https://www.linkedin.com/post-inspector/inspect/https://hki.zone/article/${article.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition"
          >
            Test with LinkedIn Post Inspector →
          </a>
        </div>
      </div>
      
      <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
        <h3 className="font-semibold text-yellow-800 mb-2">WhatsApp Testing</h3>
        <p className="text-yellow-700">
          To test WhatsApp preview, share this URL in a WhatsApp chat:
        </p>
        <code className="block mt-2 p-2 bg-yellow-100 rounded text-sm break-all">
          https://hki.zone/article/{article.id}
        </code>
        <p className="text-yellow-700 mt-2 text-sm">
          Note: WhatsApp caches previews aggressively. You may need to wait or use a different chat to see updates.
        </p>
      </div>
    </div>
  )
}