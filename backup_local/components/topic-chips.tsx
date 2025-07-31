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
    <div className="flex flex-wrap gap-2 p-3 md:p-4">
      {topics.map((topic) => (
        <Badge
          key={topic}
          variant={selectedTopic === topic ? "default" : "secondary"}
          className={`cursor-pointer transition-all duration-200 ${
            selectedTopic === topic
              ? "bg-interactive-primary text-text-inverse hover:bg-interactive-hover"
              : "bg-surface text-text-secondary hover:bg-surface-hover border-border"
          }`}
          onClick={() => handleTopicClick(topic)}
        >
          {t(`topics.${topic}`)}
        </Badge>
      ))}
    </div>
  )
}
