#!/usr/bin/env npx tsx

/**
 * HKI Zone MCP Server
 * Provides agentic access to Hong Kong news data for AI-powered analysis
 */

import { createClient } from '@supabase/supabase-js';

// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://egyuetfeubznhcvmtary.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// MCP Server implementation
interface MCPRequest {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: string;
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

// Tool definitions
const tools = [
  {
    name: "search_articles",
    description: "Search HKI Zone news articles by keyword, category, or source. Returns articles with titles, summaries, sources, and publication dates.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query to find in article titles, summaries, and content"
        },
        category: {
          type: "string",
          description: "Filter by category: politics, business, tech, health, entertainment, international, transportation",
          enum: ["politics", "business", "tech", "health", "entertainment", "international", "transportation"]
        },
        source: {
          type: "string",
          description: "Filter by news source: HKFP, SingTao, HK01, ONCC, RTHK, SCMP, Bloomberg, TheStandard, etc."
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 10, max: 50)"
        }
      }
    }
  },
  {
    name: "get_latest_headlines",
    description: "Get the latest news headlines from Hong Kong. Returns recent articles sorted by publication date.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Optional category filter"
        },
        limit: {
          type: "number",
          description: "Number of headlines to return (default: 10)"
        }
      }
    }
  },
  {
    name: "get_article_details",
    description: "Get full details of a specific article by ID, including full content, AI summary, and extracted entities.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The article ID"
        }
      },
      required: ["id"]
    }
  },
  {
    name: "get_mobility_news",
    description: "Get news articles related to transportation, EV, mobility, and urban infrastructure in Hong Kong. Useful for Aircity intelligence.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of articles to return (default: 20)"
        }
      }
    }
  },
  {
    name: "extract_entities",
    description: "Extract and list all people, organizations, and locations mentioned across recent articles. Useful for identifying key media figures and stakeholders.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Optional category to filter articles before extraction"
        },
        entity_type: {
          type: "string",
          description: "Type of entity to extract: person, organization, location, or all",
          enum: ["person", "organization", "location", "all"]
        },
        limit: {
          type: "number",
          description: "Number of articles to analyze (default: 50)"
        }
      }
    }
  },
  {
    name: "get_database_stats",
    description: "Get statistics about the HKI Zone news database including article counts by source, category, and date range.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  }
];

// Tool implementations
async function searchArticles(params: { query?: string; category?: string; source?: string; limit?: number }) {
  const limit = Math.min(params.limit || 10, 50);

  let query = supabase
    .from('articles_unified')
    .select('id, title, summary, source, category, published_at, url, author')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (params.query) {
    query = query.or(`title.ilike.%${params.query}%,summary.ilike.%${params.query}%,content.ilike.%${params.query}%`);
  }
  if (params.category) {
    query = query.eq('category', params.category);
  }
  if (params.source) {
    query = query.ilike('source', `%${params.source}%`);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Database error: ${error.message}`);

  return {
    count: data?.length || 0,
    articles: data || []
  };
}

async function getLatestHeadlines(params: { category?: string; limit?: number }) {
  const limit = Math.min(params.limit || 10, 50);

  let query = supabase
    .from('articles_unified')
    .select('id, title, summary, source, category, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (params.category) {
    query = query.eq('category', params.category);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Database error: ${error.message}`);

  return {
    count: data?.length || 0,
    headlines: data?.map(a => ({
      id: a.id,
      title: a.title,
      source: a.source,
      category: a.category,
      published_at: a.published_at
    })) || []
  };
}

async function getArticleDetails(params: { id: string }) {
  const { data, error } = await supabase
    .from('articles_unified')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error) throw new Error(`Article not found: ${error.message}`);

  return data;
}

