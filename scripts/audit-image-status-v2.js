const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables from .env.local
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
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
  console.error('Could not load .env.local:', error.message);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditImageStatus() {
  console.log('🔍 Article Image Status Audit\n');
  console.log('=' .repeat(70));
  
  try {
    // Get all articles with image information
    console.log('📥 Fetching articles table...');
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, source, image_url, image_metadata, created_at, is_ai_enhanced')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching articles:', error);
      return;
    }

    // Get perplexity articles
    console.log('📥 Fetching perplexity_news table...');
    const { data: perplexityArticles, error: perplexityError } = await supabase
      .from('perplexity_news')
      .select('id, title, image_url, image_status, created_at')
      .order('created_at', { ascending: false });

    if (perplexityError) {
      console.error('❌ Error fetching perplexity articles:', perplexityError);
      return;
    }

    console.log(`\n📊 DATASET OVERVIEW`);
    console.log('-'.repeat(50));
    console.log(`📰 Articles Table: ${articles.length.toLocaleString()} articles`);
    console.log(`🤖 Perplexity Table: ${perplexityArticles.length.toLocaleString()} AI-generated articles`);
    console.log(`📈 Total Articles: ${(articles.length + perplexityArticles.length).toLocaleString()}\n`);

    // Analyze articles table
    const articleStats = analyzeArticlesTable(articles);
    const perplexityStats = analyzePerplexityTable(perplexityArticles);

    // Display results
    displayArticleAnalysis(articleStats);
    displayPerplexityAnalysis(perplexityStats);
    displaySourceBreakdown(articleStats.sourceStats);
    displayActionPlan(articleStats, perplexityStats);

    // Export results
    const exportData = {
      timestamp: new Date().toISOString(),
      summary: {
        articlesTable: {
          total: articles.length,
          withImages: articleStats.withImages,
          processed: articleStats.processed,
          needsProcessing: articleStats.needsProcessing
        },
        perplexityTable: {
          total: perplexityArticles.length,
          withImages: perplexityStats.withImages,
          needsProcessing: perplexityStats.needsProcessing
        }
      },
      articlesToProcess: [
        ...articleStats.needsProcessingList,
        ...perplexityStats.needsProcessingList
      ]
    };

    fs.writeFileSync('image-audit-results.json', JSON.stringify(exportData, null, 2));
    console.log(`\n💾 Detailed results saved to: image-audit-results.json`);

  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

function analyzeArticlesTable(articles) {
  const stats = {
    total: articles.length,
    noImage: 0,
    withImages: 0,
    processed: 0,
    needsProcessing: 0,
    manuallyUploaded: 0,
    needsProcessingList: [],
    sourceStats: {}
  };

  articles.forEach(article => {
    // Track by source
    if (!stats.sourceStats[article.source]) {
      stats.sourceStats[article.source] = {
        total: 0,
        withImages: 0,
        processed: 0
      };
    }
    stats.sourceStats[article.source].total++;

    if (!article.image_url) {
      stats.noImage++;
    } else {
      stats.withImages++;
      stats.sourceStats[article.source].withImages++;
      
      if (article.image_metadata && typeof article.image_metadata === 'object') {
        stats.processed++;
        stats.sourceStats[article.source].processed++;
        
        // Check if it has optimized versions (fully processed)
        if (article.image_metadata.optimized && article.image_metadata.whatsapp) {
          stats.manuallyUploaded++;
        }
      } else {
        stats.needsProcessing++;
        stats.needsProcessingList.push({
          ...article,
          table: 'articles',
          category: 'scraped_image'
        });
      }
    }
  });

  return stats;
}

function analyzePerplexityTable(perplexityArticles) {
  const stats = {
    total: perplexityArticles.length,
    noImage: 0,
    withImages: 0,
    needsProcessing: 0,
    needsProcessingList: []
  };

  perplexityArticles.forEach(article => {
    if (!article.image_url) {
      stats.noImage++;
    } else {
      stats.withImages++;
      // All perplexity articles with images need processing since they don't have image_metadata
      stats.needsProcessing++;
      stats.needsProcessingList.push({
        ...article,
        table: 'perplexity_news',
        source: 'Perplexity AI',
        category: 'ai_generated'
      });
    }
  });

  return stats;
}

