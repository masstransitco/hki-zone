# HKI News App - Frontend Architecture

## Overview

The HKI News App frontend is built with Next.js 14 using the App Router, TypeScript, and modern React patterns. The architecture emphasizes performance, accessibility, and maintainability while providing a rich user experience across both public and admin interfaces.

## Technology Stack

### Core Technologies
- **Next.js 14**: App Router with server components and client components
- **TypeScript**: Full type safety across the application
- **React 18**: Latest React features including concurrent rendering
- **Tailwind CSS**: Utility-first CSS framework

### UI Components
- **Radix UI**: Headless UI components for accessibility
- **Shadcn/ui**: Component library built on Radix UI
- **Lucide React**: Icon library
- **Recharts**: Data visualization

### State Management
- **React Query**: Server state management and caching
- **React Context**: Global client state (theme, language, user)
- **Local State**: Component-level state with React hooks

## Architecture Patterns

### Component Organization

```
components/
├── ui/                    # Shadcn/ui components (buttons, inputs, etc.)
├── admin/                 # Admin-specific components
├── layout/               # Layout components (header, footer, nav)
├── content/              # Content display components
├── forms/                # Form components
└── shared/               # Reusable utility components
```

### Component Hierarchy

```
Root Layout
├── Theme Provider
├── Language Provider
├── Query Provider
├── Analytics Provider
└── Page Content
    ├── Header
    ├── Main Content
    └── Footer Nav (mobile)
```

## Key Components

### 1. Layout Components

#### Root Layout (`app/layout.tsx`)
```typescript
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <LanguageProvider>
            <QueryProvider>
              <AnalyticsProvider>
                {children}
              </AnalyticsProvider>
            </QueryProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

#### Header Component (`components/header.tsx`)
- Navigation with logo and theme toggle
- Language selector
- Responsive design with mobile menu
- Search functionality

#### Footer Navigation (`components/footer-nav.tsx`)
- Bottom navigation for mobile
- Active state indication
- Icon-based navigation

### 2. Content Components

#### News Feed (`components/news-feed.tsx`)
- Infinite scroll with intersection observer
- Article cards with lazy loading
- Real-time updates with React Query
- Error handling and retry logic

#### Article Card (`components/article-card.tsx`)
```typescript
interface ArticleCardProps {
  article: Article
  showSource?: boolean
  showCategory?: boolean
  showReadTime?: boolean
  className?: string
}

export function ArticleCard({
  article,
  showSource = true,
  showCategory = true,
  showReadTime = true,
  className
}: ArticleCardProps) {
  // Component implementation
}
```

#### Article Detail (`components/article-detail.tsx`)
- Full article view with structured data
- Social sharing integration
- SEO optimization
- Related articles

#### Cars Feed (`components/cars-feed.tsx`)
- Specialized feed for automotive listings
- Car-specific card layouts with image carousels
- Price parsing and sale indicators
- Infinite scroll with category filtering
- Error handling with fallback UI

#### Car Card (`components/car-card.tsx`)
```typescript
interface CarCardProps {
  car: CarListing
  className?: string
}

export function CarCard({ car, className }: CarCardProps) {
  // Features:
  // - Image carousel with navigation dots
  // - Price display with sale indicators
  // - Car specifications display
  // - External link to 28car.com
  // - Responsive design
}
```

### 3. Admin Components

#### Admin Layout (`app/admin/layout.tsx`)
- Sidebar navigation
- Admin header with user context
- Protected route wrapper

#### Admin Sidebar (`components/admin/admin-sidebar.tsx`)
- Collapsible navigation
- Active state management
- Access control integration

#### Article Management (`components/admin/article-review-grid.tsx`)
- Bulk operations interface
- Filtering and search
- Status management
- Image upload and management

### 4. UI Components (Shadcn/ui)

#### Button Component (`components/ui/button.tsx`)
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // Component implementation
  }
)
```

#### Card Component (`components/ui/card.tsx`)
- Consistent card styling
- Variants for different contexts
- Built-in accessibility features

## State Management

### 1. Server State (React Query)

#### Article Fetching
```typescript
function useArticles(page: number = 0) {
  return useQuery({
    queryKey: ['articles', page],
    queryFn: () => fetchArticles(page),
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

function useInfiniteArticles() {
  return useInfiniteQuery({
    queryKey: ['articles'],
    queryFn: ({ pageParam = 0 }) => fetchArticles(pageParam),
    getNextPageParam: (lastPage) => lastPage.nextPage,
  })
}
```

