import { Suspense } from "react"
import type { Metadata } from "next"
import BackButton from "@/components/back-button"
import ShareButton from "@/components/share-button"
import LoadingSkeleton from "@/components/loading-skeleton"
import CarDetailSheet from "@/components/car-detail-sheet"
import { supabase } from "@/lib/supabase"

// Share button component that fetches car data
async function CarShareButton({ carId }: { carId: string }) {
  const car = await getCarById(carId)
  
  return (
    <ShareButton 
      articleId={carId} 
      car={car} 
      title="" 
      url="" 
    />
  )
}

interface CarPageProps {
  params: {
    id: string
  }
}

// Function to get car by ID
async function getCarById(id: string) {
  try {
    console.log(`🔍 Car Detail: Fetching car with ID: ${id}`)
    
    // Try unified table first (preferred for new system)
    try {
      const { data: unifiedCar, error: unifiedError } = await supabase
        .from('articles_unified')
        .select('*')
        .eq('id', id)
        .eq('category', 'cars')
        .single()

      if (!unifiedError && unifiedCar) {
        console.log(`✅ Found car in articles_unified: ${unifiedCar.title}`)
        // Transform unified car data to match expected format
        return {
          ...unifiedCar,
          publishedAt: unifiedCar.published_at,
          imageUrl: unifiedCar.image_url,
          images: unifiedCar.images || (unifiedCar.image_url ? [unifiedCar.image_url] : []),
          specs: unifiedCar.contextual_data?.specs || {},
          make: unifiedCar.contextual_data?.make,
          model: unifiedCar.contextual_data?.model,
          year: unifiedCar.contextual_data?.year,
          price: unifiedCar.contextual_data?.price,
        }
      }
    } catch (error) {
      console.log(`⚠️ articles_unified failed for ${id}, trying articles table`)
    }

    // Fall back to old articles table
    const { data: car, error } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .eq('category', 'cars')
      .single()

    if (error) {
      console.error("Error fetching car from articles table:", error)
      return null
    }

    if (car) {
      console.log(`✅ Found car in articles table: ${car.title}`)
      // Transform old car data to match expected format
      return {
        ...car,
        publishedAt: car.created_at,
        imageUrl: car.image_url,
        images: car.image_url ? [car.image_url] : [],
      }
    }

    return null
  } catch (error) {
    console.error("Error in getCarById:", error)
    return null
  }
}

// Generate dynamic metadata for social sharing
export async function generateMetadata({ params }: CarPageProps): Promise<Metadata> {
  try {
    const car = await getCarById(params.id)
    
    if (!car) {
      return {
        title: "Car Not Found - HKI Cars",
        description: "The requested car listing could not be found."
      }
    }

    const title = car.title || "Car Listing"
    const price = car.specs?.price || car.price || ""
    const year = car.specs?.year || car.year || ""
    const make = car.specs?.make || car.make || ""
    const model = car.specs?.model || car.model || ""
    
    const description = `${title}${price ? ` - ${price}` : ''}${year ? ` (${year})` : ''}. View detailed specs, photos and more on HKI Cars.`
    
    // Use the first image from images array or fallback
    let imageUrl = "/hki-logo-black.png"
    if (car.images && Array.isArray(car.images) && car.images.length > 0) {
      imageUrl = car.images[0]
    } else if (car.image_url) {
      imageUrl = car.image_url
    }
    
    const url = `https://hki.zone/cars/${params.id}`
    
    return {
      title: `${title} - HKI Cars`,
      description: description.length > 160 ? description.substring(0, 157) + "..." : description,
      keywords: [
        "Hong Kong cars",
        "car listings",
        "automotive",
        "vehicles",
        "28car",
        make,
        model,
        year,
        "汽車",
        "香港汽車"
      ].filter(Boolean).join(", "),
      openGraph: {
        title: `${title} - HKI Cars`,
        description,
        url,
        siteName: "HKI Cars",
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: title,
          }
        ],
        locale: "en_HK",
        type: "article",
        publishedTime: car.published_at || car.created_at,
        modifiedTime: car.updated_at,
        section: "Cars",
        tags: [
          "Hong Kong",
          "cars",
          "automotive",
          make,
          model,
          year
        ].filter(Boolean)
      },
      twitter: {
        card: "summary_large_image",
        title: `${title} - HKI Cars`,
        description,
        images: [imageUrl],
        creator: "@hki_zone",
        site: "@hki_zone"
      },
      other: {
        // WhatsApp specific tags
        "og:image:width": "1200",
        "og:image:height": "630",
        "og:image:type": "image/jpeg",
        "og:image:alt": title,
      },
      alternates: {
        canonical: url
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-video-preview": -1,
          "max-image-preview": "large",
          "max-snippet": -1,
        }
      }
    }
  } catch (error) {
    console.error("Error generating metadata:", error)
    return {
      title: "HKI Cars - Hong Kong Car Listings",
      description: "Browse the latest car listings from Hong Kong"
    }
  }
}

async function CarPageContent({ carId }: { carId: string }) {
  const car = await getCarById(carId)
  
  if (!car) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
          Car Not Found
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 text-center">
          The car listing you're looking for doesn't exist or has been removed.
        </p>
      </div>
    )
  }
  
  return (
    <div className="max-w-4xl mx-auto p-4">
      <CarDetailSheet car={car} />
    </div>
  )
}

export default function CarPage({ params }: CarPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="flex items-center justify-between p-4">
          <BackButton />
          <Suspense fallback={<div className="w-10 h-10" />}>
            <CarShareButton carId={params.id} />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <CarPageContent carId={params.id} />
      </Suspense>
    </div>
  )
}