import type { Article } from "@/lib/types"

interface ArticleStructuredDataProps {
  article: Article
}

export function ArticleStructuredData({ article }: ArticleStructuredDataProps) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.summary || article.content?.substring(0, 200),
    image: article.imageUrl ? [article.imageUrl] : ["/hki-logo-black.png"],
    author: {
      "@type": "Person",
      name: article.source,
    },
    publisher: {
      "@type": "Organization",
      name: "HKI 香港資訊",
      logo: {
        "@type": "ImageObject",
        url: "https://hki.zone/hki-logo-black.png",
        width: 400,
        height: 400
      }
    },
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://hki.zone/article/${article.id}`
    },
    articleSection: article.category || "News",
    inLanguage: "en-HK",
    isAccessibleForFree: true,
    url: `https://hki.zone/article/${article.id}`,
    keywords: [
      "Hong Kong news",
      "香港新聞", 
      "香港資訊",
      article.source,
      article.category || "news"
    ].join(", ")
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}

export function WebsiteStructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "HKI 香港資訊",
    alternateName: "Hong Kong Information Hub",
    url: "https://hki.zone",
    description: "Stay updated with the latest news from Hong Kong's top sources",
    publisher: {
      "@type": "Organization",
      name: "HKI 香港資訊",
      logo: {
        "@type": "ImageObject",
        url: "https://hki.zone/hki-logo-black.png",
        width: 400,
        height: 400
      }
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://hki.zone/search?q={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    },
    inLanguage: ["en-HK", "zh-HK"],
    audience: {
      "@type": "Audience",
      geographicArea: {
        "@type": "Country",
        name: "Hong Kong"
      }
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}