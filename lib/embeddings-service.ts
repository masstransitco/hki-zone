/**
 * Embeddings Service for Article Deduplication
 * Uses OpenAI's text-embedding-3-small model to generate vector embeddings
 * for similarity comparison between articles
 */

import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export interface ArticleForEmbedding {
  id: string
  title: string
  summary?: string
  content?: string
  source: string
}

export interface EmbeddingResult {
  articleId: string
  embedding: number[]
  text: string
}

/**
 * Generate embeddings for multiple articles
 * Combines title and first 200 chars of content for better similarity detection
 */
export async function generateEmbeddings(
  articles: ArticleForEmbedding[]
): Promise<EmbeddingResult[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured')
  }

  if (articles.length === 0) {
    return []
  }

  console.log(`🔍 Generating embeddings for ${articles.length} articles...`)
  
  // Prepare texts for embedding - combine title with content preview
  const texts = articles.map(article => {
    const contentPreview = article.summary || article.content?.substring(0, 200) || ''
    // Normalize text: remove extra whitespace, lowercase for consistency
    const combinedText = `${article.title} ${contentPreview}`
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
    
    return combinedText
  })

  try {
    // Use text-embedding-3-small for cost efficiency
    // 512 dimensions is sufficient for news article similarity
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
      dimensions: 512
    })

    const results: EmbeddingResult[] = response.data.map((item, index) => ({
      articleId: articles[index].id,
      embedding: item.embedding,
      text: texts[index]
    }))

    console.log(`✅ Generated ${results.length} embeddings successfully`)
    return results

  } catch (error) {
    console.error('❌ Error generating embeddings:', error)
    throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Calculate cosine similarity between two embedding vectors
 * Returns a value between -1 and 1, where 1 means identical
 */
export function calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same dimensions')
  }

  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i]
    norm1 += vec1[i] * vec1[i]
    norm2 += vec2[i] * vec2[i]
  }

  norm1 = Math.sqrt(norm1)
  norm2 = Math.sqrt(norm2)

  if (norm1 === 0 || norm2 === 0) {
    return 0
  }

  return dotProduct / (norm1 * norm2)
}

export interface SimilarityMatrix {
  articleIds: string[]
  similarities: number[][]
}

/**
 * Build a similarity matrix for all articles
 * Used for clustering similar stories
 */
export function buildSimilarityMatrix(embeddings: EmbeddingResult[]): SimilarityMatrix {
  const n = embeddings.length
  const similarities: number[][] = Array(n).fill(null).map(() => Array(n).fill(0))
  
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      if (i === j) {
        similarities[i][j] = 1
      } else {
        const similarity = calculateCosineSimilarity(
          embeddings[i].embedding,
          embeddings[j].embedding
        )
        similarities[i][j] = similarity
        similarities[j][i] = similarity // Matrix is symmetric
      }
    }
  }

  return {
    articleIds: embeddings.map(e => e.articleId),
    similarities
  }
}

export interface StoryCluster {
  clusterId: string
  articles: ArticleForEmbedding[]
  averageSimilarity: number
  centroidEmbedding?: number[]
}

/**
 * Cluster articles by similarity using a threshold-based approach
 * Articles with similarity > threshold are grouped together
 */
export function clusterBySimilarity(
  articles: ArticleForEmbedding[],
  embeddings: EmbeddingResult[],
  threshold: number = 0.85
): StoryCluster[] {
  if (articles.length === 0) {
    return []
  }

  // Create a map for quick lookup
  const embeddingMap = new Map(embeddings.map(e => [e.articleId, e]))
  const articleMap = new Map(articles.map(a => [a.id, a]))
  
  const clusters: StoryCluster[] = []
  const assigned = new Set<string>()

  for (const article of articles) {
    if (assigned.has(article.id)) continue

    const cluster: ArticleForEmbedding[] = [article]
    const clusterEmbedding = embeddingMap.get(article.id)
    if (!clusterEmbedding) continue

    assigned.add(article.id)
    let similaritySum = 0
    let similarityCount = 0

    // Find all similar articles
    for (const otherArticle of articles) {
      if (assigned.has(otherArticle.id) || otherArticle.id === article.id) continue

      const otherEmbedding = embeddingMap.get(otherArticle.id)
      if (!otherEmbedding) continue

      const similarity = calculateCosineSimilarity(
        clusterEmbedding.embedding,
        otherEmbedding.embedding
      )

      if (similarity >= threshold) {
        cluster.push(otherArticle)
        assigned.add(otherArticle.id)
        similaritySum += similarity
        similarityCount++
      }
    }

    // Calculate average similarity within cluster
    const avgSimilarity = similarityCount > 0 
      ? similaritySum / similarityCount 
      : 1 // Single article cluster has perfect similarity with itself

    clusters.push({
      clusterId: `cluster_${clusters.length + 1}_${article.id.substring(0, 8)}`,
      articles: cluster,
      averageSimilarity: avgSimilarity
    })
  }

  console.log(`📊 Clustering results:`)
  console.log(`   • Total articles: ${articles.length}`)
  console.log(`   • Unique story clusters: ${clusters.length}`)
  console.log(`   • Duplicate articles removed: ${articles.length - clusters.length}`)
  
  // Log cluster details
  clusters.forEach((cluster, index) => {
    if (cluster.articles.length > 1) {
      console.log(`   • Cluster ${index + 1}: ${cluster.articles.length} articles`)
      console.log(`     Sources: ${cluster.articles.map(a => a.source).join(', ')}`)
      console.log(`     Avg similarity: ${(cluster.averageSimilarity * 100).toFixed(1)}%`)
    }
  })

  return clusters
}

/**
 * Find articles that are in the "borderline" similarity range
 * These require additional NLP verification
 */
export function findBorderlinePairs(
  embeddings: EmbeddingResult[],
  lowerThreshold: number = 0.70,
  upperThreshold: number = 0.85
): Array<{ article1Id: string; article2Id: string; similarity: number }> {
  const borderlinePairs: Array<{ article1Id: string; article2Id: string; similarity: number }> = []

  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      const similarity = calculateCosineSimilarity(
        embeddings[i].embedding,
        embeddings[j].embedding
      )

      if (similarity >= lowerThreshold && similarity < upperThreshold) {
        borderlinePairs.push({
          article1Id: embeddings[i].articleId,
          article2Id: embeddings[j].articleId,
          similarity
        })
      }
    }
  }

  console.log(`🔍 Found ${borderlinePairs.length} borderline pairs for NLP verification`)
  return borderlinePairs
}