function displayArticleAnalysis(stats) {
  console.log('📰 ARTICLES TABLE ANALYSIS');
  console.log('-'.repeat(50));
  console.log(`📊 Total Articles: ${stats.total.toLocaleString()}`);
  console.log(`🚫 No Image: ${stats.noImage.toLocaleString()} (${((stats.noImage / stats.total) * 100).toFixed(1)}%)`);
  console.log(`📷 Has Images: ${stats.withImages.toLocaleString()} (${((stats.withImages / stats.total) * 100).toFixed(1)}%)`);
  console.log(`✅ Processed Images: ${stats.processed.toLocaleString()} (${stats.withImages > 0 ? ((stats.processed / stats.withImages) * 100).toFixed(1) : '0.0'}% of images)`);
  console.log(`📁 Fully Optimized: ${stats.manuallyUploaded.toLocaleString()} (${stats.withImages > 0 ? ((stats.manuallyUploaded / stats.withImages) * 100).toFixed(1) : '0.0'}% of images)`);
  console.log(`🔧 Need Processing: ${stats.needsProcessing.toLocaleString()} (${stats.withImages > 0 ? ((stats.needsProcessing / stats.withImages) * 100).toFixed(1) : '0.0'}% of images)`);
  console.log('');
}

function displayPerplexityAnalysis(stats) {
  console.log('🤖 PERPLEXITY TABLE ANALYSIS');
  console.log('-'.repeat(50));
  console.log(`📊 Total AI Articles: ${stats.total.toLocaleString()}`);
  console.log(`🚫 No Image: ${stats.noImage.toLocaleString()} (${((stats.noImage / stats.total) * 100).toFixed(1)}%)`);
  console.log(`📷 Has Images: ${stats.withImages.toLocaleString()} (${((stats.withImages / stats.total) * 100).toFixed(1)}%)`);
  console.log(`🔧 Need Processing: ${stats.needsProcessing.toLocaleString()} (${stats.withImages > 0 ? '100.0' : '0.0'}% of images)`);
  console.log('');
}

function displaySourceBreakdown(sourceStats) {
  console.log('📰 SOURCE BREAKDOWN (Articles Table)');
  console.log('-'.repeat(50));
  
  const sortedSources = Object.entries(sourceStats)
    .sort(([,a], [,b]) => b.total - a.total);

  sortedSources.forEach(([source, stats]) => {
    const processedRate = stats.withImages > 0 ? ((stats.processed / stats.withImages) * 100).toFixed(1) : '0.0';
    console.log(`${source}:`);
    console.log(`  📊 ${stats.total.toLocaleString()} articles | 📷 ${stats.withImages.toLocaleString()} with images | ✅ ${stats.processed.toLocaleString()} processed (${processedRate}%)`);
  });
  console.log('');
}

function displayActionPlan(articleStats, perplexityStats) {
  const totalNeedingProcessing = articleStats.needsProcessing + perplexityStats.needsProcessing;
  
  console.log('🎯 RECOMMENDED ACTIONS');
  console.log('-'.repeat(50));
  
  if (totalNeedingProcessing > 0) {
    console.log(`🔧 PROCESS ${totalNeedingProcessing.toLocaleString()} ARTICLES WITH UNPROCESSED IMAGES:`);
    console.log(`   • ${articleStats.needsProcessing.toLocaleString()} scraped articles (articles table)`);
    console.log(`   • ${perplexityStats.needsProcessing.toLocaleString()} AI-generated articles (perplexity_news table)`);
    console.log('');
    
    console.log('📋 PROCESSING PRIORITIES:');
    console.log('   1. 🚀 Recent articles (last 30 days) for immediate impact');
    console.log('   2. 📰 High-traffic sources (Bloomberg, SCMP, RTHK)');
    console.log('   3. 🤖 AI-generated articles with images');
    console.log('');
    
    const totalArticles = articleStats.total + perplexityStats.total;
    const improvementRate = ((totalNeedingProcessing / totalArticles) * 100).toFixed(1);
    console.log(`📈 EXPECTED IMPROVEMENT: ${improvementRate}% of all articles will have better social previews`);
    console.log('');
    
    console.log('🛠️  NEXT STEPS:');
    console.log('   1. Run bulk image processing script');
    console.log('   2. Update scrapers to auto-process new images');
    console.log('   3. Ensure AI image generation goes through processing pipeline');
    console.log('   4. Test social media previews on processed articles');
  } else {
    console.log('🎉 ALL ARTICLES WITH IMAGES ARE ALREADY PROCESSED!');
    console.log('   • No immediate action needed');
    console.log('   • Focus on preventing future issues in the pipeline');
  }
}

// Run the audit
auditImageStatus().catch(console.error);