import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { carEnricher } from '@/lib/car-enrichment'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { carId, enrichAll } = await request.json()
    
    if (!carEnricher.isConfigured()) {
      return NextResponse.json(
        { error: 'Perplexity API key not configured' },
        { status: 500 }
      )
    }

    if (enrichAll) {
      // Enrich all cars that haven't been enriched yet
      const { data: cars, error } = await supabase
        .from('articles')
        .select('id, title, content, ai_summary')
        .eq('category', 'cars')
        .eq('source', '28car')
        .is('ai_summary', null) // Only cars not yet enriched
        .limit(10) // Process in batches to avoid timeouts

      if (error) {
        console.error('Error fetching cars for enrichment:', error)
        return NextResponse.json(
          { error: 'Failed to fetch cars' },
          { status: 500 }
        )
      }

      if (!cars || cars.length === 0) {
        return NextResponse.json({
          message: 'No cars found that need enrichment',
          enrichedCount: 0
        })
      }

      let enrichedCount = 0
      const errors: string[] = []

      for (const car of cars) {
        try {
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
            console.error(`Error updating car ${car.id}:`, updateError)
            errors.push(`Failed to update car ${car.title}`)
          } else {
            enrichedCount++
            console.log(`Successfully enriched car: ${car.title}`)
          }

          // Rate limiting - wait between requests
          await new Promise(resolve => setTimeout(resolve, 2000))
        } catch (error) {
          console.error(`Error enriching car ${car.id}:`, error)
          errors.push(`Failed to enrich car ${car.title}: ${error}`)
        }
      }

      return NextResponse.json({
        message: `Successfully enriched ${enrichedCount} cars`,
        enrichedCount,
        errors: errors.length > 0 ? errors : undefined
      })
    } else if (carId) {
      // Enrich specific car
      const { data: car, error } = await supabase
        .from('articles')
        .select('id, title, content, ai_summary')
        .eq('id', carId)
        .eq('category', 'cars')
        .single()

      if (error || !car) {
        return NextResponse.json(
          { error: 'Car not found' },
          { status: 404 }
        )
      }

      try {
        const specs = carEnricher.parseCarSpecs(car.content || '')
        const enrichment = await carEnricher.enrichCar(
          car.title,
          car.content || '',
          specs
        )

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
          console.error('Error updating car:', updateError)
          return NextResponse.json(
            { error: 'Failed to update car with enrichment data' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          message: 'Car enriched successfully',
          enrichment: enrichment,
          cost: enrichment.enrichmentCost
        })
      } catch (error) {
        console.error('Error enriching car:', error)
        return NextResponse.json(
          { error: `Failed to enrich car: ${error}` },
          { status: 500 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Either carId or enrichAll must be provided' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error in car enrichment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
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

// GET endpoint to check enrichment status
export async function GET() {
  try {
    const { count: totalCars, error: totalError } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'cars')
      .eq('source', '28car')
    
    const { count: enrichedCars, error: enrichedError } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'cars')
      .eq('source', '28car')
      .not('ai_summary', 'is', null)

    if (totalError || enrichedError) {
      console.error('Error fetching enrichment status:', totalError || enrichedError)
      return NextResponse.json(
        { error: 'Failed to fetch enrichment status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      totalCars: totalCars || 0,
      enrichedCars: enrichedCars || 0,
      unenrichedCars: (totalCars || 0) - (enrichedCars || 0),
      isConfigured: carEnricher.isConfigured()
    })
  } catch (error) {
    console.error('Error checking enrichment status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}