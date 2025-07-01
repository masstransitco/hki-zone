import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function summarizeArticle(title: string, content: string): Promise<string> {
  try {
    // Check if we have the API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn("ANTHROPIC_API_KEY not found, using title as summary")
      return title
    }

    if (!content || content.length < 100) {
      return title // Return title as fallback if content is too short
    }

    const prompt = `Please provide a concise 2-3 sentence summary of this news article in English. Focus on the key facts and main points.

Title: ${title}

Content: ${content.substring(0, 2000)}...

Summary:`

    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    })

    const summary = message.content[0]?.type === "text" ? message.content[0].text : title
    return summary.trim()
  } catch (error) {
    console.error("Error summarizing article:", error)
    return title // Return title as fallback
  }
}

export async function summarizeArticles(articles: any[]): Promise<any[]> {
  const summarizedArticles = []

  // Check if we have the API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY not found, skipping AI summarization")
    return articles.map((article) => ({
      ...article,
      ai_summary: article.summary || article.title,
    }))
  }

  for (const article of articles) {
    try {
      console.log(`Summarizing: ${article.title.substring(0, 50)}...`)

      const aiSummary = await summarizeArticle(article.title, article.content)

      summarizedArticles.push({
        ...article,
        ai_summary: aiSummary,
        summary: aiSummary, // Use AI summary as the main summary
      })

      // Rate limiting to avoid API limits
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error) {
      console.error(`Error summarizing article ${article.title}:`, error)
      summarizedArticles.push({
        ...article,
        ai_summary: article.summary || article.title,
      }) // Include without AI summary
    }
  }

  return summarizedArticles
}
