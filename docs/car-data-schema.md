# Car Data Schema & Materialized Views

## Overview

Car listings in HKI Zone are stored in the `articles` table with `category = 'cars'` and `source = '28car'`. The data is scraped from 28car.com and enriched with AI-generated insights. Materialized views provide pre-computed feeds for different user segments.

## Data Source

- **Source**: 28car.com (Hong Kong's largest used car marketplace)
- **Scraping Frequency**: Continuous via scheduled scraper
- **Volume**: ~277 new listings per day average
- **Data Freshness**: New listings appear within minutes of being posted

## Base Table Schema

### `articles` Table (Car Records)

Car listings are stored in the main `articles` table with car-specific columns:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `title` | text | Listing title (usually make + model + year) |
| `url` | text | Original 28car listing URL |
| `source` | text | Always `'28car'` for car listings |
| `category` | text | Always `'cars'` for car listings |
| `created_at` | timestamptz | When scraped into system |
| `published_at` | timestamptz | Original posting date on 28car |
| `image_url` | text | Primary listing image URL |
| `images` | jsonb | Array of all image URLs |
| `specs` | jsonb | Raw specifications from 28car |
| `content` | text | Full listing description |
| `summary` | text | AI-generated summary |
| `make` | text | Computed: Car manufacturer (generated column) |
| `model` | text | Computed: Car model (generated column) |
| `search_text` | tsvector | Full-text search vector (trigger-updated) |

### Structured Car Fields

These fields are extracted/computed from the raw `specs` JSONB:

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `price_hkd` | integer | `specs->>'售價'` | Price in HKD (parsed from string) |
| `view_count` | integer | `specs->>'瀏覽'` | Listing view count on 28car |
| `is_first_owner` | boolean | `specs->>'手數'` | True if "0首" (first owner) |
| `year` | integer | `specs->>'年份'` | Manufacturing year |
| `mileage_km` | integer | `specs->>'里數'` | Odometer reading in km |
| `transmission` | text | `specs->>'波箱'` | Auto/Manual transmission |
| `fuel_type` | text | `specs->>'燃料'` | Petrol/Diesel/Electric/Hybrid |
| `engine_cc` | integer | `specs->>'容積'` | Engine displacement in cc |
| `color` | text | `specs->>'顏色'` | Exterior color |
| `seats` | integer | `specs->>'座位'` | Number of seats |

### Computed/Enriched Fields

| Field | Type | Description |
|-------|------|-------------|
| `make` | text | Generated column: Extracted from `specs->>'車廠'` or parsed from title |
| `model` | text | Generated column: Extracted from `specs->>'型號'` or parsed from title |
| `value_score` | float | AI-computed value rating (price vs. condition/specs) |
| `ai_summary` | text | AI-generated listing summary |
| `ai_insights` | jsonb | AI analysis (pros, cons, market position) |

## Specs JSONB Structure

The `specs` column contains raw data from 28car in Chinese:

```json
{
  "車廠": "Toyota",
  "型號": "Alphard",
  "年份": "2020",
  "售價": "$380,000",
  "里數": "45,000 km",
  "手數": "1首",
  "波箱": "自動波",
  "燃料": "汽油",
  "容積": "2,500 cc",
  "顏色": "白色",
  "座位": "7",
  "瀏覽": "1,234"
}
```

### Common Spec Keys (Chinese → English)

| Chinese Key | English | Values |
|-------------|---------|--------|
| 車廠 | Make | Toyota, Honda, BMW, Mercedes-Benz, etc. |
| 型號 | Model | Alphard, Civic, 3 Series, C-Class, etc. |
| 年份 | Year | 2015-2024 |
| 售價 | Price | "$50,000" - "$2,000,000+" |
| 里數 | Mileage | "10,000 km" - "200,000 km" |
| 手數 | Owners | "0首", "1首", "2首", "3首+" |
| 波箱 | Transmission | "自動波" (Auto), "棍波" (Manual) |
| 燃料 | Fuel | "汽油" (Petrol), "柴油" (Diesel), "電動" (EV), "混能" (Hybrid) |
| 容積 | Engine | "1,500 cc", "2,000 cc", "3,000 cc", etc. |
| 顏色 | Color | "白色", "黑色", "銀色", etc. |
| 座位 | Seats | "2", "4", "5", "7" |
| 瀏覽 | Views | View count number |

## Materialized Views

### Feed Views

Pre-computed views for different user segments, refreshed on schedule:

#### `mv_cars_hot_deals`
**Purpose**: High-engagement listings with good value
**Refresh**: Every 4 hours
**Criteria**:
- High view count relative to listing age
- Good value score (if enriched)
- Recent listings prioritized

```sql
CREATE MATERIALIZED VIEW mv_cars_hot_deals AS
SELECT
  id, title, url, source, created_at, image_url, images,
  price_hkd, view_count, is_first_owner, value_score,
  make, model, specs, ai_summary,
  (view_count::float / GREATEST(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400, 1)) as views_per_day
FROM articles
WHERE category = 'cars'
  AND source = '28car'
  AND price_hkd IS NOT NULL
  AND view_count > 100
ORDER BY views_per_day DESC, value_score DESC NULLS LAST
LIMIT 100;
```

#### `mv_cars_first_owner`
**Purpose**: Premium single-owner vehicles
**Refresh**: Every 12 hours
**Criteria**:
- `is_first_owner = true` (0首)
- Typically higher-end vehicles
- Lower mileage preferred

```sql
CREATE MATERIALIZED VIEW mv_cars_first_owner AS
SELECT
  id, title, url, source, created_at, image_url, images,
  price_hkd, view_count, is_first_owner, value_score,
  make, model, specs, ai_summary
FROM articles
WHERE category = 'cars'
  AND source = '28car'
  AND is_first_owner = true
ORDER BY created_at DESC
LIMIT 100;
```

#### `mv_cars_budget`
**Purpose**: Affordable cars under HK$50,000
**Refresh**: Every 12 hours
**Criteria**:
- `price_hkd` between 10,000 and 50,000
- Within last 60 days (prevents expired image URLs)
- Minimum 10 views (filters low-quality listings)

```sql
CREATE MATERIALIZED VIEW mv_cars_budget AS
SELECT
  id, title, url, price_hkd, view_count, is_first_owner,
  created_at, images, description_text, value_score,
  split_part(title, ' ', 1) AS make_zh
FROM articles_unified
WHERE source = '28car'
  AND category = 'cars'
  AND price_hkd < 50000
  AND price_hkd > 10000
  AND view_count > 10
  AND created_at > NOW() - INTERVAL '60 days'
ORDER BY value_score DESC NULLS LAST, created_at DESC
LIMIT 100;
```

#### `mv_cars_enthusiast`
**Purpose**: Sports and performance vehicles
**Refresh**: Every 12 hours
**Criteria**:
- Sports car makes/models (GT86, STI, Type R, AMG, M3/M4, 911, etc.)
- High-performance variants
- Within last 60 days (prevents expired image URLs)

```sql
CREATE MATERIALIZED VIEW mv_cars_enthusiast AS
SELECT
  id, title, url, price_hkd, view_count, is_first_owner,
  created_at, images, description_text, value_score,
  split_part(title, ' ', 1) AS make_zh
FROM articles_unified
WHERE source = '28car'
  AND category = 'cars'
  AND created_at > NOW() - INTERVAL '60 days'
  AND (
    title ~* '(GT86|GR86|STI|WRX|Type.?R|AMG|M3|M4|M5|911|Carrera|GTI|RS[0-9]|Cooper.?S|GTR|NSX|Supra|MX-5|Miata|S2000|86|BRZ)'
    OR title ~* '(法拉利|蘭博|保時捷|麥拉倫|阿斯頓|瑪莎拉蒂)'
  )
ORDER BY created_at DESC, view_count DESC
LIMIT 100;
```

#### `mv_cars_trending`
**Purpose**: Rising stars with high views-per-day
**Refresh**: Every 2 hours
**Criteria**:
- Listed within last 7 days
- High views relative to age
- Momentum indicator

```sql
CREATE MATERIALIZED VIEW mv_cars_trending AS
SELECT
  id, title, url, source, created_at, image_url, images,
  price_hkd, view_count, is_first_owner, value_score,
  make, model, specs, ai_summary,
  (view_count::float / GREATEST(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400, 0.5)) as views_per_day
FROM articles
WHERE category = 'cars'
  AND source = '28car'
  AND created_at > NOW() - INTERVAL '7 days'
  AND view_count > 50
ORDER BY views_per_day DESC
LIMIT 100;
```

#### `mv_cars_new_today`
**Purpose**: Fresh listings from last 24 hours
**Refresh**: Every 2 hours
**Criteria**:
- `created_at > NOW() - INTERVAL '24 hours'`
- Most recent first
- Limit 250 (captures full daily volume of ~225 listings)

```sql
CREATE MATERIALIZED VIEW mv_cars_new_today AS
SELECT
  id, title, url, price_hkd, view_count, is_first_owner,
  created_at, images, description_text, value_score,
  split_part(title, ' ', 1) AS make_zh
FROM articles_unified
WHERE source = '28car'
  AND category = 'cars'
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 250;
```

#### `mv_cars_electric`
**Purpose**: Electric vehicles and hybrids
**Refresh**: Every 6 hours
**Criteria**:
- Pure EVs: Tesla, BYD, Nio, Polestar, e-tron, iX, EQS, etc.
- Hybrids: Prius, Aqua, PHEV, e-Power models
- Within last 60 days

```sql
CREATE MATERIALIZED VIEW mv_cars_electric AS
SELECT
  id, title, url, price_hkd, view_count, is_first_owner,
  created_at, images, description_text, value_score,
  split_part(title, ' ', 1) AS make_zh,
  CASE
    WHEN title ~* '(Tesla|特斯拉|Model [3SXY]|BYD|比亞迪|Nio|蔚來|Polestar|極星|e-tron|iX|EQS|EQE|EV6|Ioniq|ID\.[34])' THEN 'EV'
    ELSE 'Hybrid'
  END as powertrain_type
FROM articles_unified
WHERE source = '28car'
  AND category = 'cars'
  AND created_at > NOW() - INTERVAL '60 days'
  AND (
    title ~* '(Tesla|特斯拉|Model [3SXY]|BYD|比亞迪|Nio|蔚來|Polestar|極星|e-tron|iX|EQS|EQE|EV6|Ioniq|ID\.[34])'
    OR title ~* '(Hybrid|混能|油電|e-Power|PHEV|插電|Prius|Aqua)'
  )
ORDER BY created_at DESC, view_count DESC
LIMIT 100;
```

#### `mv_cars_midrange`
**Purpose**: Best value in the popular HK$50,000-100,000 price range
**Refresh**: Every 6 hours
**Criteria**:
- Price between HK$50,000 and HK$100,000
- Largest market segment (~1,700 listings/month)
- Sorted by value score

```sql
CREATE MATERIALIZED VIEW mv_cars_midrange AS
SELECT
  id, title, url, price_hkd, view_count, is_first_owner,
  created_at, images, description_text, value_score,
  split_part(title, ' ', 1) AS make_zh
FROM articles_unified
WHERE source = '28car'
  AND category = 'cars'
  AND price_hkd >= 50000
  AND price_hkd < 100000
  AND created_at > NOW() - INTERVAL '60 days'
ORDER BY value_score DESC NULLS LAST, view_count DESC
LIMIT 100;
```

#### `mv_cars_luxury`
**Purpose**: Premium vehicles over HK$500,000
**Refresh**: Every 12 hours
**Criteria**:
- Price >= HK$500,000
- High-end luxury and exotic cars
- Within last 60 days

```sql
CREATE MATERIALIZED VIEW mv_cars_luxury AS
SELECT
  id, title, url, price_hkd, view_count, is_first_owner,
  created_at, images, description_text, value_score,
  split_part(title, ' ', 1) AS make_zh
FROM articles_unified
WHERE source = '28car'
  AND category = 'cars'
  AND price_hkd >= 500000
  AND created_at > NOW() - INTERVAL '60 days'
ORDER BY created_at DESC, view_count DESC
LIMIT 100;
```

### Statistics Views

#### `mv_cars_stats`
**Purpose**: Dashboard statistics and metrics
**Refresh**: Every 4 hours

```sql
CREATE MATERIALIZED VIEW mv_cars_stats AS
SELECT
  COUNT(*) as total_listings,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d,

  -- Price ranges
  COUNT(*) FILTER (WHERE price_hkd < 50000) as budget_count,
  COUNT(*) FILTER (WHERE price_hkd BETWEEN 50000 AND 99999) as mid_low_count,
  COUNT(*) FILTER (WHERE price_hkd BETWEEN 100000 AND 199999) as mid_count,
  COUNT(*) FILTER (WHERE price_hkd BETWEEN 200000 AND 499999) as premium_count,
  COUNT(*) FILTER (WHERE price_hkd >= 500000) as luxury_count,

  -- Quality metrics
  COUNT(*) FILTER (WHERE is_first_owner = true) as first_owner_count,
  COUNT(*) FILTER (WHERE view_count > 500) as high_engagement,
  COUNT(*) FILTER (WHERE ai_summary IS NOT NULL) as enriched_count,

  -- Averages
  AVG(view_count) as avg_views,
  AVG(price_hkd) FILTER (WHERE price_hkd > 0) as avg_price,

  -- Metadata
  MAX(created_at) as last_listing_at,
  NOW() as refreshed_at
FROM articles
WHERE category = 'cars' AND source = '28car';
```

#### `mv_cars_top_makes`
**Purpose**: Popular makes with counts and averages
**Refresh**: Every 6 hours

```sql
CREATE MATERIALIZED VIEW mv_cars_top_makes AS
SELECT
  make as make_zh,
  COUNT(*) as count,
  AVG(price_hkd) FILTER (WHERE price_hkd > 0) as avg_price,
  AVG(view_count) as avg_views
FROM articles
WHERE category = 'cars'
  AND source = '28car'
  AND make IS NOT NULL
  AND make != ''
GROUP BY make
ORDER BY count DESC
LIMIT 20;
```

## Indexes

### Full-Text Search
```sql
-- Trigram extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Full-text search vector index
CREATE INDEX idx_articles_search_text ON articles USING gin (search_text)
WHERE category = 'cars';

-- Trigram indexes for prefix/fuzzy matching
CREATE INDEX idx_articles_make_trgm ON articles USING gin (make gin_trgm_ops)
WHERE category = 'cars';

CREATE INDEX idx_articles_model_trgm ON articles USING gin (model gin_trgm_ops)
WHERE category = 'cars';
```

### Performance Indexes
```sql
-- Category + date for feed queries
CREATE INDEX idx_articles_cars_category_created ON articles(category, created_at DESC)
WHERE category = 'cars';

-- Price-based queries
CREATE INDEX idx_articles_cars_price ON articles((specs->>'售價'))
WHERE category = 'cars';

-- Year-based queries
CREATE INDEX idx_articles_cars_year ON articles((specs->>'年份'))
WHERE category = 'cars';

-- JSONB indexes for specs
CREATE INDEX idx_articles_images ON articles USING gin(images)
WHERE category = 'cars';

CREATE INDEX idx_articles_specs ON articles USING gin(specs)
WHERE category = 'cars';
```

## Search Functions

### `search_car_listings(search_query, limit, offset)`

Main search function with ranking:

```sql
SELECT * FROM search_car_listings('Toyota Alphard', 30, 0);
```

Returns: id, title, make, model, price, year, image_url, images, url, created_at, specs, rank

### `get_car_suggestions(search_query, limit)`

Autocomplete suggestions:

```sql
SELECT * FROM get_car_suggestions('Toy', 10);
```

Returns: suggestion, type ('make' or 'model'), count

### `get_car_filters()`

Available filter options for UI:

```sql
SELECT * FROM get_car_filters();
```

Returns: makes (jsonb array), years (jsonb array), price_ranges (jsonb object)

## Data Flow

```
┌─────────────────┐
│   28car.com     │
│  (Source Site)  │
└────────┬────────┘
         │ Scrape
         ▼
┌─────────────────┐
│    Scraper      │
│  (Scheduled)    │
└────────┬────────┘
         │ Insert
         ▼
┌─────────────────┐
│ articles table  │
│ (category=cars) │
└────────┬────────┘
         │ Trigger
         ▼
┌─────────────────┐
│  search_text    │
│  (tsvector)     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌───────────┐
│ Feeds │ │ AI Enrich │
│ (MV)  │ │ (Optional)│
└───────┘ └───────────┘
```

## Refresh Schedule Summary

| View | Interval | Rationale |
|------|----------|-----------|
| mv_cars_new_today | 2 hours | High-frequency new listings |
| mv_cars_trending | 2 hours | View counts change frequently |
| mv_cars_hot_deals | 4 hours | Engagement metrics update |
| mv_cars_stats | 4 hours | Dashboard stats |
| mv_cars_electric | 6 hours | EV/Hybrid segment, moderate churn |
| mv_cars_midrange | 6 hours | Popular price segment |
| mv_cars_top_makes | 6 hours | Aggregate data, slow-changing |
| mv_cars_first_owner | 12 hours | Ownership rarely changes |
| mv_cars_budget | 12 hours | Price-based, stable |
| mv_cars_enthusiast | 12 hours | Niche segment |
| mv_cars_luxury | 12 hours | Premium segment, low volume |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/cars/feeds` | GET | List feeds or fetch specific feed |
| `/api/admin/cars/feeds` | POST | Refresh all materialized views |
| `/api/admin/cars/stats` | GET | Dashboard statistics |
| `/api/admin/cars/stats` | POST | Refresh stats view |
| `/api/admin/cars/refresh-schedule` | GET | View refresh schedules |
| `/api/admin/cars/refresh-schedule` | POST | Trigger manual refresh |
| `/api/admin/cars/refresh-schedule` | PATCH | Enable/disable schedule |

## Related Documentation

- [Car Feed Refresh Schedule](./car-feed-refresh-schedule.md) - Automated refresh system details
