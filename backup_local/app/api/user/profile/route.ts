import { NextResponse } from "next/server"

const mockUserData = {
  savedArticles: [
    {
      id: "1",
      title: "AI Revolution: How Machine Learning is Transforming Healthcare",
      summary:
        "Artificial intelligence is revolutionizing healthcare with breakthrough applications in diagnosis, treatment planning, and drug discovery.",
      url: "https://example.com/ai-healthcare",
      source: "TechHealth Today",
      publishedAt: "2024-01-15T10:30:00Z",
      imageUrl: "/placeholder.svg?height=200&width=300",
      category: "Technology",
    },
  ],
  readingHistory: [
    {
      id: "2",
      title: "Climate Change: New Carbon Capture Technology Shows Promise",
      summary:
        "Scientists have developed a revolutionary carbon capture system that could remove millions of tons of CO2 from the atmosphere annually.",
      url: "https://example.com/carbon-capture",
      source: "Environmental Science Weekly",
      publishedAt: "2024-01-14T14:20:00Z",
      imageUrl: "/placeholder.svg?height=200&width=300",
      category: "Science",
    },
  ],
  preferences: {
    darkMode: false,
    fontSize: "medium",
    notifications: true,
  },
}

export async function GET() {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  return NextResponse.json(mockUserData)
}
