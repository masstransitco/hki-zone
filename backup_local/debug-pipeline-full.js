const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables from .env.cli
try {
  const envFile = fs.readFileSync('.env.cli', 'utf8');
  const envVars = {};
  envFile.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  Object.assign(process.env, envVars);
} catch (error) {
  console.error('Could not load .env.cli:', error.message);
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing environment variables');
  console.log('SUPABASE_URL:', supabaseUrl ? 'Present' : 'Missing');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'Present' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function getTimeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return `${diffDays}d ago`;
  }
}

async function inspectDatabaseSchema() {
  console.log('🔍 DATABASE SCHEMA ANALYSIS');
  console.log('='.repeat(50));
  
  // Get table information
  const tables = ['articles', 'perplexity_news'];
  
  for (const tableName of tables) {
    console.log(`\\n📊 Table: ${tableName}`);
    console.log('-'.repeat(30));
    
    try {
      // Get a sample record to see actual structure
      const { data: sampleData, error: sampleError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (sampleError) {
        console.log(`❌ Error accessing ${tableName}:`, sampleError.message);
        continue;
      }
      
      if (sampleData && sampleData.length > 0) {
        const sample = sampleData[0];
        const columns = Object.keys(sample);
        
        console.log(`   Columns (${columns.length}):`);
        columns.forEach(col => {
          const value = sample[col];
          const type = typeof value;
          const preview = type === 'string' ? 
            (value ? value.substring(0, 30) + (value.length > 30 ? '...' : '') : 'null') :
            JSON.stringify(value);
          console.log(`     • ${col}: ${type} = ${preview}`);
        });
        
        // Get total count
        const { count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        console.log(`   Total records: ${count || 0}`);
      } else {
        console.log(`   ⚠️ No data in ${tableName}`);
      }
    } catch (err) {
      console.log(`❌ Error inspecting ${tableName}:`, err.message);
    }
  }
}

async function analyzeArticleSelectionPipeline() {
  console.log('\\n\\n🔄 ARTICLE SELECTION PIPELINE ANALYSIS');
  console.log('='.repeat(50));
  
  // Step 1: Check scraped sources
  const scrapedSources = ['HKFP', 'SingTao', 'HK01', 'on.cc', 'RTHK', 'AM730', 'SCMP'];
  
  console.log('\\n1️⃣ SCRAPED ARTICLE ANALYSIS');
  console.log('-'.repeat(30));
  
  for (const source of scrapedSources) {
    try {
      const { count: total } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('source', source);
      
      const { count: recent } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('source', source)
        .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());
      
      const { count: enhanced } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('source', source)
        .eq('is_ai_enhanced', true);
      
      const { count: selected } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('source', source)
        .eq('selected_for_enhancement', true)
        .eq('is_ai_enhanced', false);
      
      console.log(`   ${source}: ${total || 0} total, ${recent || 0} recent (<6h), ${enhanced || 0} enhanced, ${selected || 0} stuck`);
    } catch (err) {
      console.log(`   ${source}: Error - ${err.message}`);
    }
  }
  
  // Step 2: Check selection criteria bottlenecks
  console.log('\\n2️⃣ SELECTION CRITERIA ANALYSIS');
  console.log('-'.repeat(30));
  
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  
  console.log(`   Time window: ${sixHoursAgo} to now`);
  
  // Base candidate pool
  const { count: basePool } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .in('source', scrapedSources)
    .gte('created_at', sixHoursAgo);
  
  console.log(`   Base pool (scraped sources, recent): ${basePool || 0}`);
  
  // After filtering out enhanced
  const { count: notEnhanced } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .in('source', scrapedSources)
    .gte('created_at', sixHoursAgo)
    .eq('is_ai_enhanced', false);
  
  console.log(`   After filtering enhanced: ${notEnhanced || 0}`);
  
  // After filtering out selected
  const { count: notSelected } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .in('source', scrapedSources)
    .gte('created_at', sixHoursAgo)
    .eq('is_ai_enhanced', false)
    .eq('selected_for_enhancement', false);
  
  console.log(`   After filtering selected: ${notSelected || 0}`);
  
  // After filtering out null content
  const { count: hasContent } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .in('source', scrapedSources)
    .gte('created_at', sixHoursAgo)
    .eq('is_ai_enhanced', false)
    .eq('selected_for_enhancement', false)
    .not('content', 'is', null);
  
  console.log(`   After filtering null content: ${hasContent || 0}`);
  
  // After filtering enhancement metadata
  const { count: noEnhancementMeta } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .in('source', scrapedSources)
    .gte('created_at', sixHoursAgo)
    .eq('is_ai_enhanced', false)
    .eq('selected_for_enhancement', false)
    .not('content', 'is', null)
    .is('enhancement_metadata->source_article_status', null);
  
  console.log(`   Final candidate pool: ${noEnhancementMeta || 0}`);
  
  // Quality analysis of final candidates
  if (noEnhancementMeta > 0) {
    console.log('\\n   📊 Quality Analysis of Final Candidates:');
    
    const { data: candidates } = await supabase
      .from('articles')
      .select('id, title, content, source, created_at')
      .in('source', scrapedSources)
      .gte('created_at', sixHoursAgo)
      .eq('is_ai_enhanced', false)
      .eq('selected_for_enhancement', false)
      .not('content', 'is', null)
      .is('enhancement_metadata->source_article_status', null)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (candidates) {
      const qualityStats = {
        tooShort: 0,
        noTitle: 0,
        testContent: 0,
        acceptable: 0
      };
      
      candidates.forEach(article => {
        const contentLength = article.content?.length || 0;
        const title = article.title || '';
        
        if (!title || title.length < 5) {
          qualityStats.noTitle++;
        } else if (contentLength < 100) {
          qualityStats.tooShort++;
        } else if (title.toLowerCase().includes('test') || title.toLowerCase().includes('測試')) {
          qualityStats.testContent++;
        } else {
          qualityStats.acceptable++;
        }
      });
      
      console.log(`     • Acceptable quality: ${qualityStats.acceptable}`);
      console.log(`     • Too short content (<100 chars): ${qualityStats.tooShort}`);
      console.log(`     • No/short title: ${qualityStats.noTitle}`);
      console.log(`     • Test content: ${qualityStats.testContent}`);
      
      if (qualityStats.acceptable > 0) {
        console.log('\\n     ✅ Good candidates available!');
        console.log('     Top 5 acceptable candidates:');
        
        const acceptable = candidates.filter(article => {
          const contentLength = article.content?.length || 0;
          const title = article.title || '';
          return title && title.length >= 5 && contentLength >= 100 &&
                 !title.toLowerCase().includes('test') && !title.toLowerCase().includes('測試');
        }).slice(0, 5);
        
        acceptable.forEach((article, i) => {
          const timeAgo = getTimeAgo(article.created_at);
          console.log(`       ${i + 1}. [${timeAgo}] "${article.title.substring(0, 50)}..." (${article.source}, ${article.content.length} chars)`);
        });
      } else {
        console.log('\\n     ⚠️ No acceptable quality candidates found');
      }
    }
  }
}

async function analyzeEnhancementPipeline() {
  console.log('\\n\\n⚡ ENHANCEMENT PIPELINE ANALYSIS');
  console.log('='.repeat(50));
  
  // Check stuck selections
  console.log('\\n1️⃣ STUCK SELECTIONS ANALYSIS');
  console.log('-'.repeat(30));
  
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data: stuckRecent } = await supabase
    .from('articles')
    .select('id, title, source, created_at, selection_metadata')
    .eq('selected_for_enhancement', true)
    .eq('is_ai_enhanced', false)
    .gte('selection_metadata->>selected_at', fourHoursAgo);
  
  const { data: stuckOld } = await supabase
    .from('articles')
    .select('id, title, source, created_at, selection_metadata')
    .eq('selected_for_enhancement', true)
    .eq('is_ai_enhanced', false)
    .lt('selection_metadata->>selected_at', fourHoursAgo);
  
  console.log(`   Recently stuck (<4h): ${stuckRecent?.length || 0}`);
  console.log(`   Severely stuck (>4h): ${stuckOld?.length || 0}`);
  
  if (stuckOld && stuckOld.length > 0) {
    console.log('\\n   🚨 Severely stuck articles:');
    stuckOld.slice(0, 5).forEach((article, i) => {
      const selectedAt = article.selection_metadata?.selected_at;
      const timeStuck = selectedAt ? getTimeAgo(selectedAt) : 'unknown';
      console.log(`     ${i + 1}. [${timeStuck}] "${article.title?.substring(0, 40)}..." (${article.source})`);
    });
  }
  
  // Check enhanced articles
  console.log('\\n2️⃣ ENHANCED ARTICLES ANALYSIS');
  console.log('-'.repeat(30));
  
  const { count: totalEnhanced } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('is_ai_enhanced', true);
  
  const { count: recentEnhanced } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('is_ai_enhanced', true)
    .gte('created_at', oneDayAgo);
  
  console.log(`   Total enhanced articles: ${totalEnhanced || 0}`);
  console.log(`   Recent enhanced (<24h): ${recentEnhanced || 0}`);
  
  // Get recent enhanced articles
  const { data: recentEnhancedArticles } = await supabase
    .from('articles')
    .select('title, source, created_at, enhancement_metadata')
    .eq('is_ai_enhanced', true)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (recentEnhancedArticles && recentEnhancedArticles.length > 0) {
    console.log('\\n   📰 Recent enhanced articles:');
    recentEnhancedArticles.forEach((article, i) => {
      const timeAgo = getTimeAgo(article.created_at);
      const batchId = article.enhancement_metadata?.batch_id || 'no-batch';
      const cost = article.enhancement_metadata?.estimated_cost || '0';
      console.log(`     ${i + 1}. [${timeAgo}] "${article.title?.substring(0, 50)}..." (${article.source}) [${batchId}, $${cost}]`);
    });
  }
}

