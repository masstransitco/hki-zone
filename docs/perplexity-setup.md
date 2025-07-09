# Perplexity AI News Feed Setup Guide

This guide covers the setup and configuration of the Perplexity AI-powered news feed, which autonomously generates fresh Hong Kong news content.

## Overview

The Perplexity news system consists of:
- **Headlines Fetcher**: Generates fresh HK headlines every 5 minutes using Perplexity AI
- **Content Enricher**: Processes pending headlines into full articles with images
- **Real-time Feed**: Displays AI-generated content with live updates via Supabase Realtime

## Environment Variables

Add these environment variables to your Vercel dashboard or `.env.local` file:

### Required Variables

```env
# Perplexity AI API (Required for headline generation)
PERPLEXITY_API_KEY=your_perplexity_api_key_here

# Supabase (Already configured in your project)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Optional Variables (For Image Enhancement)

```env
# Google Custom Search (For image fallback)
GOOGLE_CSE_ID=your_google_custom_search_engine_id
GOOGLE_API_KEY=your_google_api_key_with_custom_search_enabled
```

## Getting API Keys

### 1. Perplexity API Key (Required)

1. Visit [Perplexity AI API](https://www.perplexity.ai/api)
2. Sign up for an account
3. Navigate to API settings
4. Generate a new API key
5. Add to environment variables as `PERPLEXITY_API_KEY`

**Cost**: Approximately $2/month for typical usage (~20M tokens)

### 2. Google Custom Search (Optional)

1. Visit [Google Custom Search Engine](https://programmablesearchengine.google.com/)
2. Create a new search engine or use existing one
3. Get the Search Engine ID (CSE ID)
4. Visit [Google Cloud Console](https://console.cloud.google.com/)
5. Enable Custom Search API
6. Create API credentials
7. Add both `GOOGLE_CSE_ID` and `GOOGLE_API_KEY`

**Cost**: Free for up to 100 searches/day

## Database Setup

Run the Perplexity news table setup:

```sql
-- Execute the SQL in your Supabase dashboard
-- File: scripts/add-perplexity-news-table.sql
```

This creates:
- `perplexity_news` table with proper schema
- Indexes for performance
- RLS policies for security
- Automatic cleanup cron job (24-hour TTL)

## Cron Jobs

The system uses 2 cron jobs (configured in `vercel.json`):

### Headlines Fetcher
- **Schedule**: Every 5 minutes (`*/5 * * * *`)
- **Endpoint**: `/api/cron/fetch-perplexity-news`
- **Function**: Generates fresh HK headlines across 6 categories

### Content Enricher
- **Schedule**: Every 5 minutes, offset by 2 minutes (`2-57/5 * * * *`)
- **Endpoint**: `/api/cron/enrich-perplexity-news`
- **Function**: Processes pending headlines into full articles with images

## Content Categories

The system focuses on Hong Kong-specific content across:

1. **Politics** - Government policies, elections, Legislative Council
2. **Business** - Economy, finance, property market, stock exchange
3. **Tech** - Innovation, smart city, AI developments
4. **Health** - Healthcare, medical advances, wellness initiatives
5. **Lifestyle** - Food, culture, entertainment, events
6. **Entertainment** - Films, celebrities, festivals

## Features

### Article Generation
- Uses Perplexity's `sonar-pro` model for accuracy
- Generates ≤220-word articles with structured HTML
- Includes compelling lead paragraphs (lede)
- Creates descriptive image search prompts

### Image Processing
- **Primary**: Perplexity return_images with domain filtering
- **Fallback**: Google Custom Search with Creative Commons filtering
- **Last Resort**: Category-appropriate Unsplash images
- Proper license attribution and compliance

### Real-time Updates
- Supabase Realtime subscriptions for live content
- Automatic feed updates when new articles are ready
- Progress tracking during content generation

## Cost Estimation

| Service | Usage | Monthly Cost |
|---------|-------|-------------|
| Perplexity API | ~20M tokens | ~$2 USD |
| Google Custom Search | <100 image searches | Free |
| Vercel Cron Jobs | 576 executions/day | Free (Hobby) |
| Supabase | Database + Realtime | Existing |
| **Total** | | **~$2 USD/month** |

## Monitoring & Debugging

### Check System Status

1. **Database**: Verify `perplexity_news` table exists
2. **API Keys**: Check environment variables are set
3. **Cron Jobs**: Monitor Vercel Functions logs
4. **Content**: Visit `/perplexity` page to see generated articles

### Common Issues

**No articles appearing:**
- Check Perplexity API key is valid
- Verify database table is created
- Check Vercel cron job logs

**Images not loading:**
- Google Custom Search may not be configured
- Fallback to Unsplash images should work
- Check image licensing information

**High costs:**
- Monitor Perplexity token usage
- Adjust cron frequency if needed
- Review article generation prompts

### Fallback Mode

If Perplexity API is unavailable:
- System automatically uses fallback headlines
- Mock content ensures feed remains functional
- Real content resumes when API is restored

## Manual Testing

Test the system components:

```bash
# Test headline generation
curl -X GET https://your-domain.vercel.app/api/cron/fetch-perplexity-news

# Test content enrichment
curl -X GET https://your-domain.vercel.app/api/cron/enrich-perplexity-news

# Test API endpoint
curl -X GET https://your-domain.vercel.app/api/perplexity-news
```

## Integration with Existing System

The Perplexity feed:
- ✅ Uses existing Supabase infrastructure
- ✅ Integrates with current theme system
- ✅ Follows responsive design patterns
- ✅ Includes analytics tracking
- ✅ Supports real-time updates
- ✅ Has proper fallback mechanisms

## Security & Compliance

- All API keys stored securely in environment variables
- Database access controlled by RLS policies
- Image licensing properly tracked and attributed
- Content generation respects rate limits
- No personal data collection or storage

## Deployment Checklist

- [ ] Set `PERPLEXITY_API_KEY` environment variable
- [ ] Run database migration script
- [ ] Deploy to Vercel (cron jobs auto-enabled)
- [ ] Verify first headlines appear within 5 minutes
- [ ] Check articles are enriched within 10 minutes
- [ ] Test real-time updates on `/perplexity` page
- [ ] Optional: Configure Google Custom Search for enhanced images

The Perplexity news feed will be fully operational once the API key is configured and the database migration is run.