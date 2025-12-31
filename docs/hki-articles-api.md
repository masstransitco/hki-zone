# HKI Zone Articles API

Public API for accessing AI-enhanced Hong Kong news articles.

## Overview

The HKI Zone Articles API provides programmatic access to curated, AI-enhanced news articles covering Hong Kong. Articles include full content, featured images, source citations, and structured metadata.

**Base URL:** `https://hki.zone/api`

**Content Types:**
- `scraped` - Articles collected from news sources
- `ai_generated` - AI-synthesized articles from multiple sources
- `ai_enhanced` - Human articles enhanced with AI context

**Languages:** English (`en`), Traditional Chinese (`zh-TW`), Simplified Chinese (`zh-CN`)

---

## Authentication

**Current:** No authentication required. All published articles are publicly accessible.

Row Level Security ensures only articles with `status = 'published'` are returned.

> **Note:** Rate limiting may be implemented in future versions.

---

## Endpoints

### List Articles

Retrieve a paginated list of articles with optional filtering.

```
GET /api/unified/articles
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `0` | Page number (0-indexed) |
| `limit` | integer | `10` | Articles per page (max 50) |
| `type` | string | `"all"` | Article type: `all`, `scraped`, `ai_generated`, `ai_enhanced` |
| `category` | string | - | Category slug (see [Categories](#categories)) |
| `source` | string | - | Filter by source name |
| `status` | string | `"published"` | Status: `published`, `draft`, `archived` |
| `features` | string[] | - | Feature filters: `has_image`, `has_ai_content`, `has_translation` |
| `search` | string | - | Full-text search across title, summary, and content |
| `sort` | string | `"latest"` | Sort order: `latest`, `popular`, `relevance` |

#### Response

```json
{
  "articles": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Hong Kong Tech Hub Expansion Announced",
      "summary": "Government unveils plans for new innovation district...",
      "content": "<p>Full article content...</p>",
      "url": "https://source.com/article",
      "source": "RTHK",
      "category": "tech",
      "published_at": "2024-01-15T08:30:00Z",
      "image_url": "https://images.unsplash.com/...",
      "article_type": "ai_enhanced",
      "status": "published",
      "features": {
        "has_image": true,
        "has_ai_content": true,
        "has_translation": false
      }
    }
  ],
  "nextPage": 1,
  "totalCount": 150,
  "hasMore": true
}
```

---

### Get Single Article

Retrieve a single article by ID with full content and metadata.

```
GET /api/unified/articles/{id}
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Article UUID |

#### Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Hong Kong Tech Hub Expansion Announced",
  "summary": "Government unveils plans for new innovation district in Kowloon East.",
  "content": "<p>The Hong Kong government has announced ambitious plans...</p>",
  "url": "https://source.com/original-article",
  "source": "RTHK",
  "publishedAt": "2024-01-15T08:30:00Z",
  "imageUrl": "https://images.unsplash.com/photo-example",
  "category": "tech",
  "readTime": 5,
  "isAiEnhanced": true,
  "language": "en",
  "originalArticleId": "legacy-123",
  "enhancementMetadata": {
    "searchQueries": [
      "Hong Kong tech hub expansion 2024",
      "Kowloon East innovation district"
    ],
    "sources": [
      {
        "url": "https://scmp.com/tech/article",
        "title": "HK Tech Hub Plans Revealed",
        "domain": "scmp.com",
        "snippet": "The government's new tech initiative...",
        "accessedAt": "2024-01-15T08:00:00Z"
      },
      {
        "url": "https://rthk.hk/news/tech",
        "title": "Innovation District Announcement",
        "domain": "rthk.hk",
        "accessedAt": "2024-01-15T08:00:00Z"
      }
    ],
    "relatedTopics": ["tech"],
    "enhancedAt": "2024-01-15T09:00:00Z",
    "enhancementCost": "0.025",
    "structuredContent": {
      "enhancedTitle": "Hong Kong Unveils Major Tech Hub Expansion in Kowloon East",
      "enhancedSummary": "A comprehensive look at the government's plans...",
      "keyPoints": [
        "HK$50 billion investment over 10 years",
        "Expected to create 20,000 tech jobs",
        "Focus on AI, fintech, and biotech sectors",
        "International partnerships with Silicon Valley firms"
      ],
      "whyItMatters": "This expansion positions Hong Kong as a leading tech hub in Asia, competing with Singapore and Shenzhen for talent and investment."
    }
  }
}
```

---

## Data Schemas

### Article Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique article UUID |
| `title` | string | Article headline |
| `summary` | string | Brief summary or lede |
| `content` | string | Full content (HTML or markdown) |
| `url` | string | Original source URL |
| `source` | string | Publisher name |
| `category` | string | Category slug |
| `publishedAt` | string | ISO 8601 publication timestamp |
| `imageUrl` | string? | Featured image URL |
| `readTime` | number | Estimated read time in minutes |
| `isAiEnhanced` | boolean | Whether article has AI enhancements |
| `language` | string | Content language code |
| `enhancementMetadata` | object? | AI enhancement details (see below) |

### EnhancementMetadata Object

Present on AI-enhanced articles (`isAiEnhanced: true`).

| Field | Type | Description |
|-------|------|-------------|
| `searchQueries` | string[] | Search queries used for research |
| `sources` | Source[] | Citation sources (see below) |
| `relatedTopics` | string[] | Related topic tags |
| `enhancedAt` | string | ISO 8601 enhancement timestamp |
| `enhancementCost` | string? | API cost in USD |
| `structuredContent` | object | Structured article elements |

### StructuredContent Object

| Field | Type | Description |
|-------|------|-------------|
| `enhancedTitle` | string? | AI-improved headline |
| `enhancedSummary` | string? | AI-generated summary |
| `keyPoints` | string[]? | Key bullet points |
| `whyItMatters` | string? | Impact/significance analysis |

### Source Object (Citations)

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | Source URL |
| `title` | string | Source article title |
| `domain` | string | Source domain name |
| `snippet` | string? | Content excerpt |
| `accessedAt` | string | When source was accessed |

---

## Categories

| Slug | Description |
|------|-------------|
| `politics` | Government, policy, elections, legislation |
| `business` | Economy, finance, markets, companies |
| `tech` | Technology, innovation, startups, digital |
| `lifestyle` | Culture, food, entertainment, travel |
| `sports` | Sports news, events, athletes |
| `local` | Local Hong Kong community news |

---

## Error Handling

### HTTP Status Codes

| Status | Description |
|--------|-------------|
| `200` | Success |
| `400` | Invalid request parameters |
| `404` | Article not found |
| `500` | Internal server error |
| `503` | Database temporarily unavailable |

### Error Response Format

```json
{
  "error": "Article not found"
}
```

---

## Code Examples

### JavaScript / TypeScript

```typescript
// List recent tech articles with images
async function getTechArticles() {
  const params = new URLSearchParams({
    limit: '10',
    category: 'tech',
    features: 'has_image'
  });

  const response = await fetch(`https://hki.zone/api/unified/articles?${params}`);
  const { articles, totalCount, hasMore } = await response.json();

  console.log(`Found ${totalCount} articles`);
  return articles;
}

