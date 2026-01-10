# Car Feed Refresh Schedule Implementation

## Overview

The car feed refresh system automates the periodic refresh of PostgreSQL materialized views that power the car listings feeds on HKI Zone. It uses `pg_cron` for scheduling and provides a management UI in the admin dashboard.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Admin Dashboard                          │
│                     /admin/cars page                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            Refresh Schedule Panel                        │   │
│  │  • View schedules, intervals, last/next refresh          │   │
│  │  • Manual refresh triggers                               │   │
│  │  • Enable/disable toggles                                │   │
│  │  • Recent refresh logs                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                           │
│              /api/admin/cars/refresh-schedule                   │
│  • GET  - Fetch schedule status                                 │
│  • POST - Trigger manual refresh                                │
│  • PATCH - Update schedule settings                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Supabase/PostgreSQL                         │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │  pg_cron jobs    │  │ Schedule Tables  │                    │
│  │  (8 scheduled)   │  │ & Functions      │                    │
│  └────────┬─────────┘  └────────┬─────────┘                    │
│           │                     │                               │
│           ▼                     ▼                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Materialized Views                           │  │
│  │  mv_cars_hot_deals, mv_cars_first_owner, mv_cars_budget  │  │
│  │  mv_cars_enthusiast, mv_cars_trending, mv_cars_new_today │  │
│  │  mv_cars_stats, mv_cars_top_makes                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

### Tables

#### `car_feed_refresh_schedule`

Tracks configuration and status for each scheduled view refresh.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `view_name` | varchar(100) | Materialized view name (e.g., `mv_cars_hot_deals`) |
| `display_name` | varchar(100) | Human-readable name |
| `description` | text | Description of the feed |
| `refresh_interval_hours` | integer | Refresh frequency in hours |
| `cron_expression` | varchar(50) | pg_cron schedule expression |
| `last_refreshed_at` | timestamptz | Last successful refresh time |
| `next_refresh_at` | timestamptz | Calculated next refresh time |
| `is_enabled` | boolean | Whether auto-refresh is enabled |
| `avg_refresh_duration_ms` | integer | Rolling average refresh duration |
| `refresh_count` | integer | Total number of refreshes |
| `last_error` | text | Last error message (if any) |
| `created_at` | timestamptz | Record creation time |
| `updated_at` | timestamptz | Last update time |

#### `car_feed_refresh_log`

Stores history of all refresh operations for auditing and debugging.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `view_name` | varchar(100) | View that was refreshed |
| `started_at` | timestamptz | Refresh start time |
| `completed_at` | timestamptz | Refresh completion time |
| `duration_ms` | integer | Refresh duration in milliseconds |
| `success` | boolean | Whether refresh succeeded |
| `error_message` | text | Error details if failed |
| `triggered_by` | varchar(50) | `cron`, `manual`, or `api` |
| `rows_before` | integer | Row count before refresh |
| `rows_after` | integer | Row count after refresh |

### Functions

#### `refresh_car_view(p_view_name, p_triggered_by)`

Refreshes a single materialized view with logging.

```sql
SELECT refresh_car_view('mv_cars_hot_deals', 'manual');
```

Returns: JSON with `success`, `duration_ms`, `view_name`

#### `refresh_all_car_views(p_triggered_by)`

Refreshes all enabled car feed views sequentially.

```sql
SELECT refresh_all_car_views('manual');
```

Returns: JSON with `views_refreshed`, `total_duration_ms`, `results[]`

#### `get_car_feed_refresh_status()`

Returns current status of all schedules with computed fields.

```sql
SELECT * FROM get_car_feed_refresh_status();
```

Returns: JSON with:
- `schedules[]` - All schedule records with `is_overdue` and `minutes_until_next`
- `recent_logs[]` - Last 20 refresh log entries
- `fetched_at` - Timestamp of the query

## Scheduled Jobs (pg_cron)

| Job Name | View | Cron Expression | Frequency | Rationale |
|----------|------|-----------------|-----------|-----------|
| `refresh_car_new_today` | mv_cars_new_today | `0 */2 * * *` | Every 2h | High-frequency new listings |
| `refresh_car_trending` | mv_cars_trending | `30 */2 * * *` | Every 2h at :30 | View counts change frequently |
| `refresh_car_hot_deals` | mv_cars_hot_deals | `0 */4 * * *` | Every 4h | Engagement metrics update |
| `refresh_car_stats` | mv_cars_stats | `15 */4 * * *` | Every 4h at :15 | Dashboard stats |
| `refresh_car_top_makes` | mv_cars_top_makes | `0 */6 * * *` | Every 6h | Aggregate data, slow-changing |
| `refresh_car_first_owner` | mv_cars_first_owner | `0 */12 * * *` | Every 12h | Rarely changes |
| `refresh_car_budget` | mv_cars_budget | `30 */12 * * *` | Every 12h at :30 | Price-based, stable |
| `refresh_car_enthusiast` | mv_cars_enthusiast | `0 0,12 * * *` | 8am & 8pm HKT | Niche segment |

