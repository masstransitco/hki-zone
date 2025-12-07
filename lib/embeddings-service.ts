/**
 * Embeddings Service for Article Deduplication
 * Uses OpenAI's text-embedding-3-small model to generate vector embeddings
 * for similarity comparison between articles
 *
 * OPTIMIZED: Added caching layer to reduce API costs by reusing embeddings
 */

import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Initialize Supabase client for caching
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

// Feature flag for embedding cache
const ENABLE_EMBEDDING_CACHE = process.env.ENABLE_EMBEDDING_CACHE === 'true'
const CACHE_TTL_DAYS = 7 // Embeddings valid for 7 days

/**
 * Generate a content hash for cache key
 */
function generateContentHash(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex')
}

/**
 * Get cached embeddings from database
 */
async function getCachedEmbeddings(
  contentHashes: string[]
): Promise<Map<string, number[]>> {
  if (!supabase || !ENABLE_EMBEDDING_CACHE || contentHashes.length === 0) {
    return new Map()
  }

  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - CACHE_TTL_DAYS)

    const { data, error } = await supabase
      .from('embedding_cache')
      .select('content_hash, embedding')
      .in('content_hash', contentHashes)
      .gte('created_at', cutoffDate.toISOString())

    if (error) {
      console.warn('⚠️ Failed to fetch cached embeddings:', error.message)
      return new Map()
    }

    const cache = new Map<string, number[]>()
    if (data) {
      data.forEach(row => {
        if (row.embedding) {
          cache.set(row.content_hash, row.embedding)
        }
      })
    }

    console.log(`📦 Embedding cache: ${cache.size}/${contentHashes.length} hits`)
    return cache
  } catch (error) {
    console.warn('⚠️ Embedding cache error:', error)
    return new Map()
  }
}

/**
 * Save embeddings to cache
 */
async function saveEmbeddingsToCache(
  items: Array<{ contentHash: string; embedding: number[] }>
): Promise<void> {
  if (!supabase || !ENABLE_EMBEDDING_CACHE || items.length === 0) {
    return
  }

  try {
    const rows = items.map(item => ({
      content_hash: item.contentHash,
      embedding: item.embedding,
      created_at: new Date().toISOString()
    }))

    // Use upsert to handle duplicate hashes
    const { error } = await supabase
      .from('embedding_cache')
      .upsert(rows, { onConflict: 'content_hash' })

    if (error) {
      console.warn('⚠️ Failed to cache embeddings:', error.message)
    } else {
      console.log(`💾 Cached ${items.length} new embeddings`)
    }
  } catch (error) {
    console.warn('⚠️ Error saving to embedding cache:', error)
  }
}

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
 * OPTIMIZED: Uses cache to avoid regenerating embeddings for same content
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
  const articlesWithText = articles.map(article => {
    const contentPreview = article.summary || article.content?.substring(0, 200) || ''
    // Normalize text: remove extra whitespace, lowercase for consistency
    const combinedText = `${article.title} ${contentPreview}`
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
    const contentHash = generateContentHash(combinedText)

    return {
      article,
      text: combinedText,
      contentHash
    }
  })

  // Check cache for existing embeddings
  const contentHashes = articlesWithText.map(a => a.contentHash)
  const cachedEmbeddings = await getCachedEmbeddings(contentHashes)

  // Separate cached from uncached
  const cachedResults: EmbeddingResult[] = []
  const uncachedArticles: typeof articlesWithText = []

  for (const item of articlesWithText) {
    const cached = cachedEmbeddings.get(item.contentHash)
    if (cached) {
      cachedResults.push({
        articleId: item.article.id,
        embedding: cached,
        text: item.text
      })
    } else {
      uncachedArticles.push(item)
    }
  }

  console.log(`📦 Cache status: ${cachedResults.length} cached, ${uncachedArticles.length} need generation`)

  // If all cached, return early
  if (uncachedArticles.length === 0) {
    console.log(`✅ All ${cachedResults.length} embeddings retrieved from cache (0 API calls)`)
    return cachedResults
  }

  try {
    // Generate embeddings for uncached articles only
    const textsToEmbed = uncachedArticles.map(a => a.text)

    // Use text-embedding-3-small for cost efficiency
    // 512 dimensions is sufficient for news article similarity
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: textsToEmbed,
      dimensions: 512
    })

    const newResults: EmbeddingResult[] = response.data.map((item, index) => ({
      articleId: uncachedArticles[index].article.id,
      embedding: item.embedding,
      text: uncachedArticles[index].text
    }))

    // Save new embeddings to cache (async, don't wait)
    const itemsToCache = newResults.map((result, index) => ({
      contentHash: uncachedArticles[index].contentHash,
      embedding: result.embedding
    }))
    saveEmbeddingsToCache(itemsToCache).catch(err =>
      console.warn('⚠️ Background cache save failed:', err)
    )

    // Combine cached and new results
    const allResults = [...cachedResults, ...newResults]

    const savedCost = cachedResults.length * 0.00002
    console.log(`✅ Generated ${newResults.length} new embeddings, ${cachedResults.length} from cache`)
    console.log(`💰 Estimated savings: $${savedCost.toFixed(5)} (${cachedResults.length} cached embeddings)`)

    return allResults

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