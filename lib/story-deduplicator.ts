/**
 * Story Deduplicator Module
 * Identifies and removes duplicate news stories from different sources
 * using a hybrid approach: embeddings + NLP verification
 */

import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { 
  generateEmbeddings, 
  clusterBySimilarity, 
  findBorderlinePairs,
  type ArticleForEmbedding,
  type StoryCluster 
} from './embeddings-service'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Initialize Supabase client for metrics storage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = supabaseUrl && supabaseServiceRoleKey 
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null

// Source reliability scores (higher = more reliable)
export const SOURCE_RELIABILITY_SCORES: Record<string, number> = {
  'scmp': 9,
  'HKFP': 8,
  'RTHK': 8,
  'bloomberg': 9,
  'TheStandard': 7,
  'SingTao': 6,
  'HK01': 6,
  'on.cc': 5,
  'am730': 5,
  'AM730': 5,
  'bastillepost': 4,
  'BastillePost': 4
}

export interface ArticleWithMetadata extends ArticleForEmbedding {
  created_at: string
  published_at?: string
  image_url?: string
  content_length?: number
  has_image?: boolean
  category?: string
}

export interface DeduplicationResult {
  uniqueArticles: ArticleWithMetadata[]
  clusters: StoryCluster[]
  duplicatesRemoved: number
  stats: {
    originalCount: number
    uniqueStories: number
    averageClusterSize: number
    largestCluster: number
    sourcesRepresented: string[]
  }
}

/**
 * Main deduplication function
 * Removes duplicate stories and selects the best version from each cluster
 */
