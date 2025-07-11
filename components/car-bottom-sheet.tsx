"use client"

import * as React from "react"
import { X, ExternalLink, Car, Zap, Fuel, Clock, AlertTriangle, Calendar, DollarSign } from "lucide-react"
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription, 
  DrawerClose 
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import ShareButton from "./share-button"

interface CarBottomSheetProps {
  car: any | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function CarBottomSheet({ 
  car, 
  open, 
  onOpenChange 
}: CarBottomSheetProps) {
  // Freeze body scrolling while drawer is open to prevent bounce
  React.useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  if (!car) return null

  // Parse car specifications from content
  const parseCarSpecs = (content: string) => {
    const specs: Record<string, string> = {}
    if (!content) return specs
    
    let tempContent = content
    
    // Find all instances of numbers with commas
    const numberWithCommasRegex = /(\d+,\d+)/g
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
    
    const data: any = {}
    
    // Parse estimated year
    const yearMatch = aiSummary.match(/\*\*Estimated Year:\*\* (\d+)/)
    if (yearMatch) data.estimatedYear = parseInt(yearMatch[1])
    
    // Parse vehicle type
    const typeMatch = aiSummary.match(/\*\*Vehicle Type:\*\* (.+)/)
    if (typeMatch) data.isElectric = typeMatch[1].includes('Electric')
    
    // Parse fuel consumption
    const fuelMatch = aiSummary.match(/\*\*Fuel Consumption:\*\* (.+)/)
    if (fuelMatch) data.fuelConsumption = fuelMatch[1]
    
    // Parse fuel cost
    const costMatch = aiSummary.match(/\*\*Estimated Monthly Fuel Cost:\*\* (.+)/)
    if (costMatch) data.fuelCost = costMatch[1]
    
    // Parse faults
    const faultsMatch = aiSummary.match(/\*\*Things to Look Out For:\*\*\n((?:• .+\n?)+)/)
    if (faultsMatch) {
      data.faults = faultsMatch[1].split('\n').filter(line => line.trim()).map(line => line.replace('• ', ''))
    }
    
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

  return (
    <Drawer 
      open={open} 
      onOpenChange={onOpenChange}
      shouldScaleBackground={true}
    >
      <DrawerContent 
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[12px] border bg-background overflow-y-auto",
          "focus:outline-none [&>div:first-child]:mt-2"
        )}
        style={{
          maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - 8px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          marginTop: "8px"
        }}
      >
        {/* Header with close button and share button */}
        <div className="relative px-6 pt-4 pb-8 shrink-0">
          <DrawerClose asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-6 top-4 h-10 w-10 p-0 hover:bg-muted"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DrawerClose>
          
          <div className="absolute right-6 top-4">
            <ShareButton 
              articleId={car.id} 
              compact={true}
            />
          </div>
        </div>
        
        {/* Hidden accessibility elements */}
        <DrawerTitle className="sr-only">Car Details</DrawerTitle>
        <DrawerDescription className="sr-only">
          Full car details and specifications
        </DrawerDescription>

        {/* Car content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-8">
          <div className="space-y-6">
            {/* Car Image */}
            {images.length > 0 && (
              <div className="aspect-[16/10] bg-surface rounded-lg overflow-hidden">
                <img
                  src={images[0]}
                  alt={car.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Car Title and Price */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground leading-tight">
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
            </div>

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
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    AI Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Things to Look Out For
                      </h4>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {enrichmentData.faults.map((fault: string, index: number) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-amber-500 mt-1 text-xs">•</span>
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

            {/* View Original Button */}
            <Button
              onClick={() => window.open(car.url, '_blank')}
              className="w-full flex items-center gap-2"
              size="lg"
            >
              <ExternalLink className="h-4 w-4" />
              View Original Listing
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}