**Note:** Times are staggered to prevent concurrent heavy database operations.

## API Endpoints

### `GET /api/admin/cars/refresh-schedule`

Fetches current schedule status and recent logs.

**Response:**
```json
{
  "schedules": [
    {
      "view_name": "mv_cars_hot_deals",
      "display_name": "Hot Deals",
      "description": "High engagement listings with good value scores",
      "refresh_interval_hours": 4,
      "cron_expression": "0 */4 * * *",
      "last_refreshed_at": "2024-01-10T08:00:00Z",
      "next_refresh_at": "2024-01-10T12:00:00Z",
      "is_enabled": true,
      "avg_refresh_duration_ms": 1250,
      "refresh_count": 42,
      "last_error": null,
      "is_overdue": false,
      "minutes_until_next": 180
    }
  ],
  "recent_logs": [...],
  "fetched_at": "2024-01-10T09:00:00Z"
}
```

### `POST /api/admin/cars/refresh-schedule`

Triggers a manual refresh.

**Request (single view):**
```json
{
  "view_name": "mv_cars_hot_deals"
}
```

**Request (all views):**
```json
{
  "refresh_all": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "mv_cars_hot_deals refreshed successfully",
  "duration_ms": 1340
}
```

### `PATCH /api/admin/cars/refresh-schedule`

Updates schedule settings (enable/disable).

**Request:**
```json
{
  "view_name": "mv_cars_budget",
  "is_enabled": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Schedule for mv_cars_budget updated"
}
```

## Admin UI Components

The Refresh Schedule panel in `/admin/cars` includes:

### Header (Collapsed View)
- Calendar icon with "Refresh Schedule" title
- Badge showing count of overdue schedules
- Chevron indicator for expand/collapse

### Expanded View

#### Quick Actions
- **Refresh Status** - Reloads schedule data from API
- **Refresh All Views** - Triggers manual refresh of all enabled views

#### Schedule Table
| Column | Description |
|--------|-------------|
| View | Icon, display name, and description |
| Interval | Hours between refreshes + cron expression |
| Last Refresh | Timestamp of last successful refresh |
| Next Refresh | Expected next refresh time, shows "Overdue" in red if past |
| Status | Toggle switch to enable/disable the schedule |
| Actions | Manual refresh button for individual view |

#### Recent Logs
- Shows last 10 refresh operations
- Color-coded success (green) / failure (red)
- Displays view name, duration, trigger source, and timestamp

#### Summary Footer
- Count of enabled schedules
- Total refresh count across all views
- Last status update timestamp

## Usage

### Monitoring

1. Navigate to `/admin/cars`
2. Click "Refresh Schedule" panel to expand
3. Check for overdue views (red "Overdue" status)
4. Review recent logs for failures

### Manual Refresh

For immediate data updates:
1. Click refresh icon on individual view row, OR
2. Click "Refresh All Views" for complete refresh

### Disabling Schedules

To temporarily stop auto-refresh:
1. Click the toggle switch in the Status column
2. Toggle turns gray when disabled
3. pg_cron job still runs but skips disabled views

## Troubleshooting

### Views Not Refreshing

1. Check if schedule is enabled (toggle should be green)
2. Verify pg_cron extension is enabled: `SELECT * FROM cron.job;`
3. Check recent logs for error messages
4. Verify database connection in Supabase dashboard

### High Refresh Duration

1. Check `avg_refresh_duration_ms` in schedule table
2. Consider adding indexes to underlying tables
3. Review materialized view query complexity
4. Check for table bloat: `VACUUM ANALYZE articles_unified;`

### Overdue Schedules

1. pg_cron may be paused during maintenance
2. Check Supabase status page for incidents
3. Manually trigger refresh to catch up
4. Logs will show `triggered_by: 'manual'` vs `'cron'`

## Future Enhancements

- [ ] Email/Slack alerts for failed refreshes
- [ ] Configurable refresh intervals via UI
- [ ] Refresh duration trending charts
- [ ] Automatic retry on failure
- [ ] Health check endpoint for monitoring services
