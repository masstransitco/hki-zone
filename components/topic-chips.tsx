"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { useLanguage } from "./language-provider"

const topicKeys = [
  "topics.all",
  "topics.technology",
  "topics.finance",
  "topics.health",
  "topics.politics",
  "topics.science",
  "topics.sports",
  "topics.entertainment",
  "topics.business",
  "topics.world",
]

export default function TopicChips() {
  const [selectedTopic, setSelectedTopic] = useState("topics.all")
  const { t } = useLanguage()

  return (
    <div className="px-4 py-3">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {topicKeys.map((topicKey) => (
          <button
            key={topicKey}
            onClick={() => setSelectedTopic(topicKey)}
            className={cn(
              "px-4 py-2 rounded-full text-subhead whitespace-nowrap transition-all apple-focus",
              selectedTopic === topicKey
                ? "bg-[rgb(var(--apple-blue))] text-white shadow-sm"
                : "bg-[rgb(var(--apple-gray-6))] dark:bg-[rgb(var(--apple-gray-5))] text-[rgb(var(--apple-gray-1))] hover:bg-[rgb(var(--apple-gray-5))] dark:hover:bg-[rgb(var(--apple-gray-4))] hover:text-foreground",
            )}
          >
            {t(topicKey)}
          </button>
        ))}
      </div>
    </div>
  )
}
