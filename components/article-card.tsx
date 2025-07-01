import Link from "next/link"
import Image from "next/image"
import { Clock, ExternalLink } from "lucide-react"
import type { Article } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"

interface ArticleCardProps {
  article: Article
}

export default function ArticleCard({ article }: ArticleCardProps) {
  return (
    <article className="bg-white dark:bg-[rgb(28,28,30)] rounded-xl p-4 apple-shadow-sm hover:apple-shadow transition-all duration-200 border border-[rgb(229,229,234)] dark:border-[rgb(44,44,46)] hover:border-[rgb(209,209,214)] dark:hover:border-[rgb(58,58,60)]">
      <Link href={`/article/${article.id}`} className="block apple-focus rounded-lg">
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-headline text-[rgb(28,28,30)] dark:text-white line-clamp-2 mb-2 leading-snug">
              {article.title}
            </h2>

            <p className="text-footnote text-[rgb(142,142,147)] line-clamp-3 mb-3 leading-relaxed">{article.summary}</p>

            <div className="flex items-center justify-between text-caption-1 text-[rgb(174,174,178)] dark:text-[rgb(99,99,102)]">
              <div className="flex items-center gap-3">
                <span className="text-caption-2 text-[rgb(0,122,255)] dark:text-[rgb(10,132,255)] font-medium">
                  {article.source}
                </span>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}</span>
                </div>
              </div>

              <ExternalLink className="w-3 h-3 opacity-50" />
            </div>
          </div>

          {article.imageUrl && (
            <div className="w-20 h-20 flex-shrink-0">
              <Image
                src={article.imageUrl || "/placeholder.svg"}
                alt={article.title}
                width={80}
                height={80}
                className="w-full h-full object-cover rounded-lg border border-[rgb(229,229,234)] dark:border-[rgb(58,58,60)]"
                onError={(e) => {
                  e.currentTarget.style.display = "none"
                }}
              />
            </div>
          )}
        </div>
      </Link>
    </article>
  )
}
