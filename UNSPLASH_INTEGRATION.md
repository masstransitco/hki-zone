# Unsplash API Integration for Hong Kong News Image Search

## Overview
This integration adds Unsplash API as the primary image source for the Hong Kong news enrichment system, with existing Google Image Search and Perplexity AI as fallbacks.

## Priority Order
1. **Unsplash API** (Primary) - High-quality curated images with proper licensing
2. **Google Custom Search API** (Fallback 1) - Existing implementation 
3. **Perplexity AI** (Fallback 2) - Existing implementation
4. **Static Unsplash Images** (Final fallback) - Existing category-based fallbacks

## Configuration

### Environment Variables
Add your Unsplash API access key to `.env.local`:
```
UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here
```

### API Keys Required
- `UNSPLASH_ACCESS_KEY` - Get from [Unsplash Developers](https://unsplash.com/developers)
- `GOOGLE_API_KEY` - Existing Google API key (fallback)
- `GOOGLE_CSE_ID` - Existing Google Custom Search Engine ID (fallback)
- `PERPLEXITY_API_KEY` - Existing Perplexity API key (fallback)

## Features

### Smart Query Transformation
The system transforms Hong Kong news content into Unsplash-optimized search queries:

- **Category-aware search**: Different strategies for politics, business, tech, health, lifestyle, entertainment
- **Hong Kong contextualization**: Adds relevant Hong Kong/city/urban keywords
- **Visual keyword extraction**: Focuses on visual elements from news content

### Image Quality Scoring
Images are scored based on:
- Resolution (1200x800+ preferred)
- Aspect ratio (landscape 1.3:1 to 2:1 preferred)
- Relevance to category keywords
- Hong Kong/Asia/city context
- Content quality

### Proper Attribution
All Unsplash images include proper attribution:
- License: "Unsplash License"
- Attribution: "Photo by [Photographer Name] on Unsplash"
- Source tracking: `source: 'unsplash'`

## Integration Points

### Main Files Modified
- `lib/perplexity-image-search.ts` - Core integration
- `.env.local` - Environment configuration
- `app/api/cron/enrich-perplexity-news/route.ts` - Already uses the image search system

### API Usage
The integration uses the existing `perplexityImageSearch` service:

```typescript
// Basic usage
const result = await perplexityImageSearch.findImage(query, category)

// With enriched metadata
const result = await perplexityImageSearch.findImageWithMetadata(enrichedData, category)
```

### Response Format
```typescript
interface ImageResult {
  url: string
  license: string
  source: 'unsplash' | 'google' | 'perplexity' | 'fallback'
  alt?: string
  attribution?: string
}
```

## Testing

### Test the Integration
```bash
# Run the test script
node test-unsplash-integration.js

# Or use the built-in test method
# In your application code:
await perplexityImageSearch.testImageSearch()
```

### Sample Test Queries
- "Hong Kong Legislative Council passes new housing policy" (politics)
- "IFC Tower Hong Kong stock market reaches new high" (business)
- "Science Park Hong Kong launches AI innovation hub" (tech)
- "Queen Mary Hospital Hong Kong medical breakthrough" (health)
- "Victoria Harbour Hong Kong cultural festival" (lifestyle)
- "West Kowloon Hong Kong film premiere event" (entertainment)

## Benefits

### Quality Improvements
- **Higher quality images** from Unsplash's curated collection
- **Better licensing** with clear attribution requirements
- **Professional photography** vs. generic stock photos
- **Consistent visual style** across articles

### Technical Benefits
- **Seamless fallback** to existing Google/Perplexity systems
- **Zero breaking changes** to existing enrichment workflow
- **Improved performance** with optimized search queries
- **Better categorization** with category-aware search

### User Experience
- **More relevant images** for Hong Kong news content
- **Faster loading** with optimized image sizes
- **Professional appearance** with high-quality visuals
- **Consistent branding** with proper attribution

## Monitoring

The system logs all search attempts and results:
- ✅ Successful Unsplash searches
- ⚠️ Fallback to Google/Perplexity when Unsplash fails
- ❌ Complete failures with fallback to static images
- 📊 Image scoring results for debugging

## Rate Limits & Costs

### Unsplash API Limits
- **Demo/Development**: 50 requests/hour
- **Production**: 5,000 requests/hour
- Rate limiting built into the system

### Fallback Strategy
If Unsplash API is unavailable or rate limited:
1. Google Custom Search API (existing quotas)
2. Perplexity AI (existing quotas)
3. Static fallback images (no API calls)

## Future Enhancements

### Potential Improvements
- **Caching layer** for frequently searched images
- **Image preprocessing** for consistent sizes
- **A/B testing** between different search strategies
- **Performance metrics** tracking
- **Custom Hong Kong image collections** on Unsplash

### Advanced Features
- **Seasonal adjustments** for Hong Kong events
- **Multi-language support** for Chinese queries
- **Custom image collections** curated for Hong Kong news
- **Real-time image optimization** based on usage patterns