async function getMobilityNews(params: { limit?: number }) {
  const limit = Math.min(params.limit || 20, 50);
  const mobilityKeywords = ['transport', 'EV', 'electric vehicle', 'mobility', 'traffic', 'parking', 'MTR', 'bus', 'taxi', 'infrastructure', 'smart city', 'autonomous', 'vehicle'];

  const searchPattern = mobilityKeywords.map(k => `title.ilike.%${k}%`).join(',') + ',' +
                        mobilityKeywords.map(k => `summary.ilike.%${k}%`).join(',');

  const { data, error } = await supabase
    .from('articles_unified')
    .select('id, title, summary, source, category, published_at, url')
    .eq('status', 'published')
    .or(searchPattern)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Database error: ${error.message}`);

  return {
    count: data?.length || 0,
    articles: data || [],
    keywords_used: mobilityKeywords
  };
}

async function extractEntities(params: { category?: string; entity_type?: string; limit?: number }) {
  const limit = Math.min(params.limit || 50, 100);

  let query = supabase
    .from('articles_unified')
    .select('id, title, content, summary')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (params.category) {
    query = query.eq('category', params.category);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Database error: ${error.message}`);

  // Simple entity extraction patterns
  const personPatterns = /(?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Chief Executive|Secretary|Minister|CEO|Chairman|President)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g;
  const orgPatterns = /(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Government|Council|Authority|Department|Bureau|Commission|Committee|Association|Corporation|Company|Ltd|Inc))/g;

  const entities: { persons: Set<string>; organizations: Set<string> } = {
    persons: new Set(),
    organizations: new Set()
  };

  data?.forEach(article => {
    const text = `${article.title} ${article.summary || ''} ${article.content || ''}`;

    let match;
    while ((match = personPatterns.exec(text)) !== null) {
      entities.persons.add(match[1]);
    }
    while ((match = orgPatterns.exec(text)) !== null) {
      entities.organizations.add(match[1]);
    }
  });

  const result: Record<string, string[]> = {};
  if (params.entity_type === 'person' || params.entity_type === 'all' || !params.entity_type) {
    result.persons = Array.from(entities.persons);
  }
  if (params.entity_type === 'organization' || params.entity_type === 'all' || !params.entity_type) {
    result.organizations = Array.from(entities.organizations);
  }

  return {
    articles_analyzed: data?.length || 0,
    entities: result
  };
}

async function getDatabaseStats() {
  // Get total count
  const { count: totalCount } = await supabase
    .from('articles_unified')
    .select('*', { count: 'exact', head: true });

  // Get counts by source
  const { data: sourceData } = await supabase
    .from('articles_unified')
    .select('source')
    .eq('status', 'published');

  const sourceCounts: Record<string, number> = {};
  sourceData?.forEach(a => {
    sourceCounts[a.source] = (sourceCounts[a.source] || 0) + 1;
  });

  // Get counts by category
  const { data: categoryData } = await supabase
    .from('articles_unified')
    .select('category')
    .eq('status', 'published');

  const categoryCounts: Record<string, number> = {};
  categoryData?.forEach(a => {
    if (a.category) {
      categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
    }
  });

  // Get date range
  const { data: dateRange } = await supabase
    .from('articles_unified')
    .select('published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: true })
    .limit(1);

  const { data: latestDate } = await supabase
    .from('articles_unified')
    .select('published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1);

  return {
    total_articles: totalCount,
    by_source: sourceCounts,
    by_category: categoryCounts,
    date_range: {
      earliest: dateRange?.[0]?.published_at,
      latest: latestDate?.[0]?.published_at
    }
  };
}

// Handle tool calls
async function handleToolCall(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'search_articles':
      return await searchArticles(args as Parameters<typeof searchArticles>[0]);
    case 'get_latest_headlines':
      return await getLatestHeadlines(args as Parameters<typeof getLatestHeadlines>[0]);
    case 'get_article_details':
      return await getArticleDetails(args as Parameters<typeof getArticleDetails>[0]);
    case 'get_mobility_news':
      return await getMobilityNews(args as Parameters<typeof getMobilityNews>[0]);
    case 'extract_entities':
      return await extractEntities(args as Parameters<typeof extractEntities>[0]);
    case 'get_database_stats':
      return await getDatabaseStats();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// MCP protocol handler
async function handleRequest(request: MCPRequest): Promise<MCPResponse> {
  const { id, method, params } = request;

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'hki-zone-mcp',
              version: '1.0.0'
            }
          }
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: { tools }
        };

      case 'tools/call':
        const toolName = (params as { name: string; arguments?: Record<string, unknown> }).name;
        const toolArgs = (params as { name: string; arguments?: Record<string, unknown> }).arguments || {};
        const result = await handleToolCall(toolName, toolArgs);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          }
        };

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` }
        };
    }
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32000,
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Main server loop (stdio transport)
async function main() {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  for await (const line of rl) {
    try {
      const request = JSON.parse(line) as MCPRequest;
      const response = await handleRequest(request);
      console.log(JSON.stringify(response));
    } catch (error) {
      console.error(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' }
      }));
    }
  }
}

main().catch(console.error);