export async function deduplicateStories(
  candidateArticles: ArticleWithMetadata[],
  sessionId?: string
): Promise<DeduplicationResult> {
  if (candidateArticles.length === 0) {
    return {
      uniqueArticles: [],
      clusters: [],
      duplicatesRemoved: 0,
      stats: {
        originalCount: 0,
        uniqueStories: 0,
        averageClusterSize: 0,
        largestCluster: 0,
        sourcesRepresented: []
      }
    }
  }

  console.log(`\n🔄 Starting story deduplication for ${candidateArticles.length} articles...`)
  
  // Track timing for performance metrics
  const startTime = Date.now()
  let embeddingsTime = 0
  let clusteringTime = 0
  let nlpVerificationTime = 0
  let nlpVerifications = 0
  let clustersMerged = 0
  
  // Track source distribution before deduplication
  const sourcesBefore: Record<string, number> = {}
  candidateArticles.forEach(article => {
    sourcesBefore[article.source] = (sourcesBefore[article.source] || 0) + 1
  })
  
  try {
    // Step 1: Generate embeddings for all articles
    const embeddingsStart = Date.now()
    const embeddings = await generateEmbeddings(candidateArticles)
    embeddingsTime = Date.now() - embeddingsStart
    
    // Step 2: Cluster articles with high similarity (>85%)
    const clusteringStart = Date.now()
    let clusters = clusterBySimilarity(candidateArticles, embeddings, 0.85)
    clusteringTime = Date.now() - clusteringStart
    
    // Step 3: Find borderline cases that need NLP verification
    const borderlinePairs = findBorderlinePairs(embeddings, 0.70, 0.85)
    
    if (borderlinePairs.length > 0) {
      console.log(`🤖 Running NLP verification for ${borderlinePairs.length} borderline pairs...`)
      
      const nlpStart = Date.now()
      // Track merges for metrics
      const initialClusterCount = clusters.length
      
      // Verify borderline cases and merge clusters if needed
      clusters = await verifyAndMergeClusters(clusters, borderlinePairs, candidateArticles)
      
      nlpVerificationTime = Date.now() - nlpStart
      nlpVerifications = Math.min(borderlinePairs.length, 10) // We limit to 10 verifications
      clustersMerged = initialClusterCount - clusters.length
    }
    
    // Step 4: Select the best article from each cluster
    const uniqueArticles: ArticleWithMetadata[] = []
    
    for (const cluster of clusters) {
      const bestArticle = selectBestFromCluster(cluster.articles as ArticleWithMetadata[])
      uniqueArticles.push(bestArticle)
      
      if (cluster.articles.length > 1) {
        console.log(`   ✅ Selected "${bestArticle.title.substring(0, 50)}..." from ${bestArticle.source}`)
        console.log(`      (chose from ${cluster.articles.length} duplicates: ${cluster.articles.map(a => a.source).join(', ')})`)
      }
    }
    
    // Calculate statistics
    const duplicatesRemoved = candidateArticles.length - uniqueArticles.length
    const sourcesRepresented = [...new Set(uniqueArticles.map(a => a.source))]
    const clusterSizes = clusters.map(c => c.articles.length)
    const largestCluster = Math.max(...clusterSizes, 0)
    const averageClusterSize = clusterSizes.length > 0 
      ? clusterSizes.reduce((a, b) => a + b, 0) / clusterSizes.length 
      : 1
    
    // Track source distribution after deduplication
    const sourcesAfter: Record<string, number> = {}
    uniqueArticles.forEach(article => {
      sourcesAfter[article.source] = (sourcesAfter[article.source] || 0) + 1
    })
    
    // Calculate costs
    const embeddingsCost = candidateArticles.length * 0.00002 // $0.00002 per embedding
    const nlpCost = nlpVerifications * 0.00015 // $0.00015 per GPT-4o-mini call
    const totalCost = embeddingsCost + nlpCost
    
    const totalTime = Date.now() - startTime
    const reductionRate = candidateArticles.length > 0 
      ? (duplicatesRemoved / candidateArticles.length) * 100 
      : 0
    
    console.log(`\n✨ Deduplication complete:`)
    console.log(`   • Original articles: ${candidateArticles.length}`)
    console.log(`   • Unique stories: ${uniqueArticles.length}`)
    console.log(`   • Duplicates removed: ${duplicatesRemoved} (${Math.round(reductionRate)}%)`)
    console.log(`   • Sources represented: ${sourcesRepresented.join(', ')}`)
    console.log(`   • Processing time: ${totalTime}ms`)
    console.log(`   • Cost: $${totalCost.toFixed(6)}`)
    
    // Store metrics in database if Supabase is configured and sessionId provided
    if (supabase && sessionId) {
      try {
        const metrics = {
          session_id: sessionId,
          original_count: candidateArticles.length,
          unique_stories: uniqueArticles.length,
          duplicates_removed: duplicatesRemoved,
          reduction_rate: reductionRate,
          embeddings_time_ms: embeddingsTime,
          clustering_time_ms: clusteringTime,
          nlp_verification_time_ms: nlpVerificationTime,
          total_time_ms: totalTime,
          average_cluster_size: averageClusterSize,
          largest_cluster: largestCluster,
          cluster_count: clusters.length,
          sources_before: sourcesBefore,
          sources_after: sourcesAfter,
          sources_represented: sourcesRepresented,
          borderline_pairs: borderlinePairs.length,
          nlp_verifications: nlpVerifications,
          clusters_merged: clustersMerged,
          embeddings_cost: embeddingsCost,
          nlp_cost: nlpCost,
          total_cost: totalCost,
          enable_story_dedup: true,
          error_occurred: false
        }
        
        const { error } = await supabase
          .from('deduplication_metrics')
          .insert(metrics)
        
        if (error) {
          console.error('Failed to store deduplication metrics:', error)
        } else {
          console.log(`   📊 Metrics stored for session ${sessionId}`)
        }
      } catch (error) {
        console.error('Error storing metrics:', error)
      }
    }
    
    return {
      uniqueArticles,
      clusters,
      duplicatesRemoved,
      stats: {
        originalCount: candidateArticles.length,
        uniqueStories: uniqueArticles.length,
        averageClusterSize,
        largestCluster,
        sourcesRepresented
      }
    }
    
  } catch (error) {
    console.error('❌ Error in story deduplication:', error)
    
    // Store error metrics if possible
    if (supabase && sessionId) {
      try {
        await supabase
          .from('deduplication_metrics')
          .insert({
            session_id: sessionId,
            original_count: candidateArticles.length,
            unique_stories: candidateArticles.length,
            duplicates_removed: 0,
            reduction_rate: 0,
            total_time_ms: Date.now() - startTime,
            error_occurred: true,
            error_message: error instanceof Error ? error.message : 'Unknown error',
            enable_story_dedup: true
          })
      } catch (metricError) {
        console.error('Failed to store error metrics:', metricError)
      }
    }
    
    // Fallback: return original articles if deduplication fails
    console.log('⚠️ Falling back to original articles without deduplication')
    return {
      uniqueArticles: candidateArticles,
      clusters: candidateArticles.map(a => ({
        clusterId: a.id,
        articles: [a],
        averageSimilarity: 1
      })),
      duplicatesRemoved: 0,
      stats: {
        originalCount: candidateArticles.length,
        uniqueStories: candidateArticles.length,
        averageClusterSize: 1,
        largestCluster: 1,
        sourcesRepresented: [...new Set(candidateArticles.map(a => a.source))]
      }
    }
  }
}

/**
 * Select the best article from a cluster based on multiple criteria
 */
