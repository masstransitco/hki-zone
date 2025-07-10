# Enhanced Image Search System for Perplexity News

## Overview
This document describes the enhanced image search system that ensures each news article gets a perceptively unique, high-quality image. The system addresses the issue of repetitive image usage by implementing image history tracking, enhanced randomization, and improved search strategies.

## Key Features

### 1. Image History Tracking
- **30-day rolling window** of image usage tracking
- **Database table** `perplexity_image_history` stores all used images
- **Automatic cleanup** of images older than 60 days
- **Category-specific tracking** to ensure variety within each news category

### 2. Enhanced Search Strategies

#### Unsplash Search (Primary)
- **Larger result sets**: Fetches 30 images instead of 10
- **Random page selection**: Searches pages 1-3 randomly
- **Smart filtering**: Excludes recently used images (last 7 days)
- **Randomized selection**: Picks randomly from top-scored images

#### Google Image Search (Secondary)
- **Increased results**: Fetches 10 images instead of 3
- **Random start parameter**: Varies search results with random offset (1-20)
- **Large image preference**: Prioritizes high-quality images
- **Creative Commons filtering**: Prefers properly licensed images

#### Fallback System
- **Smart fallback selection**: Checks if fallback images were recently used
- **Multiple fallbacks per category**: 3 unique images per category
- **Contextual matching**: Selects fallbacks based on article keywords

### 3. Image Uniqueness Validation

#### Pre-selection Filtering
```javascript
// Filter out recently used images
const availableImages = []
for (const image of images) {
  const isRecent = await isImageRecentlyUsed(image.urls.regular, 7)
  if (!isRecent && !this.recentlyUsedImages.has(image.urls.regular)) {
    availableImages.push(image)
  }
}
```

#### Post-selection Tracking
- Images are immediately tracked after selection
- Prevents same image from being selected in concurrent processes
- Maintains in-memory cache for current session

### 4. Improved Randomization

#### Score-based Randomization
- Instead of always picking the highest-scored image
- Selects randomly from images within 1 point of top score
- Ensures variety while maintaining quality

#### Search Query Randomization
- Varies search parameters (page, start index)
- Generates multiple search queries per request
- Uses different keyword combinations

## Database Schema

### perplexity_image_history Table
```sql
CREATE TABLE perplexity_image_history (
  id UUID PRIMARY KEY,
  image_url TEXT NOT NULL,
  image_source TEXT NOT NULL, -- 'unsplash', 'google', 'perplexity', 'fallback'
  article_id UUID REFERENCES perplexity_news(id),
  category TEXT NOT NULL,
  search_query TEXT,
  image_hash TEXT GENERATED,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Helper Functions
- `get_recent_used_images(days, category)` - Returns recently used images
- `is_image_recently_used(image_url, days)` - Checks if image was recently used

## Implementation Details

### 1. Image Search Flow
```
1. Load recently used images for category (30-day window)
2. Try Unsplash API
   - Generate optimized search query
   - Fetch 30 results from random page
   - Filter out recently used images
   - Score remaining images
   - Select randomly from top scores
3. If Unsplash fails, try Google CSE
   - Generate Hong Kong-specific queries
   - Fetch 10 results with random offset
   - Apply same filtering and selection
4. If Google fails, try Perplexity AI
5. If all APIs fail, use smart fallback
   - Check which fallbacks were recently used
   - Select unused fallback image
```

### 2. Search Query Optimization

#### Unsplash Queries
- Extracts visual keywords from article title
- Adds category-specific terms
- Includes Hong Kong context
- Example: "office building finance hong kong"

#### Google Queries
- Multiple query strategies
- Location-aware searches
- Current year inclusion
- Example: "Hong Kong business news 2024 2025"

### 3. Image Scoring System

#### Scoring Criteria
- **Quality**: Resolution (1200x800+), aspect ratio (1.3-2.0)
- **Relevance**: Category keywords, Hong Kong context
- **Licensing**: Creative Commons preference
- **Freshness**: Not recently used

#### Score Adjustments
- +5 points for Hong Kong relevance
- +4 points for news site sources
- +3 points for clear licensing
- +3 points for high resolution
- -10 points for irrelevant people/content

## Configuration

### Environment Variables
```env
# Image Search APIs
UNSPLASH_ACCESS_KEY=your_unsplash_key
GOOGLE_API_KEY=your_google_key
GOOGLE_CSE_ID=your_cse_id
PERPLEXITY_API_KEY=your_perplexity_key

# Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### API Rate Limits
- **Unsplash**: 50 requests/hour (demo), 5000/hour (production)
- **Google CSE**: 100 requests/day (free tier)
- **Image History Queries**: No limit (database queries)

## Testing

### Run Tests
```bash
# Apply database migration
psql $DATABASE_URL -f scripts/add-perplexity-image-tracking.sql

# Run test script
node test-enhanced-image-search.js
```

### Test Coverage
1. Image history table existence
2. Recently used image tracking
3. Duplicate usage detection
4. Category distribution analysis
5. Image uniqueness validation
6. Enhanced search functionality

## Monitoring

### Key Metrics
- **Image Uniqueness Rate**: Target >95% unique images per week
- **API Success Rate**: Track failures by source
- **Category Distribution**: Ensure balanced image variety
- **Search Performance**: Response times and quality scores

### Debug Logging
```javascript
console.log(`🔍 Filtered ${images.length} images to ${availableImages.length} unused images`)
console.log(`📊 Loaded ${this.recentlyUsedImages.size} recently used images to avoid`)
console.log(`🎯 Selected contextual fallback with ${bestMatchScore} keyword matches`)
```

## Benefits

### 1. Visual Variety
- Each article gets a unique, relevant image
- No repetitive images within 7-day window
- Better user experience with diverse visuals

### 2. Quality Maintenance
- Scoring system ensures high-quality images
- Proper licensing and attribution
- Hong Kong-relevant content

### 3. System Reliability
- Multiple fallback layers
- Graceful degradation
- Continuous operation even with API failures

### 4. Cost Optimization
- Efficient API usage with caching
- Reduced duplicate API calls
- Smart query optimization

## Future Enhancements

### Short Term
1. **Visual Similarity Detection**: Use perceptual hashing to avoid similar images
2. **Seasonal Adjustments**: Time-aware image selection
3. **Performance Caching**: Redis layer for faster lookups

### Long Term
1. **ML-based Selection**: Train model on user engagement
2. **Custom Image Collections**: Curated Hong Kong image sets
3. **Real-time A/B Testing**: Optimize image selection based on CTR
4. **Multi-language Support**: Chinese keyword extraction

## Migration Guide

### Step 1: Apply Database Migration
```bash
psql $DATABASE_URL -f scripts/add-perplexity-image-tracking.sql
```

### Step 2: Update Environment Variables
Ensure all API keys are properly configured in `.env.local`

### Step 3: Deploy Updated Code
The system will automatically start tracking image usage

### Step 4: Monitor Results
Check image variety using the test script or admin panel

## Troubleshooting

### Common Issues

1. **"Image history table does not exist"**
   - Run the database migration script
   - Check database permissions

2. **"All images recently used"**
   - System working as intended
   - Will fall back to less recent images
   - Consider increasing result set size

3. **"API rate limit exceeded"**
   - Check API usage dashboard
   - Consider upgrading API plan
   - System will use fallbacks

4. **"No unique images found"**
   - Expand search queries
   - Add more fallback images
   - Check category keywords