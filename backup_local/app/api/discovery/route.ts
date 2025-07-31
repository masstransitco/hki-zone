import { NextResponse } from "next/server"

const mockDiscoveryData = {
  trending: [
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
  recommended: [
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
  recent: [
    {
      id: "3",
      title: "Cryptocurrency Market Sees Major Institutional Adoption",
      summary:
        "Major financial institutions are increasingly adopting cryptocurrency solutions, with several banks announcing new digital asset services.",
      url: "https://example.com/crypto-adoption",
      source: "Financial Times",
      publishedAt: "2024-01-13T09:15:00Z",
      imageUrl: "/placeholder.svg?height=200&width=300",
      category: "Finance",
    },
  ],
}

export async function GET() {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  return NextResponse.json(mockDiscoveryData)
}