export function selectBestFromCluster(cluster: ArticleWithMetadata[]): ArticleWithMetadata {
  if (cluster.length === 1) {
    return cluster[0]
  }
  
  // Sort articles by quality score
  const scored = cluster.map(article => {
    let score = 0
    
    // Content length (longer = better, up to 2000 chars)
    const contentLength = article.content_length || article.content?.length || 0
    score += Math.min(contentLength, 2000) * 0.01 // Max 20 points
    
    // Source reliability
    const reliability = SOURCE_RELIABILITY_SCORES[article.source] || 5
    score += reliability * 10 // Max 90 points
    
    // Has image
    if (article.has_image || article.image_url) {
      score += 20
    }
    
    // Recency (prefer articles from last 2 hours)
    const hoursAgo = getHoursAgo(new Date(article.created_at))
    if (hoursAgo < 2) {
      score += 30
    } else if (hoursAgo < 4) {
      score += 20
    } else if (hoursAgo < 6) {
      score += 10
    }
    
    // Has summary
    if (article.summary && article.summary.length > 50) {
      score += 10
    }
    
    return { article, score }
  })
  
  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)
  
  return scored[0].article
}

/**
 * Verify if two articles are about the same story using GPT-4
 */
async function verifyDuplicateWithNLP(
  article1: ArticleWithMetadata,
  article2: ArticleWithMetadata
): Promise<boolean> {
  const prompt = `Compare these two news articles and determine if they report the SAME news event:

Article 1: "${article1.title}"
Source: ${article1.source}
Summary: ${article1.summary || article1.content?.substring(0, 200) || ''}

Article 2: "${article2.title}"  
Source: ${article2.source}
Summary: ${article2.summary || article2.content?.substring(0, 200) || ''}

Consider:
- Are they about the same specific event/announcement?
- Do they share the same key facts (who, what, when, where)?
- Are the main entities/numbers/dates the same?

Respond with only: SAME or DIFFERENT`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 10,
      temperature: 0
    })
    
    const result = response.choices[0].message.content?.trim().toUpperCase()
    return result === 'SAME'
    
  } catch (error) {
    console.error('Error in NLP verification:', error)
    // Default to not duplicate if verification fails
    return false
  }
}

/**
 * Verify borderline pairs and merge clusters if they're the same story
 */
async function verifyAndMergeClusters(
  clusters: StoryCluster[],
  borderlinePairs: Array<{ article1Id: string; article2Id: string; similarity: number }>,
  articles: ArticleWithMetadata[]
): Promise<StoryCluster[]> {
  const articleMap = new Map(articles.map(a => [a.id, a]))
  const clusterMap = new Map<string, StoryCluster>()
  
  // Build a map of article ID to cluster
  for (const cluster of clusters) {
    for (const article of cluster.articles) {
      clusterMap.set(article.id, cluster)
    }
  }
  
  // Process borderline pairs in batches to avoid too many API calls
  const verificationBatch = borderlinePairs.slice(0, 10) // Limit to 10 verifications per selection
  
  for (const pair of verificationBatch) {
    const article1 = articleMap.get(pair.article1Id)
    const article2 = articleMap.get(pair.article2Id)
    
    if (!article1 || !article2) continue
    
    const cluster1 = clusterMap.get(pair.article1Id)
    const cluster2 = clusterMap.get(pair.article2Id)
    
    // Skip if already in same cluster
    if (cluster1 === cluster2) continue
    
    // Verify if they're the same story
    const isSame = await verifyDuplicateWithNLP(article1, article2)
    
    if (isSame && cluster1 && cluster2) {
      console.log(`   🔗 Merging clusters: "${article1.title.substring(0, 30)}..." and "${article2.title.substring(0, 30)}..."`)
      
      // Merge cluster2 into cluster1
      cluster1.articles.push(...cluster2.articles)
      
      // Update cluster map for all articles in cluster2
      for (const article of cluster2.articles) {
        clusterMap.set(article.id, cluster1)
      }
      
      // Remove cluster2 from clusters array
      const index = clusters.indexOf(cluster2)
      if (index > -1) {
        clusters.splice(index, 1)
      }
    }
  }
  
  return clusters
}

/**
 * Extract key entities from article for comparison
 */
export function extractStoryFeatures(article: ArticleWithMetadata): {
  entities: string[]
  numbers: string[]
  keywords: string[]
} {
  const text = `${article.title} ${article.summary || ''} ${article.content?.substring(0, 500) || ''}`
  
  // Extract numbers (money amounts, percentages, counts)
  const numbers = (text.match(/\d+[,.]?\d*/g) || [])
    .filter(n => n.length > 1) // Filter out single digits
  
  // Extract potential entity names (capitalized words)
  const entities = (text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [])
    .filter(e => e.length > 3) // Filter out short words
  
  // Extract Chinese entities if present
  const chineseEntities = (text.match(/[\u4e00-\u9fff]+/g) || [])
    .filter(e => e.length > 1)
  
  // Combine and deduplicate
  const allEntities = [...new Set([...entities, ...chineseEntities])]
  
  // Extract key words (for now, just split and filter)
  const keywords = text
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 4)
    .slice(0, 20) // Limit to first 20 keywords
  
  return {
    entities: allEntities.slice(0, 10),
    numbers: [...new Set(numbers)].slice(0, 10),
    keywords: [...new Set(keywords)]
  }
}

/**
 * Helper function to calculate hours ago from a date
 */
function getHoursAgo(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60))
}