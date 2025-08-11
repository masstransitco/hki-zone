import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

interface TimeSeriesData {
  timestamp: string
  duplicates_removed: number
  reduction_rate: number
  total_cost: number
}

interface SourceEfficiency {
  source: string
  before_count: number
  after_count: number
  removed_count: number
  efficiency_rate: number
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const timeframe = searchParams.get("timeframe") || "24h"
    const limit = parseInt(searchParams.get("limit") || "100")
    
    // Calculate time boundary based on timeframe
    const now = new Date()
    let timeBoundary: Date
    
    switch (timeframe) {
      case "1h":
        timeBoundary = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case "6h":
        timeBoundary = new Date(now.getTime() - 6 * 60 * 60 * 1000)
        break
      case "24h":
        timeBoundary = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case "7d":
        timeBoundary = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "30d":
        timeBoundary = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        timeBoundary = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }
    
    // Fetch deduplication metrics
    const { data: metrics, error: metricsError } = await supabaseAdmin
      .from('deduplication_metrics')
      .select('*')
      .gte('created_at', timeBoundary.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (metricsError) {
      console.error('Error fetching deduplication metrics:', metricsError)
      throw metricsError
    }
    
    if (!metrics || metrics.length === 0) {
      return NextResponse.json({
        summary: {
          totalSessions: 0,
          totalDuplicatesRemoved: 0,
          averageReductionRate: 0,
          totalCost: 0,
          averageProcessingTime: 0,
          errorRate: 0
        },
        timeSeries: [],
        sourceEfficiency: [],
        clusterAnalysis: {
          averageClusterSize: 0,
          largestClusterSeen: 0,
          totalClustersProcessed: 0
        },
        costBreakdown: {
          embeddingsCost: 0,
          nlpCost: 0,
          totalCost: 0,
          costPerDuplicate: 0
        },
        performanceMetrics: {
          averageEmbeddingsTime: 0,
          averageClusteringTime: 0,
          averageNlpTime: 0,
          averageTotalTime: 0
        },
        timeframe,
        dataPoints: 0
      })
    }
    
    // Calculate summary statistics
    const totalSessions = metrics.length
    const successfulSessions = metrics.filter(m => !m.error_occurred)
    const totalDuplicatesRemoved = metrics.reduce((sum, m) => sum + (m.duplicates_removed || 0), 0)
    const averageReductionRate = successfulSessions.length > 0
      ? successfulSessions.reduce((sum, m) => sum + (m.reduction_rate || 0), 0) / successfulSessions.length
      : 0
    const totalCost = metrics.reduce((sum, m) => sum + (m.total_cost || 0), 0)
    const averageProcessingTime = successfulSessions.length > 0
      ? successfulSessions.reduce((sum, m) => sum + (m.total_time_ms || 0), 0) / successfulSessions.length
      : 0
    const errorRate = totalSessions > 0 ? (metrics.filter(m => m.error_occurred).length / totalSessions) * 100 : 0
    
    // Process time series data
    const timeSeries: TimeSeriesData[] = metrics
      .filter(m => !m.error_occurred)
      .map(m => ({
        timestamp: m.created_at,
        duplicates_removed: m.duplicates_removed || 0,
        reduction_rate: m.reduction_rate || 0,
        total_cost: m.total_cost || 0
      }))
      .reverse() // Chronological order for charts
    
    // Analyze source efficiency
    const sourceMap = new Map<string, { before: number, after: number }>()
    
    metrics.forEach(m => {
      if (m.sources_before && m.sources_after) {
        Object.entries(m.sources_before as Record<string, number>).forEach(([source, count]) => {
          const existing = sourceMap.get(source) || { before: 0, after: 0 }
          existing.before += count
          sourceMap.set(source, existing)
        })
        
        Object.entries(m.sources_after as Record<string, number>).forEach(([source, count]) => {
          const existing = sourceMap.get(source) || { before: 0, after: 0 }
          existing.after += count
          sourceMap.set(source, existing)
        })
      }
    })
    
    const sourceEfficiency: SourceEfficiency[] = Array.from(sourceMap.entries())
      .map(([source, counts]) => ({
        source,
        before_count: counts.before,
        after_count: counts.after,
        removed_count: counts.before - counts.after,
        efficiency_rate: counts.before > 0 ? ((counts.before - counts.after) / counts.before) * 100 : 0
      }))
      .sort((a, b) => b.removed_count - a.removed_count)
      .slice(0, 10)
    
    // Cluster analysis
    const clusterAnalysis = {
      averageClusterSize: successfulSessions.length > 0
        ? successfulSessions.reduce((sum, m) => sum + (m.average_cluster_size || 0), 0) / successfulSessions.length
        : 0,
      largestClusterSeen: Math.max(...metrics.map(m => m.largest_cluster || 0), 0),
      totalClustersProcessed: metrics.reduce((sum, m) => sum + (m.cluster_count || 0), 0)
    }
    
    // Cost breakdown
    const costBreakdown = {
      embeddingsCost: metrics.reduce((sum, m) => sum + (m.embeddings_cost || 0), 0),
      nlpCost: metrics.reduce((sum, m) => sum + (m.nlp_cost || 0), 0),
      totalCost,
      costPerDuplicate: totalDuplicatesRemoved > 0 ? totalCost / totalDuplicatesRemoved : 0
    }
    
    // Performance metrics
    const performanceMetrics = {
      averageEmbeddingsTime: successfulSessions.length > 0
        ? successfulSessions.reduce((sum, m) => sum + (m.embeddings_time_ms || 0), 0) / successfulSessions.length
        : 0,
      averageClusteringTime: successfulSessions.length > 0
        ? successfulSessions.reduce((sum, m) => sum + (m.clustering_time_ms || 0), 0) / successfulSessions.length
        : 0,
      averageNlpTime: successfulSessions.length > 0
        ? successfulSessions.reduce((sum, m) => sum + (m.nlp_verification_time_ms || 0), 0) / successfulSessions.length
        : 0,
      averageTotalTime: averageProcessingTime
    }
    
    // NLP verification stats
    const nlpStats = {
      totalBorderlinePairs: metrics.reduce((sum, m) => sum + (m.borderline_pairs || 0), 0),
      totalVerifications: metrics.reduce((sum, m) => sum + (m.nlp_verifications || 0), 0),
      totalClustersMerged: metrics.reduce((sum, m) => sum + (m.clusters_merged || 0), 0),
      verificationRate: metrics.filter(m => m.borderline_pairs && m.borderline_pairs > 0).length / totalSessions * 100
    }
    
    return NextResponse.json({
      summary: {
        totalSessions,
        totalDuplicatesRemoved,
        averageReductionRate: Math.round(averageReductionRate * 100) / 100,
        totalCost: Math.round(totalCost * 1000000) / 1000000,
        averageProcessingTime: Math.round(averageProcessingTime),
        errorRate: Math.round(errorRate * 100) / 100
      },
      timeSeries,
      sourceEfficiency,
      clusterAnalysis: {
        averageClusterSize: Math.round(clusterAnalysis.averageClusterSize * 100) / 100,
        largestClusterSeen: clusterAnalysis.largestClusterSeen,
        totalClustersProcessed: clusterAnalysis.totalClustersProcessed
      },
      costBreakdown: {
        embeddingsCost: Math.round(costBreakdown.embeddingsCost * 1000000) / 1000000,
        nlpCost: Math.round(costBreakdown.nlpCost * 1000000) / 1000000,
        totalCost: Math.round(costBreakdown.totalCost * 1000000) / 1000000,
        costPerDuplicate: Math.round(costBreakdown.costPerDuplicate * 1000000) / 1000000
      },
      performanceMetrics: {
        averageEmbeddingsTime: Math.round(performanceMetrics.averageEmbeddingsTime),
        averageClusteringTime: Math.round(performanceMetrics.averageClusteringTime),
        averageNlpTime: Math.round(performanceMetrics.averageNlpTime),
        averageTotalTime: Math.round(performanceMetrics.averageTotalTime)
      },
      nlpStats,
      timeframe,
      dataPoints: metrics.length
    })
    
  } catch (error) {
    console.error("Error fetching deduplication metrics:", error)
    return NextResponse.json(
      { 
        error: "Failed to fetch deduplication metrics",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}