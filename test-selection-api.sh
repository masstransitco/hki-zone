#!/bin/bash

# Test the article selection with deduplication via API
echo "🧪 Testing Article Selection with Deduplication"
echo "=============================================="
echo ""

# Make sure the server is running
echo "📡 Calling article selection API..."
echo ""

# Call the selection API
curl -X POST http://localhost:3000/api/cron/select-article \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  | python3 -m json.tool

echo ""
echo "✅ Test complete! Check the logs above for deduplication statistics."