// Get single article with full content
async function getArticle(id: string) {
  const response = await fetch(`https://hki.zone/api/unified/articles/${id}`);

  if (!response.ok) {
    throw new Error('Article not found');
  }

  const article = await response.json();

  // Access citations
  const citations = article.enhancementMetadata?.sources || [];
  console.log(`Article has ${citations.length} citations`);

  return article;
}

// Search articles
async function searchArticles(query: string) {
  const response = await fetch(
    `https://hki.zone/api/unified/articles?search=${encodeURIComponent(query)}`
  );
  return response.json();
}
```

### Python

```python
import requests

BASE_URL = "https://hki.zone/api/unified/articles"

# List articles with filters
def get_articles(category=None, limit=10, page=0):
    params = {
        "limit": limit,
        "page": page,
    }
    if category:
        params["category"] = category

    response = requests.get(BASE_URL, params=params)
    response.raise_for_status()

    data = response.json()
    return data["articles"], data["totalCount"]

# Get AI-enhanced articles only
def get_enhanced_articles():
    params = {
        "type": "ai_generated",
        "features": ["has_ai_content"],
        "limit": 20
    }
    response = requests.get(BASE_URL, params=params)
    return response.json()["articles"]

# Get single article with citations
def get_article_with_citations(article_id):
    response = requests.get(f"{BASE_URL}/{article_id}")
    response.raise_for_status()

    article = response.json()

    # Extract citations
    sources = article.get("enhancementMetadata", {}).get("sources", [])
    key_points = article.get("enhancementMetadata", {}).get("structuredContent", {}).get("keyPoints", [])

    return {
        "article": article,
        "citations": sources,
        "key_points": key_points
    }

# Paginate through all articles
def get_all_articles(category=None):
    page = 0
    all_articles = []

    while True:
        articles, total = get_articles(category=category, page=page)
        all_articles.extend(articles)

        if len(all_articles) >= total:
            break
        page += 1

    return all_articles
```

### cURL

```bash
# List latest articles
curl "https://hki.zone/api/unified/articles?limit=5"

# Filter by category
curl "https://hki.zone/api/unified/articles?category=business&limit=10"

# Get AI-enhanced articles with images
curl "https://hki.zone/api/unified/articles?type=ai_generated&features=has_image"

# Search articles
curl "https://hki.zone/api/unified/articles?search=tech%20startup"

# Get single article
curl "https://hki.zone/api/unified/articles/550e8400-e29b-41d4-a716-446655440000"

# Paginate results
curl "https://hki.zone/api/unified/articles?page=2&limit=20"
```

---

## Best Practices

### Caching

- Cache list responses for **5-15 minutes** (articles update every 15 minutes)
- Cache individual articles for **30 minutes** (content rarely changes after publication)
- Use `publishedAt` timestamp to detect updates

### Pagination

- Use `page` and `limit` for offset-based pagination
- Check `hasMore` to determine if more pages exist
- `nextPage` provides the next page number (or `null` if no more pages)

### Filtering for Quality Content

```typescript
// Get only AI-enhanced articles with images
const params = {
  type: 'ai_generated',
  features: ['has_image', 'has_ai_content'],
  status: 'published'
};
```

### Accessing Citations

```typescript
// Always check if enhancementMetadata exists
const sources = article.enhancementMetadata?.sources || [];
const keyPoints = article.enhancementMetadata?.structuredContent?.keyPoints || [];
```

---

## Rate Limits

Currently no rate limits are enforced. Please be respectful of server resources:

- Limit requests to **60 per minute** for list endpoints
- Limit requests to **120 per minute** for single article endpoints
- Use caching to reduce unnecessary requests

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01 | Initial API release |

---

## Support

For API issues or feature requests, please open an issue at:
https://github.com/masstransitco/hki-zone/issues
