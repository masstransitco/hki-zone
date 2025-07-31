#!/bin/bash

echo "🧪 Testing local enhancement implementation..."
echo ""

# First, mark some articles for enhancement if none exist
echo "📋 Checking for articles pending enhancement..."
PENDING=$(psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -t -c "SELECT COUNT(*) FROM articles WHERE selected_for_enhancement = true AND is_ai_enhanced = false;")

if [ "$PENDING" -eq "0" ]; then
  echo "No articles pending. Let me mark some for enhancement..."
  psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "
    UPDATE articles 
    SET selected_for_enhancement = true,
        selection_metadata = jsonb_build_object(
          'selected_at', NOW(),
          'selection_reason', 'Manual test selection',
          'priority_score', 85
        )
    WHERE is_ai_enhanced = false 
      AND source != 'perplexity'
      AND created_at > NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC
    LIMIT 3
    RETURNING id, title;
  "
fi

echo ""
echo "🚀 Triggering local enhancement endpoint..."
echo "URL: http://localhost:3001/api/cron/enhance-selected"
echo ""

# Add a unique identifier to track this specific run
RUN_ID="test_$(date +%s)"
echo "Run ID: $RUN_ID"
echo ""

# Call the endpoint
RESPONSE=$(curl -X POST http://localhost:3001/api/cron/enhance-selected \
  -H "Authorization: Bearer test-secret" \
  -H "User-Agent: vercel-cron/1.0" \
  -H "X-Test-Run-Id: $RUN_ID" \
  -s)

echo "Response: $RESPONSE"
echo ""

# Wait a moment for processing
echo "⏳ Waiting 5 seconds for processing..."
sleep 5

# Check if new articles were created
echo ""
echo "📊 Checking for newly enhanced articles..."
psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "
  SELECT 
    id,
    title,
    enhancement_metadata->>'language' as language,
    enhancement_metadata->>'one_shot_generation' as one_shot,
    created_at
  FROM articles 
  WHERE is_ai_enhanced = true 
    AND created_at > NOW() - INTERVAL '1 minute'
  ORDER BY created_at DESC
  LIMIT 9;
"

echo ""
echo "🔍 Checking enhancement metadata for one-shot flag..."
psql "postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "
  SELECT 
    CASE 
      WHEN enhancement_metadata->>'one_shot_generation' = 'true' THEN '✅ One-shot'
      ELSE '❌ Sequential'
    END as method,
    COUNT(*) as count
  FROM articles 
  WHERE is_ai_enhanced = true 
    AND created_at > NOW() - INTERVAL '5 minutes'
  GROUP BY enhancement_metadata->>'one_shot_generation';
"