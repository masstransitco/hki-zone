#!/bin/bash

echo "🧪 Testing One-Shot Enhancement via API Endpoint"
echo ""

# Create a test API route that uses our one-shot enhancement
cat > app/api/test-oneshot/route.ts << 'EOF'
import { NextResponse } from 'next/server';
import { perplexityEnhancerV2 } from '@/lib/perplexity-enhancer-v2';

export async function POST() {
  const testArticle = {
    title: "Test: Hong Kong startup ecosystem grows in 2025",
    content: "The Hong Kong startup ecosystem has shown remarkable growth in 2025. New government initiatives and increased venture capital funding have attracted international entrepreneurs. Tech hubs in Central and Cyberport are expanding rapidly to accommodate the influx of new companies.",
    summary: "HK startup ecosystem shows strong growth in 2025"
  };

  try {
    console.log('🚀 Testing one-shot enhancement...');
    const startTime = Date.now();
    
    const result = await perplexityEnhancerV2.enhanceTrilingual(
      testArticle.title,
      testArticle.content,
      testArticle.summary,
      {
        searchDepth: 'low',
        recencyFilter: 'day',
        maxTokens: 1800
      }
    );
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      duration: Math.round(duration/1000),
      results: {
        english: {
          title: result.en.title,
          summaryLength: result.en.summary.length,
          keyPoints: result.en.key_points.length,
          citations: result.en.citations.length
        },
        traditionalChinese: {
          title: result.zh_HK.title,
          keyPoints: result.zh_HK.key_points.length
        },
        simplifiedChinese: {
          title: result.zh_CN.title,
          keyPoints: result.zh_CN.key_points.length
        }
      },
      method: 'one-shot',
      estimatedCost: 0.025,
      metadata: {
        one_shot_generation: true
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
EOF

echo "📝 Created test endpoint at /api/test-oneshot"
echo ""
echo "🚀 Calling the test endpoint..."
echo ""

# Call the test endpoint
RESPONSE=$(curl -X POST http://localhost:3001/api/test-oneshot -s)

echo "📊 Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

echo ""
echo "🧹 Cleaning up test endpoint..."
rm -f app/api/test-oneshot/route.ts

echo ""
echo "✅ Test complete!"