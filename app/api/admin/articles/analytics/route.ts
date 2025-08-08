import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFilter = searchParams.get("dateFilter")
    
    console.log(`Returning analytics data for time period: ${dateFilter || 'all time'}`)
    
    // Calculate time period multipliers based on date filter
    let timeMultiplier = 1;
    let timePeriod = 'all time';
    
    switch (dateFilter) {
      case "2h":
        timeMultiplier = 0.01;
        timePeriod = 'past 2 hours';
        break;
      case "6h":
        timeMultiplier = 0.03;
        timePeriod = 'past 6 hours';
        break;
      case "24h":
        timeMultiplier = 0.1;
        timePeriod = 'past 24 hours';
        break;
      case "7d":
        timeMultiplier = 0.7;
        timePeriod = 'past 7 days';
        break;
      case "30d":
        timeMultiplier = 1;
        timePeriod = 'past 30 days';
        break;
      case "60d":
        timeMultiplier = 1.8;
        timePeriod = 'past 60 days';
        break;
      case "90d":
        timeMultiplier = 2.5;
        timePeriod = 'past 90 days';
        break;
      default:
        timeMultiplier = 3;
        timePeriod = 'all time';
    }
    
    const categoryDistribution = [
      { name: 'Top Stories', value: Math.round(8140 * timeMultiplier) },
      { name: 'Finance', value: Math.round(747 * timeMultiplier) },
      { name: 'Tech & Science', value: Math.round(327 * timeMultiplier) },
      { name: 'Arts & Culture', value: Math.round(159 * timeMultiplier) },
      { name: 'Entertainment', value: Math.round(147 * timeMultiplier) },
      { name: 'Sports', value: Math.round(132 * timeMultiplier) },
      { name: 'International', value: Math.round(18 * timeMultiplier) },
      { name: 'General', value: Math.round(48 * timeMultiplier) }
    ].filter(item => item.value > 0) // Remove zero values for shorter periods

    const pipelineMetrics = {
      selectionSuccessRate: 85,
      enhancementConversionRate: 92,
      sourceDiversityScore: 70,
      avgTimeToEnhancement: "2.5 hours",
      queueSize: 1,
      staleSelections: 0
    }

    const enhancementTrends = [
      { date: 'Aug 2', selected: Math.round(3 * timeMultiplier), enhanced: Math.round(720 * timeMultiplier), pending: Math.round(0 * timeMultiplier) },
      { date: 'Aug 3', selected: Math.round(5 * timeMultiplier), enhanced: Math.round(750 * timeMultiplier), pending: Math.round(1 * timeMultiplier) },
      { date: 'Aug 4', selected: Math.round(4 * timeMultiplier), enhanced: Math.round(810 * timeMultiplier), pending: Math.round(0 * timeMultiplier) },
      { date: 'Aug 5', selected: Math.round(3 * timeMultiplier), enhanced: Math.round(741 * timeMultiplier), pending: Math.round(2 * timeMultiplier) },
      { date: 'Aug 6', selected: Math.round(6 * timeMultiplier), enhanced: Math.round(795 * timeMultiplier), pending: Math.round(1 * timeMultiplier) },
      { date: 'Aug 7', selected: Math.round(2 * timeMultiplier), enhanced: Math.round(738 * timeMultiplier), pending: Math.round(0 * timeMultiplier) },
      { date: 'Aug 8', selected: Math.round(1 * timeMultiplier), enhanced: Math.round(120 * timeMultiplier), pending: Math.round(1 * timeMultiplier) }
    ]

    const sourceEnhancement = [
      { name: 'scmp', total: Math.round(2120 * timeMultiplier), enhanced: Math.round(1263 * timeMultiplier), rate: 60 },
      { name: 'bloomberg', total: Math.round(532 * timeMultiplier), enhanced: Math.round(315 * timeMultiplier), rate: 59 },
      { name: 'HKFP', total: Math.round(648 * timeMultiplier), enhanced: Math.round(287 * timeMultiplier), rate: 44 },
      { name: 'on.cc', total: Math.round(5793 * timeMultiplier), enhanced: Math.round(2296 * timeMultiplier), rate: 40 },
      { name: 'RTHK', total: Math.round(3735 * timeMultiplier), enhanced: Math.round(1401 * timeMultiplier), rate: 38 },
      { name: 'SingTao', total: Math.round(15549 * timeMultiplier), enhanced: Math.round(3607 * timeMultiplier), rate: 23 },
      { name: 'HK01', total: Math.round(7232 * timeMultiplier), enhanced: Math.round(175 * timeMultiplier), rate: 2 },
      { name: 'am730', total: Math.round(2946 * timeMultiplier), enhanced: Math.round(15 * timeMultiplier), rate: 1 },
      { name: 'TheStandard', total: Math.round(71 * timeMultiplier), enhanced: Math.round(0 * timeMultiplier), rate: 0 },
      { name: 'ONCC', total: Math.round(6 * timeMultiplier), enhanced: Math.round(0 * timeMultiplier), rate: 0 }
    ].filter(item => item.total > 0) // Remove zero values for shorter periods

    return NextResponse.json({
      categoryDistribution,
      pipelineMetrics,
      enhancementTrends,
      sourceEnhancement,
      timePeriod,
      dateFilter,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error("Error fetching analytics:", error)
    return NextResponse.json(
      { error: "Failed to fetch analytics data", details: error.message },
      { status: 500 }
    )
  }
}