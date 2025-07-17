# Car Park Listing Feed Implementation

## Overview

The Car Park Listing Feed is a comprehensive component system that provides users with a mobile-optimized browsing experience for parking spaces in Hong Kong. It integrates seamlessly with the existing cars page through a category selector, allowing users to toggle between car listings and car park listings.

## Architecture

### High-Level Component Structure

```
cars/page.tsx
├── CarsPageWithSelector
    ├── CategorySelector (toggle between cars/carparks)
    ├── CarsFeedWithSearch (when category = 'cars')
    └── CarparkFeed (when category = 'carparks')
        ├── DistrictFilter
        ├── CarparkCard (grid layout)
        └── Infinite scroll loading
```

### Key Components

#### 1. **CarsPageWithSelector** (`/components/cars-page-with-selector.tsx`)
- **Purpose**: Main container component that manages category switching
- **State Management**: Handles category selection between 'cars' and 'carparks'
- **Layout**: Provides consistent padding and container structure

```typescript
export default function CarsPageWithSelector() {
  const [category, setCategory] = React.useState<CategoryType>('cars');
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="pt-16 pb-2">
        <CategorySelector value={category} onChange={setCategory} />
      </div>
      
      {category === 'cars' ? (
        <CarsFeedWithSearch />
      ) : (
        <CarparkFeed />
      )}
    </div>
  );
}
```

#### 2. **CategorySelector** (`/components/category-selector.tsx`)
- **Purpose**: Toggle component for switching between cars and car parks
- **Design**: iOS-style segmented control with icons
- **Icons**: Car icon for cars, ParkingCircle icon for car parks

```typescript
export const CategorySelector: React.FC<CategorySelectorProps> = ({ value, onChange }) => {
  return (
    <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1 mb-6">
      <button
        onClick={() => onChange('cars')}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          value === 'cars'
            ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
        }`}
      >
        <Car className="w-4 h-4" />
        Cars
      </button>
      <button
        onClick={() => onChange('carparks')}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          value === 'carparks'
            ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
        }`}
      >
        <ParkingCircle className="w-4 h-4" />
        Car Parks
      </button>
    </div>
  );
};
```

#### 3. **CarparkFeed** (`/components/carparks/CarparkFeed.tsx`)
- **Purpose**: Main feed component for car park listings
- **Features**: District filtering, infinite scroll, responsive grid layout
- **Data Source**: Uses custom hook `useCarparkListings`

```typescript
export const CarparkFeed: React.FC<CarparkFeedProps> = ({ initialDistrict = 'ALL', pageSize = 20 }) => {
  const [district, setDistrict] = React.useState<DistrictKey>(initialDistrict);
  const { items, loading, error, done, loadMore } = useCarparkListings({ district, pageSize });

  return (
    <div className="space-y-6">
      <DistrictFilter value={district} onChange={setDistrict} />
      
      {/* Grid Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {items.map((carpark) => (
          <CarparkCard key={carpark.id} carpark={carpark} />
        ))}
      </div>
      
      {/* Infinite Scroll Trigger */}
      {!done && <InfiniteScrollTrigger onLoadMore={loadMore} loading={loading} />}
    </div>
  );
};
```

#### 4. **CarparkCard** (`/components/carparks/CarparkCard.tsx`)
- **Purpose**: Individual car park listing card
- **Design**: Mobile-optimized with 3:2 aspect ratio
- **Features**: Image carousel, pricing, location, amenities

```typescript
export const CarparkCard: React.FC<CarparkCardProps> = ({ carpark }) => {
  const [imageIndex, setImageIndex] = React.useState(images.length > 1 ? images.length - 1 : 0);
  
  return (
    <article className="group relative bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md transition-all duration-200">
      {/* Image Section with 3:2 Aspect Ratio */}
      <div className="relative aspect-[3/2] overflow-hidden">
        <img src={images[imageIndex]} alt={carpark.title} className="w-full h-full object-cover" />
        
        {/* Blue Parking Icon Overlay */}
        <div className="absolute top-2 left-2 bg-blue-500 text-white rounded-full p-1.5">
          <ParkingCircle className="w-3 h-3" />
        </div>
        
        {/* Image Navigation */}
        {images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setImageIndex(index)}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                  index === imageIndex ? 'bg-white' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Content Section */}
      <div className="p-3 space-y-2">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-2">
          {carpark.title}
        </h3>
        
        <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
          <MapPin className="w-3 h-3" />
          <span className="line-clamp-1">{carpark.location}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
            {carpark.price}
          </div>
          <div className="text-xs text-neutral-500">
            {carpark.availableSpaces} spaces
          </div>
        </div>
      </div>
    </article>
  );
};
```

#### 5. **DistrictFilter** (`/components/carparks/DistrictFilter.tsx`)
- **Purpose**: Filter car parks by Hong Kong districts
- **Design**: Horizontal scrollable filter bar
- **Districts**: All major Hong Kong districts (Central, Tsim Sha Tsui, Causeway Bay, etc.)

```typescript
export const DistrictFilter: React.FC<DistrictFilterProps> = ({ value, onChange }) => {
  return (
    <div className="flex overflow-x-auto gap-2 pb-2">
      {DISTRICTS.map((district) => (
        <button
          key={district.key}
          onClick={() => onChange(district.key)}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            value === district.key
              ? 'bg-blue-500 text-white'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          {district.label}
        </button>
      ))}
    </div>
  );
};
```

