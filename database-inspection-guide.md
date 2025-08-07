# Database Inspection Workflow Guide

## Overview
This guide provides direct database query commands for investigating, debugging, and analyzing the Supabase PostgreSQL database without requiring a running development server.

## Connection Details
- **Database**: Supabase PostgreSQL
- **Access**: Direct connection via `psql` command
- **Requirements**: PostgreSQL client installed locally
- **Independence**: Works without dev server or application running

## Base Connection Command
```bash
PGPASSWORD=ZHrt2ilBHk0o3TA5 psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
```

---

## Common Inspection Scenarios

### 1. Source Investigation (Adding New Source Filters)

#### Check if specific sources exist
```bash
PGPASSWORD=ZHrt2ilBHk0o3TA5 psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "SELECT source, COUNT(*) as article_count FROM articles WHERE source IN ('SCMP', 'AM730', 'Bloomberg') GROUP BY source ORDER BY article_count DESC;"
```

#### Get complete source overview
```bash
PGPASSWORD=ZHrt2ilBHk0o3TA5 psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "SELECT source, COUNT(*) as article_count FROM articles GROUP BY source ORDER BY article_count DESC LIMIT 20;"
```

#### Search for partial source matches (case-insensitive)
```bash
PGPASSWORD=ZHrt2ilBHk0o3TA5 psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "SELECT source, COUNT(*) as article_count FROM articles WHERE source ILIKE '%scmp%' GROUP BY source ORDER BY article_count DESC;"
```

### 2. Article Content Analysis

#### Check recent articles from specific source
```bash
PGPASSWORD=ZHrt2ilBHk0o3TA5 psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "SELECT title, source, created_at FROM articles WHERE source = 'scmp' ORDER BY created_at DESC LIMIT 5;"
```

#### Check AI enhanced articles by source
```bash
PGPASSWORD=ZHrt2ilBHk0o3TA5 psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "SELECT source, is_ai_enhanced, COUNT(*) FROM articles WHERE source IN ('scmp', 'bloomberg') GROUP BY source, is_ai_enhanced ORDER BY source, is_ai_enhanced;"
```

#### Get articles with specific categories
```bash
PGPASSWORD=ZHrt2ilBHk0o3TA5 psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "SELECT category, COUNT(*) as article_count FROM articles GROUP BY category ORDER BY article_count DESC;"
```

### 3. Data Quality Inspection

#### Check for articles without summaries
```bash
PGPASSWORD=ZHrt2ilBHk0o3TA5 psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "SELECT source, COUNT(*) as no_summary_count FROM articles WHERE (summary IS NULL OR summary = '') GROUP BY source ORDER BY no_summary_count DESC;"
```

#### Check for articles without images
```bash
PGPASSWORD=ZHrt2ilBHk0o3TA5 psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "SELECT source, COUNT(*) as no_image_count FROM articles WHERE (image_url IS NULL OR image_url = '' OR image_url LIKE '%placeholder%') GROUP BY source ORDER BY no_image_count DESC;"
```

#### Check language distribution for AI enhanced articles
```bash
PGPASSWORD=ZHrt2ilBHk0o3TA5 psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "SELECT enhancement_metadata->>'language' as language, COUNT(*) FROM articles WHERE is_ai_enhanced = true GROUP BY enhancement_metadata->>'language' ORDER BY COUNT(*) DESC;"
```

### 4. News Brief Pipeline Analysis

#### Check government signals processing status
```bash
PGPASSWORD=ZHrt2ilBHk0o3TA5 psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "SELECT feed_group, COUNT(*) as signal_count, COUNT(CASE WHEN processing_status = 'content_complete' THEN 1 END) as complete_count, ROUND(100.0 * COUNT(CASE WHEN processing_status = 'content_complete' THEN 1 END) / COUNT(*), 1) as complete_pct FROM government_signals GROUP BY feed_group ORDER BY signal_count DESC LIMIT 15;"
```

#### Check feed source status
```bash
PGPASSWORD=ZHrt2ilBHk0o3TA5 psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "SELECT feed_group, department, feed_type, active, last_successful_fetch, fetch_error_count FROM government_feed_sources ORDER BY department, feed_group;"
```

#### Check recent news briefs
```bash
PGPASSWORD=ZHrt2ilBHk0o3TA5 psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "SELECT id, language, word_count, created_at, audio_url IS NOT NULL as has_audio FROM news_briefs ORDER BY created_at DESC LIMIT 10;"
```

### 5. System Performance Monitoring

#### Check daily article ingestion
```bash
PGPASSWORD=ZHrt2ilBHk0o3TA5 psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "SELECT DATE(created_at) as date, COUNT(*) as articles_added FROM articles WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' GROUP BY DATE(created_at) ORDER BY date DESC;"
```

#### Check AI enhancement progress
```bash
PGPASSWORD=ZHrt2ilBHk0o3TA5 psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "SELECT COUNT(*) as total_articles, COUNT(CASE WHEN is_ai_enhanced = true THEN 1 END) as enhanced_articles, COUNT(CASE WHEN selected_for_enhancement = true THEN 1 END) as selected_articles, ROUND(100.0 * COUNT(CASE WHEN is_ai_enhanced = true THEN 1 END) / COUNT(*), 1) as enhancement_percentage FROM articles;"
```

---

## Quick Reference Commands

### Interactive Database Session
```bash
PGPASSWORD=ZHrt2ilBHk0o3TA5 psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
```

### Execute Single Query
```bash
PGPASSWORD=ZHrt2ilBHk0o3TA5 psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "YOUR_SQL_QUERY_HERE;"
```

### Save Query Results to File
```bash
PGPASSWORD=ZHrt2ilBHk0o3TA5 psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "YOUR_SQL_QUERY_HERE;" > results.txt
```

---

## Installation Requirements

### macOS
```bash
brew install postgresql
```

### Ubuntu/Debian
```bash
sudo apt-get install postgresql-client
```

### Windows
```bash
choco install postgresql
```

---

## Important Notes

### Security
- This file contains sensitive database credentials
- Never commit this file to version control
- Use environment variables in production scripts
- Consider using read-only database users for investigation

### Performance
- Always use `LIMIT` clauses for large datasets
- Be cautious with `UPDATE` and `DELETE` operations
- Monitor query execution time on production data

### Best Practices
- Test queries on development data first
- Use transactions for multiple related operations
- Document any schema discoveries or insights
- Keep queries readable with proper formatting

---

## Troubleshooting

### Connection Issues
- Verify internet connectivity
- Check if `psql` is installed: `psql --version`
- Confirm database credentials are current
- Test with simple query: `SELECT NOW();`

### Query Issues
- Use `EXPLAIN` to analyze slow queries
- Check table schemas: `\d table_name` in interactive mode
- Verify column names and data types
- Use `LIMIT 1` to test query structure before full execution

---

## Example Workflow: Adding New Source Filter

1. **Check if source exists in database**
   ```bash
   PGPASSWORD=ZHrt2ilBHk0o3TA5 psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "SELECT source, COUNT(*) FROM articles WHERE source ILIKE '%newsource%' GROUP BY source;"
   ```

2. **Get exact source name and count**
   ```bash
   PGPASSWORD=ZHrt2ilBHk0o3TA5 psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "SELECT source FROM articles WHERE source ILIKE '%newsource%' LIMIT 1;"
   ```

3. **Update frontend filter dropdown** with exact database value

4. **Test filtering** with sample query to verify

This workflow ensures frontend filters match database reality, preventing empty results due to case or naming mismatches.