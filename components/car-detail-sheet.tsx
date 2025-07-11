"use client"

import { useState } from "react"
import { ExternalLink, Zap, Fuel, Calendar, DollarSign, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"
import { cn } from "@/lib/utils"
import { useEffect } from "react"

interface CarDetailSheetProps {
  car: any
}

export default function CarDetailSheet({ car }: CarDetailSheetProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  // Parse car specifications from content
  const parseCarSpecs = (content: string) => {
    const specs: Record<string, string> = {}
    if (!content) return specs
    
    let tempContent = content
    
    // Find all instances of numbers with commas
    // Updated regex to handle multi-comma numbers like 2,450,001
    const numberWithCommasRegex = /(\d{1,3}(?:,\d{3})*)/g
    const numbersWithCommas = tempContent.match(numberWithCommasRegex) || []
    
    // Replace each number with commas with a placeholder
    numbersWithCommas.forEach((num, index) => {
      tempContent = tempContent.replace(num, `###NUMBER_${index}###`)
    })
    
    // Split by comma
    const pairs = tempContent.split(',').map(pair => pair.trim())
    
    for (const pair of pairs) {
      const colonIndex = pair.indexOf(':')
      if (colonIndex === -1) continue
      
      const key = pair.substring(0, colonIndex).trim()
      let value = pair.substring(colonIndex + 1).trim()
      
      // Restore numbers with commas
      numbersWithCommas.forEach((num, index) => {
        value = value.replace(`###NUMBER_${index}###`, num)
      })
      
      if (key && value) {
        const lowerKey = key.toLowerCase()
        
        if (lowerKey === 'engine') specs.engine = value
        else if (lowerKey === 'transmission') specs.transmission = value
        else if (lowerKey === 'fuel') specs.fuel = value
        else if (lowerKey === 'mileage') specs.mileage = value
        else if (lowerKey === 'year') specs.year = value
        else if (lowerKey === 'make') specs.make = value
        else if (lowerKey === 'model') specs.model = value
        else if (lowerKey === 'price') specs.price = value
        else if (lowerKey === 'doors') specs.doors = value
        else if (lowerKey === 'color') specs.color = value
      }
    }
    
    return specs
  }

  // Parse enriched data from ai_summary
  const parseEnrichmentData = (aiSummary: string) => {
    if (!aiSummary) return null
    
    console.log('Parsing AI Summary:', aiSummary)
    const data: any = {}
    
    // Parse estimated year
    const yearMatch = aiSummary.match(/\*\*Estimated Year:\*\* (\d+)/)
    if (yearMatch) data.estimatedYear = parseInt(yearMatch[1])
    
    // Parse vehicle type
    const typeMatch = aiSummary.match(/\*\*Vehicle Type:\*\* (.+?)(?=\*\*|$)/s)
    if (typeMatch) data.isElectric = typeMatch[1].trim().includes('Electric')
    
    // Parse fuel consumption
    const fuelMatch = aiSummary.match(/\*\*Fuel Consumption:\*\* (.+?)(?=\*\*|$)/s)
    if (fuelMatch) data.fuelConsumption = fuelMatch[1].trim()
    
    // Parse fuel cost
    const costMatch = aiSummary.match(/\*\*Estimated Monthly Fuel Cost:\*\* (.+?)(?=\*\*|$)/s)
    if (costMatch) data.fuelCost = costMatch[1].trim()
    
    // Parse faults - improved to handle the actual format
    const faultsMatch = aiSummary.match(/\*\*Things to Look Out For:\*\*\s*((?:• .+?(?=•|$))+)/s)
    if (faultsMatch) {
      const faultsText = faultsMatch[1]
      // Split by bullet points and clean up
      const faultLines = faultsText.split('•').filter(line => line.trim())
      data.faults = faultLines.map(line => {
        // Remove markdown formatting and clean up
        return line.replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/\[\d+\]/g, '') // Remove citation numbers
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim()
      }).filter(line => line.length > 0)
    }
    
    console.log('Parsed enrichment data:', data)
    
    return data
  }

  const formatPrice = (price: string) => {
    if (!price) return 'Price not available'
    return price
      .replace(/HKD\$/, 'HK$')
      .replace(/減價.*$/, '')
      .trim()
  }

  const carSpecs = parseCarSpecs(car.content || '')
  const enrichmentData = parseEnrichmentData(car.ai_summary || '')
  const priceFromContent = carSpecs.price || car.price || ''
  const isOnSale = priceFromContent.includes('減價')
  const images = car.images || (car.imageUrl ? [car.imageUrl] : [])
  
  // Sync carousel with selected index
  useEffect(() => {
    if (!carouselApi) return
    
    carouselApi.on("select", () => {
      setSelectedImageIndex(carouselApi.selectedScrollSnap())
    })
  }, [carouselApi])

  return (
    <article className="px-6 pt-4 pb-8">
      <div className="space-y-6">
        {/* Car Image Gallery */}
        {images.length > 0 && (
          <div className="relative">
            {images.length === 1 ? (
              // Single image
              <div className="aspect-[16/10] bg-surface rounded-lg overflow-hidden">
                <img
                  src={images[0]}
                  alt={car.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              // Multiple images - use carousel
              <Carousel className="w-full" setApi={setCarouselApi}>
                <CarouselContent data-carousel-content>
                  {images.map((image, index) => (
                    <CarouselItem key={index}>
                      <div className="aspect-[16/10] bg-surface rounded-lg overflow-hidden">
                        <img
                          src={image}
                          alt={`${car.title} - Image ${index + 1}`}
                          className="w-full h-full object-cover"
                          loading={index === 0 ? "eager" : "lazy"}
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="left-2" />
                <CarouselNext className="right-2" />
              </Carousel>
            )}
            
            {/* Image counter overlay */}
            {images.length > 1 && (
              <div className="absolute top-3 right-3 bg-black/60 text-white px-2 py-1 rounded-full text-xs font-medium pointer-events-none">
                {images.length} photos
              </div>
            )}
            
            {/* Thumbnail strip for multiple images */}
            {images.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                {images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSelectedImageIndex(index)
                      // Use carousel API to scroll to image
                      if (carouselApi) {
                        carouselApi.scrollTo(index)
                      }
                    }}
                    className={cn(
                      "relative flex-shrink-0 w-20 h-14 rounded-md overflow-hidden transition-all",
                      selectedImageIndex === index
                        ? "ring-2 ring-primary"
                        : "opacity-70 hover:opacity-100"
                    )}
                  >
                    <img
                      src={image}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Car Title and Price */}
        <header className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
            {car.title}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-xl font-bold text-foreground">
              {formatPrice(priceFromContent)}
            </div>
            {isOnSale && (
              <Badge variant="secondary" className="bg-stone-600 text-white">
                Price Reduced
              </Badge>
            )}
            {enrichmentData?.isElectric && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Electric
              </Badge>
            )}
          </div>
        </header>

        {/* Car Specifications */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              {carSpecs.year && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Year</div>
                  <div className="text-sm">{carSpecs.year}</div>
                </div>
              )}
              {carSpecs.make && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Make</div>
                  <div className="text-sm">{carSpecs.make}</div>
                </div>
              )}
              {carSpecs.model && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Model</div>
                  <div className="text-sm">{carSpecs.model}</div>
                </div>
              )}
              {carSpecs.engine && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Engine</div>
                  <div className="text-sm">{carSpecs.engine}</div>
                </div>
              )}
              {carSpecs.transmission && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Transmission</div>
                  <div className="text-sm">{carSpecs.transmission}</div>
                </div>
              )}
              {carSpecs.fuel && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Fuel</div>
                  <div className="text-sm">{carSpecs.fuel}</div>
                </div>
              )}
              {carSpecs.mileage && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Mileage</div>
                  <div className="text-sm">{carSpecs.mileage}</div>
                </div>
              )}
              {carSpecs.color && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Color</div>
                  <div className="text-sm">{carSpecs.color}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Enriched Data */}
        {enrichmentData && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              {/* Estimated Year */}
              {enrichmentData.estimatedYear && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Estimated Year:</span>
                  <span className="text-sm">{enrichmentData.estimatedYear}</span>
                </div>
              )}

              {/* Fuel Information */}
              {enrichmentData.fuelConsumption && (
                <div className="flex items-center gap-2">
                  <Fuel className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Fuel Consumption:</span>
                  <span className="text-sm">{enrichmentData.fuelConsumption}</span>
                </div>
              )}

              {/* Fuel Cost */}
              {enrichmentData.fuelCost && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Monthly Fuel Cost:</span>
                  <span className="text-sm">{enrichmentData.fuelCost}</span>
                </div>
              )}

              {/* Things to Look Out For */}
              {enrichmentData.faults && enrichmentData.faults.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <span className="text-base">👀</span>
                    Things to Look Out For
                  </h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {enrichmentData.faults.map((fault: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-muted-foreground mt-1 text-xs">•</span>
                        <span>{fault}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Source Information */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium">Source</div>
                <div className="text-sm text-muted-foreground">{car.source}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">Published</div>
                <div className="text-sm text-muted-foreground">
                  {new Date(car.publishedAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Original Button */}
      <footer className="mt-8 pt-6 border-t border-border">
        <Button
          onClick={() => window.open(car.url, '_blank')}
          className="w-full flex items-center gap-2"
          size="lg"
        >
          <ExternalLink className="h-4 w-4" />
          View Original Listing
        </Button>
      </footer>
    </article>
  )
}