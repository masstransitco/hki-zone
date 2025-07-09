#!/bin/bash

# Get the first article from the API
curl -s "http://localhost:3003/api/perplexity?page=0" | \
  python3 -c "
import json
import sys

data = json.load(sys.stdin)
article = data['articles'][0]

print('=== Article Analysis ===')
print(f'Title: {article[\"title\"]}')
print(f'isAiEnhanced: {article[\"isAiEnhanced\"]}')
print(f'Sources count: {len(article.get(\"enhancementMetadata\", {}).get(\"sources\", []))}')

sources = article.get('enhancementMetadata', {}).get('sources', [])
if sources:
    print('\n--- Sources ---')
    for i, source in enumerate(sources):
        print(f'{i+1}. {source[\"title\"]} ({source[\"domain\"]})')
        print(f'   URL: {source[\"url\"]}')

print('\n--- Original Citations ---')
citations = article.get('citationsText', '')
if citations:
    citation_list = citations.split(', ')
    print(f'Citations count: {len(citation_list)}')
    for i, citation in enumerate(citation_list[:3]):  # Show first 3
        print(f'{i+1}. {citation}')
"