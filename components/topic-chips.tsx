"use client"

import { Badge } from "@/components/ui/badge"
import { useLanguage } from "./language-provider"
import { analytics } from "@/lib/analytics"

const topics = [
  "all",
  "technology",
  "finance",
  "health",
  "politics",
  "science",
  "sports",
  "entertainment",
  "business",
  "world",
] as const

type Topic = (typeof topics)[number]

interface TopicChipsProps {
  selectedTopic: string
  onTopicSelect: (topic: string) => void
}

export default function TopicChips({ selectedTopic, onTopicSelect }: TopicChipsProps) {
  const { t } = useLanguage()

  const handleTopicClick = (topic: string) => {
    analytics.trackTopicSelect(topic)
    onTopicSelect(topic)
  }

  return (
    <div className="flex flex-wrap gap-2 p-4">
      {topics.map((topic) => (
        <Badge
          key={topic}
          variant={selectedTopic === topic ? "default" : "secondary"}
          className={`cursor-pointer transition-all duration-200 ${
            selectedTopic === topic
              ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700"
          }`}
          onClick={() => handleTopicClick(topic)}
        >
          {t(`topics.${topic}`)}
        </Badge>
      ))}
    </div>
  )
}
