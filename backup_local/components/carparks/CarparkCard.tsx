import * as React from 'react';
import { MapPin, Calendar, Building, ParkingCircle } from 'lucide-react';
import { Price } from './Price';
import { deriveEstateLabel, districtLabel } from '../../utils/format';
import { getAllCarparkImages } from '../../utils/carpark-images-simple';

export interface CarparkCardProps {
  row: any;
}

export const CarparkCard: React.FC<CarparkCardProps> = ({ row }) => {
  const [imageError, setImageError] = React.useState(false);
  
  const estate = deriveEstateLabel(row);
  const price = <Price row={row} />;
  const district = districtLabel(row.district_norm);
  const subd = row.subdistrict_raw;
  const age = row.building_age != null ? `${row.building_age} yrs` : null;

  const href = row.detail_url ?? '#';
  
  // Get all available images (no filtering)
  const allImages = getAllCarparkImages(row);
  const images = allImages.length > 0 ? allImages : ['/placeholder-carpark.jpg'];
  
  // Default to last image (most recent/relevant)
  const [imageIndex, setImageIndex] = React.useState(images.length > 1 ? images.length - 1 : 0);
  
  // Reset to last image when row changes
  React.useEffect(() => {
    setImageIndex(images.length > 1 ? images.length - 1 : 0);
    setImageError(false);
  }, [row.listing_id, images.length]);
  
  // Navigation functions
  const nextImage = () => {
    if (images.length > 1) {
      setImageIndex(prev => (prev + 1) % images.length);
    }
  };
  
  const prevImage = () => {
    if (images.length > 1) {
      setImageIndex(prev => prev === 0 ? images.length - 1 : prev - 1);
    }
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-lg overflow-hidden bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md transition-all duration-200"
    >
      {/* Compact Image Section */}
      <div className="relative w-full aspect-[3/2] bg-neutral-100 dark:bg-neutral-800">
        {images.length > 0 && !imageError ? (
          <>
            <img
              src={images[imageIndex]}
              alt={estate}
              className="object-cover w-full h-full group-hover:scale-102 transition-transform duration-500"
              onError={() => setImageError(true)}
              loading="lazy"
            />
            
            {/* Parking Icon Overlay */}
            <div className="absolute top-2 left-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
              <ParkingCircle className="w-4 h-4 text-white" />
            </div>
            
            {/* Image Navigation - Mobile Optimized */}
            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); prevImage(); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
                  aria-label="Previous image"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); nextImage(); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
                  aria-label="Next image"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                
                {/* Compact Image Counter */}
                <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                  {imageIndex + 1}/{images.length}
                </div>
                
                {/* Bottom Image Indicators */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, index) => (
                    <div
                      key={index}
                      className={`w-1 h-1 rounded-full transition-all duration-200 ${
                        index === imageIndex ? 'bg-white' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
            <ParkingCircle className="w-8 h-8 text-neutral-400" />
          </div>
        )}
      </div>
      
      {/* Compact Info Section */}
      <div className="p-3 space-y-2">
        {/* Title and Price Row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-1 leading-tight">
            {estate}
          </h3>
          <div className="flex-shrink-0 text-sm font-bold text-blue-600 dark:text-blue-400">
            {price}
          </div>
        </div>
        
        {/* Location Info */}
        <div className="flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="line-clamp-1">
            {district}{subd && ` • ${subd}`}
          </span>
        </div>
        
        {/* Building Age */}
        {age && (
          <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-500">
            <Building className="w-3 h-3 flex-shrink-0" />
            <span>{age}</span>
          </div>
        )}
      </div>
    </a>
  );
};