#### Mutation Examples
```typescript
function useUpdateArticle() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: updateArticle,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['articles'])
      queryClient.setQueryData(['article', data.id], data)
    },
  })
}
```

### 2. Client State (Context)

#### Theme Context (`components/theme-provider.tsx`)
```typescript
interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system')
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
```

#### Language Context (`components/language-provider.tsx`)
```typescript
interface LanguageContextType {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string) => string
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en')
  
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}
```

## Routing Structure

### App Router Organization

```
app/
├── (public)/
│   ├── page.tsx                 # Home page
│   ├── headlines/
│   │   └── page.tsx            # Headlines page
│   ├── perplexity/
│   │   └── page.tsx            # AI-generated content
│   ├── topics/
│   │   └── page.tsx            # Topic-based articles
│   ├── cars/
│   │   └── page.tsx            # Car listings feed
│   ├── search/
│   │   └── page.tsx            # Search interface
│   └── article/
│       └── [id]/
│           └── page.tsx        # Article detail
├── admin/
│   ├── layout.tsx              # Admin layout
│   ├── page.tsx                # Admin dashboard
│   ├── articles/
│   │   └── page.tsx           # Article management
│   └── settings/
│       └── page.tsx           # Admin settings
└── api/                        # API routes
```

### Page Components

#### Home Page (`app/page.tsx`)
```typescript
export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <NewsFeed />
      </main>
      <FooterNav />
    </div>
  )
}
```

#### Cars Page (`app/cars/page.tsx`)
```typescript
export const metadata: Metadata = {
  title: "Cars | Panora",
  description: "Latest car listings and automotive news from Hong Kong",
  keywords: ["Hong Kong cars", "car listings", "automotive", "vehicles", "28car"],
}

export default function CarsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 pb-20">
        <div className="py-6">
          <Suspense fallback={<CarsLoadingSkeleton />}>
            <CarsFeed />
          </Suspense>
        </div>
      </main>
      <FooterNav />
    </div>
  )
}
```

#### Article Detail Page (`app/article/[id]/page.tsx`)
```typescript
interface ArticlePageProps {
  params: { id: string }
}

export default function ArticlePage({ params }: ArticlePageProps) {
  const { data: article, isLoading, error } = useArticle(params.id)
  
  if (isLoading) return <ArticleDetailSkeleton />
  if (error) return <ErrorComponent error={error} />
  if (!article) return <NotFoundComponent />
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <ArticleDetail article={article} />
      </main>
      <FooterNav />
    </div>
  )
}
```

## Data Fetching Patterns

### 1. Infinite Scroll Implementation

```typescript
function useInfiniteArticles() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: ['articles'],
    queryFn: ({ pageParam = 0 }) => fetchArticles(pageParam),
    getNextPageParam: (lastPage) => lastPage.nextPage,
  })

  const { ref, inView } = useInView({
    threshold: 0,
    triggerOnce: false,
  })

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  return {
    articles: data?.pages.flatMap(page => page.articles) ?? [],
    loadMoreRef: ref,
    isLoading,
    error,
  }
}
```

### 2. Cars Data Fetching

```typescript
function useCars() {
  const queryClient = useQueryClient()
  const { language } = useLanguage()
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch
  } = useInfiniteQuery({
    queryKey: ['cars', language],
    queryFn: ({ pageParam = 0 }) => fetchCars(pageParam),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 5 * 60 * 1000, // 5 minutes
    initialPageParam: 0,
  })
  
  const cars = data?.pages.flatMap(page => page.articles) ?? []
  
  return {
    cars,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch
  }
}

async function fetchCars(page: number): Promise<CarsResponse> {
  const response = await fetch(`/api/articles?page=${page}&category=cars`)
  return response.json()
}
```

### 3. Real-time Updates

```typescript
function useRealTimeArticles() {
  const queryClient = useQueryClient()
  
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries(['articles'])
    }, 30000) // Refresh every 30 seconds
    
    return () => clearInterval(interval)
  }, [queryClient])
  
  // Also refresh on window focus
  useEffect(() => {
    const handleFocus = () => {
      queryClient.invalidateQueries(['articles'])
    }
    
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [queryClient])
}
```