async function analyzePipelineConfig() {
  console.log('\\n\\n⚙️ PIPELINE CONFIGURATION ANALYSIS');
  console.log('='.repeat(50));
  
  // Check cron timing
  console.log('\\n🕒 Cron Schedule Analysis:');
  console.log('   Selection:    :00, :15, :30, :45 (every 15 min)');
  console.log('   Enhancement:  :05, :20, :35, :50 (every 15 min, 5 min after selection)');
  console.log('   Cleanup:      :10, :40 (every 30 min, between cycles)');
  
  console.log('\\n📊 Pipeline Flow:');
  console.log('   1. Scraping → Articles table (sources: HKFP, SingTao, HK01, on.cc, RTHK, AM730, SCMP)');
  console.log('   2. Selection → Mark articles selected_for_enhancement=true');
  console.log('   3. Enhancement → Create enhanced versions, mark is_ai_enhanced=true');
  console.log('   4. Cleanup → Reset stuck selections');
  
  console.log('\\n🎯 Expected Behavior:');
  console.log('   • Articles should be selected within 15 minutes of creation');
  console.log('   • Enhancement should complete within 5 minutes of selection');
  console.log('   • Total pipeline latency: ~20 minutes from scrape to enhancement');
  console.log('   • Stuck articles should be cleaned up within 30 minutes');
}