## Data Management

### Custom Hook: `useCarparkListings`

```typescript
export const useCarparkListings = ({ district, pageSize = 20 }: UseCarparkListingsProps) => {
  const [items, setItems] = React.useState<CarparkListing[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [page, setPage] = React.useState(0);

  const loadMore = React.useCallback(async () => {
    if (loading || done) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/carparks?district=${district}&page=${page}&limit=${pageSize}`);
      const data = await response.json();
      
      if (data.carparks.length === 0) {
        setDone(true);
      } else {
        setItems(prev => page === 0 ? data.carparks : [...prev, ...data.carparks]);
      }
    } catch (err) {
      setError('Failed to load car parks');
    } finally {
      setLoading(false);
    }
  }, [district, page, pageSize, loading, done]);

  return { items, loading, error, done, loadMore };
};
```

### Image Handling

The car park feed implements intelligent image handling:

```typescript
// utils/carpark-images-simple.ts
export function getAllCarparkImages(row: any): string[] {
  const images: string[] = [];
  
  // Priority order: cover image, imageFull array, photos array
  if (row.cover_image_url) images.push(row.cover_image_url);
  if (row.payload?.imageFull) images.push(...row.payload.imageFull);
  if (row.payload?.photos) images.push(...row.payload.photos);
  
  // Remove duplicates and return
  return [...new Set(images)];
}

// Default to last image (most recent/relevant)
const images = getAllCarparkImages(carpark);
const [imageIndex, setImageIndex] = React.useState(images.length > 1 ? images.length - 1 : 0);
```

## Mobile Optimization

### Responsive Design Features

1. **Grid Layout**: Responsive grid from 1 column (mobile) to 5 columns (desktop)
2. **Aspect Ratio**: Consistent 3:2 aspect ratio for all images
3. **Touch-Friendly**: Large touch targets for image navigation
4. **Compact Layout**: Optimized spacing and typography for mobile screens

### Performance Optimizations

1. **Lazy Loading**: Images load only when needed
2. **Infinite Scroll**: Pagination reduces initial load time
3. **Image Optimization**: Proper aspect ratios prevent layout shifts
4. **Debounced Filtering**: Prevents excessive API calls during district changes

## Integration with Existing System

### Category Selector Integration

The car park feed integrates seamlessly with the existing cars page:

```typescript
// Before (cars only)
export default function CarsPage() {
  return <CarsFeedWithSearch />;
}

// After (cars + carparks)
export default function CarsPage() {
  return <CarsPageWithSelector />;
}
```

### Consistent Design System

The car park feed follows the same design patterns as the car feed:

- **Card-based layout** for consistent visual hierarchy
- **Hover effects** and transitions for interactive feedback
- **Color scheme** using neutral colors with blue accents for parking
- **Typography** matching the existing system typography
- **Dark mode support** throughout all components

## API Endpoints

### Car Park Listings API

```typescript
// GET /api/carparks
interface CarparkListingsResponse {
  carparks: CarparkListing[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  district?: string;
}
```

### Data Structure

```typescript
interface CarparkListing {
  id: string;
  title: string;
  location: string;
  district: string;
  price: string;
  availableSpaces: number;
  images: string[];
  amenities: string[];
  coordinates?: {
    lat: number;
    lng: number;
  };
  createdAt: string;
  updatedAt: string;
}
```

## Future Enhancements

### Planned Features

1. **Map Integration**: Show car parks on a map view
2. **Real-time Availability**: Live updates on available spaces
3. **Booking System**: Allow users to reserve parking spaces
4. **Favorites**: Save frequently used car parks
5. **Reviews**: User reviews and ratings for car parks
6. **Navigation**: Integrate with navigation apps

### Technical Improvements

1. **Caching**: Implement Redis caching for frequently accessed data
2. **Search**: Add search functionality for car parks
3. **Filters**: Advanced filtering by price, amenities, availability
4. **Notifications**: Push notifications for space availability
5. **Analytics**: Track user engagement and popular car parks

## Testing Strategy

### Component Testing

```typescript
describe('CarparkFeed', () => {
  it('renders car park listings correctly', () => {
    render(<CarparkFeed />);
    expect(screen.getByText('Car Parks')).toBeInTheDocument();
  });

  it('filters by district', () => {
    render(<CarparkFeed />);
    fireEvent.click(screen.getByText('Central'));
    expect(mockUseCarparkListings).toHaveBeenCalledWith({ district: 'CENTRAL' });
  });
});
```

### Integration Testing

- **Category switching** between cars and car parks
- **Infinite scroll** loading more results
- **Image carousel** navigation
- **Responsive design** across different screen sizes

## Deployment Considerations

### Performance Monitoring

- **Load times** for car park listings
- **Image loading** performance
- **API response times** for different districts
- **Mobile performance** metrics

### SEO Optimization

- **Meta tags** for car park listings
- **Structured data** for parking information
- **URL structure** for individual car parks
- **Sitemap** inclusion for car park pages

---

*This documentation covers the high-level implementation of the Car Park Listing Feed as integrated into the existing cars page architecture.*