## Custom Hooks

### 1. Hydration Safety Hook

```typescript
function useHydrationSafeDate() {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  const formatDate = useCallback((date: string) => {
    if (!mounted) return ''
    return format(new Date(date), 'MMM d, yyyy')
  }, [mounted])
  
  return { formatDate, mounted }
}
```

### 2. Debounced Search Hook

```typescript
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])
  
  return debouncedValue
}
```

### 3. Mobile Detection Hook

```typescript
function useMobile() {
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  return isMobile
}
```

## Performance Optimizations

### 1. Image Optimization

```typescript
import Image from 'next/image'

function OptimizedImage({ src, alt, ...props }) {
  return (
    <Image
      src={src}
      alt={alt}
      loading="lazy"
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
      {...props}
    />
  )
}
```

### 2. Code Splitting

```typescript
import dynamic from 'next/dynamic'

const AdminPanel = dynamic(() => import('./admin-panel'), {
  loading: () => <div>Loading admin panel...</div>,
  ssr: false
})

const HeavyComponent = dynamic(() => import('./heavy-component'), {
  loading: () => <Skeleton />,
})
```

### 3. Memoization

```typescript
const ArticleCard = memo(function ArticleCard({ article }: { article: Article }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{article.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{article.summary}</p>
      </CardContent>
    </Card>
  )
})
```

## Accessibility Features

### 1. Semantic HTML

```typescript
function ArticleList({ articles }: { articles: Article[] }) {
  return (
    <section aria-label="Latest articles">
      <h2>Latest News</h2>
      <ul role="list">
        {articles.map(article => (
          <li key={article.id} role="listitem">
            <ArticleCard article={article} />
          </li>
        ))}
      </ul>
    </section>
  )
}
```

### 2. Keyboard Navigation

```typescript
function SearchInput() {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && e.metaKey) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  
  return (
    <Input
      ref={inputRef}
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search articles... (⌘/)"
      aria-label="Search articles"
    />
  )
}
```

## SEO and Meta Tags

### 1. Dynamic Meta Tags

```typescript
export function generateMetadata({ params }: { params: { id: string } }) {
  const article = getArticle(params.id)
  
  return {
    title: article.title,
    description: article.summary,
    openGraph: {
      title: article.title,
      description: article.summary,
      images: [article.imageUrl],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.summary,
      images: [article.imageUrl],
    },
  }
}
```

### 2. Structured Data

```typescript
function ArticleStructuredData({ article }: { article: Article }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    image: article.imageUrl,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: {
      '@type': 'Person',
      name: article.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'HKI News',
    },
  }
  
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}
```

## Error Handling

### 1. Error Boundaries

```typescript
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true }
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />
    }
    
    return this.props.children
  }
}
```

### 2. API Error Handling

```typescript
function useArticlesWithErrorHandling() {
  const { data, error, isLoading, retry } = useQuery({
    queryKey: ['articles'],
    queryFn: fetchArticles,
    retry: (failureCount, error) => {
      if (error.status === 404) return false
      return failureCount < 3
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
  
  return {
    articles: data?.articles ?? [],
    error,
    isLoading,
    retry,
  }
}
```

## Testing Strategy

### 1. Component Testing

```typescript
import { render, screen } from '@testing-library/react'
import { ArticleCard } from './article-card'

describe('ArticleCard', () => {
  it('renders article information correctly', () => {
    const article = {
      id: '1',
      title: 'Test Article',
      summary: 'Test summary',
      // ... other properties
    }
    
    render(<ArticleCard article={article} />)
    
    expect(screen.getByText('Test Article')).toBeInTheDocument()
    expect(screen.getByText('Test summary')).toBeInTheDocument()
  })
})
```

### 2. Hook Testing

```typescript
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from './use-debounce'

describe('useDebounce', () => {
  it('debounces value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      }
    )
    
    expect(result.current).toBe('initial')
    
    rerender({ value: 'updated', delay: 500 })
    expect(result.current).toBe('initial')
    
    act(() => {
      jest.advanceTimersByTime(500)
    })
    
    expect(result.current).toBe('updated')
  })
})
```

This comprehensive frontend architecture provides a solid foundation for building scalable, maintainable, and performant React applications with Next.js. The patterns and practices documented here ensure consistency across the codebase and provide clear guidance for future development.