async function generateRefactoringRecommendations() {
  console.log('\\n\\n🔧 REFACTORING RECOMMENDATIONS');
  console.log('='.repeat(50));
  
  // Analyze current state to generate targeted recommendations
  const { count: stuckCount } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('selected_for_enhancement', true)
    .eq('is_ai_enhanced', false);
  
  const { count: candidateCount } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .in('source', ['HKFP', 'SingTao', 'HK01', 'on.cc', 'RTHK', 'AM730', 'SCMP'])
    .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
    .eq('is_ai_enhanced', false)
    .eq('selected_for_enhancement', false)
    .not('content', 'is', null);
  
  const { count: totalEnhanced } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('is_ai_enhanced', true);
  
  console.log('\\n📊 Current State Summary:');
  console.log(`   • Stuck selections: ${stuckCount || 0}`);
  console.log(`   • Available candidates: ${candidateCount || 0}`);
  console.log(`   • Total enhanced articles: ${totalEnhanced || 0}`);
  
  console.log('\\n🎯 HIGH PRIORITY FIXES:');
  
  if (stuckCount > 0) {
    console.log('   1. ⚠️ CRITICAL: Implement cleanup-stuck-selections cron job');
    console.log('      - Run every 30 minutes to reset articles stuck >4 hours');
    console.log('      - Add monitoring/alerting for high stuck counts');
  }
  
  console.log('   2. 🔄 Add exponential backoff retry to Perplexity API calls');
  console.log('      - Prevents API timeouts from creating stuck selections');
  console.log('      - Implement circuit breaker for API failures');
  
  console.log('   3. 🔐 Add atomic database transactions');
  console.log('      - Ensure selection/enhancement operations are all-or-nothing');
  console.log('      - Prevent partial state corruption');
  
  console.log('\\n🔧 MEDIUM PRIORITY IMPROVEMENTS:');
  console.log('   4. 📊 Add pipeline health monitoring');
  console.log('      - Track success/failure rates by component');
  console.log('      - Alert on pipeline degradation');
  
  console.log('   5. ⏱️ Extend selection time window during low-activity periods');
  console.log('      - Fall back to 12h, 24h windows if 6h yields no candidates');
  console.log('      - Prevents pipeline starvation during slow news periods');
  
  console.log('   6. 🎛️ Add graceful degradation');
  console.log('      - Continue enhancement without images if image search fails');
  console.log('      - Partial enhancement better than no enhancement');
  
  console.log('\\n📈 LONG-TERM OPTIMIZATIONS:');
  console.log('   7. 🗄️ Implement proper article lifecycle management');
  console.log('      - Archive old articles to prevent database bloat');
  console.log('      - Separate hot/cold storage for active vs historical articles');
  
  console.log('   8. 🌊 Add queue-based processing');
  console.log('      - Replace direct DB polling with message queues');
  console.log('      - Better handling of burst traffic and retries');
  
  console.log('   9. 🎯 Implement smart article scoring');
  console.log('      - Prioritize breaking news, trending topics');
  console.log('      - Avoid enhancing duplicate or low-value content');
}

async function main() {
  try {
    console.log('🚀 COMPREHENSIVE PIPELINE ANALYSIS');
    console.log('='.repeat(70));
    console.log(`⏰ Analysis time: ${new Date().toISOString()}`);
    
    await inspectDatabaseSchema();
    await analyzeArticleSelectionPipeline();
    await analyzeEnhancementPipeline();
    await analyzePipelineConfig();
    await generateRefactoringRecommendations();
    
    console.log('\\n\\n✅ Analysis complete!');
    console.log('💡 Use the recommendations above to implement a robust article enhancement pipeline.');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    console.error('Stack:', error.stack);
  }
}

main().catch(console.error);