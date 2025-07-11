import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { carEnricher } from '@/lib/car-enrichment'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('🚗 Starting car enrichment cron job...')
    
    // Check if Perplexity API is configured
    if (!carEnricher.isConfigured()) {
      console.log('❌ Perplexity API not configured, skipping car enrichment')
      return NextResponse.json({
        success: false,
        error: 'Perplexity API not configured',
        timestamp: new Date().toISOString()
      })
    }

    // Get cars that haven't been enriched yet (limit to 5 per run to control costs)
    const { data: cars, error } = await supabase
      .from('articles')
      .select('id, title, content, ai_summary, created_at')
      .eq('category', 'cars')
      .eq('source', '28car')
      .is('ai_summary', null) // Only cars not yet enriched
      .order('created_at', { ascending: false }) // Process newest first
      .limit(5)

    if (error) {
      console.error('❌ Error fetching cars for enrichment:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch cars',
        timestamp: new Date().toISOString()
      })
    }

    if (!cars || cars.length === 0) {
      console.log('✅ No cars found that need enrichment')
      return NextResponse.json({
        success: true,
        message: 'No cars need enrichment',
        enrichedCount: 0,
        timestamp: new Date().toISOString()
      })
    }

    console.log(`📊 Found ${cars.length} cars to enrich`)

    let enrichedCount = 0
    const errors: string[] = []

    for (const car of cars) {
      try {
        console.log(`🔄 Enriching car: ${car.title}`)
        
        const specs = carEnricher.parseCarSpecs(car.content || '')
        const enrichment = await carEnricher.enrichCar(
          car.title,
          car.content || '',
          specs
        )

        // Create enrichment summary
        const enrichmentSummary = createEnrichmentSummary(enrichment)

        // Update car with enrichment data
        const { error: updateError } = await supabase
          .from('articles')
          .update({
            ai_summary: enrichmentSummary,
            updated_at: new Date().toISOString()
          })
          .eq('id', car.id)

        if (updateError) {
          console.error(`❌ Error updating car ${car.id}:`, updateError)
          errors.push(`Failed to update car ${car.title}`)
        } else {
          enrichedCount++
          console.log(`✅ Successfully enriched: ${car.title}`)
          console.log(`💰 Estimated cost: ${enrichment.enrichmentCost}`)
        }

        // Rate limiting - wait 3 seconds between requests to avoid API limits
        await new Promise(resolve => setTimeout(resolve, 3000))
      } catch (error) {
        console.error(`❌ Error enriching car ${car.id}:`, error)
        errors.push(`Failed to enrich car ${car.title}: ${error}`)
      }
    }

    console.log(`🎉 Car enrichment completed. Enriched: ${enrichedCount}/${cars.length}`)

    return NextResponse.json({
      success: true,
      message: `Successfully enriched ${enrichedCount} cars`,
      enrichedCount,
      totalProcessed: cars.length,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error in car enrichment cron job:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    })
  }
}

function createEnrichmentSummary(enrichment: any): string {
  const parts: string[] = []
  
  // Add estimated year if available
  if (enrichment.estimatedYear) {
    parts.push(`**Estimated Year:** ${enrichment.estimatedYear}`)
  }
  
  // Add vehicle type
  if (enrichment.isElectric) {
    parts.push(`**Vehicle Type:** Electric`)
  } else {
    parts.push(`**Vehicle Type:** Conventional Fuel`)
  }
  
  // Add fuel consumption
  if (enrichment.fuelConsumption) {
    parts.push(`**Fuel Consumption:** ${enrichment.fuelConsumption}`)
  }
  
  // Add fuel cost
  if (enrichment.fuelCostHKD) {
    parts.push(`**Estimated Monthly Fuel Cost:** ${enrichment.fuelCostHKD}`)
  }
  
  // Add things to look out for
  if (enrichment.faults && enrichment.faults.length > 0) {
    parts.push(`**Things to Look Out For:**`)
    enrichment.faults.forEach((fault: string) => {
      parts.push(`• ${fault}`)
    })
  }
  
  return parts.join('\n')
}