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
  console.log('=' .repeat(60));
  
  try {
    // Get all articles with image information
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, source, image_url, image_metadata, created_at, is_ai_enhanced')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching articles:', error);
      return;
    }

    // Get perplexity articles
    const { data: perplexityArticles, error: perplexityError } = await supabase
      .from('perplexity_news')
      .select('id, title, image_url, image_status, created_at')
      .order('created_at', { ascending: false });

    if (perplexityError) {
      console.error('❌ Error fetching perplexity articles:', perplexityError);
      return;
    }

    console.log(`📊 Articles Table: ${articles.length} articles`);
    console.log(`📊 Perplexity Table: ${perplexityArticles.length} AI-generated articles`);
    console.log(`📊 Total Articles Analyzed: ${articles.length + perplexityArticles.length}\n`);

    // Categorize articles by image status
    const categories = {
      noImage: [],
      hasImageUrlOnly: [],
      hasProcessedImages: [],
      aiGenerated: [],
      manuallyUploaded: []
    };

    const sourceStats = {};

    articles.forEach(article => {
      // Track by source
      if (!sourceStats[article.source]) {
        sourceStats[article.source] = {
          total: 0,
          withImages: 0,
          processed: 0
        };
      }
      sourceStats[article.source].total++;

      if (!article.image_url) {
        categories.noImage.push(article);
      } else {
        sourceStats[article.source].withImages++;
        
        if (article.image_metadata && typeof article.image_metadata === 'object') {
          categories.hasProcessedImages.push(article);
          sourceStats[article.source].processed++;
          
          // Check if it's likely manually uploaded (has optimized versions)
          if (article.image_metadata.optimized && article.image_metadata.whatsapp) {
            categories.manuallyUploaded.push(article);
          }
        } else {
          categories.hasImageUrlOnly.push(article);
          
          // Check if it's AI generated based on URL pattern or metadata
          if (article.image_url.includes('getimg.ai') || 
              article.image_url.includes('dalle') ||
              (article.article_type && article.article_type.includes('ai'))) {
            categories.aiGenerated.push(article);
          }
        }
      }
    });

    // Display summary statistics
    console.log('📈 IMAGE STATUS SUMMARY');
    console.log('-'.repeat(40));
    console.log(`🚫 No Image: ${categories.noImage.length} (${((categories.noImage.length / articles.length) * 100).toFixed(1)}%)`);
    console.log(`📷 Has Image URL Only: ${categories.hasImageUrlOnly.length} (${((categories.hasImageUrlOnly.length / articles.length) * 100).toFixed(1)}%)`);
    console.log(`✅ Has Processed Images: ${categories.hasProcessedImages.length} (${((categories.hasProcessedImages.length / articles.length) * 100).toFixed(1)}%)`);
    console.log(`🤖 AI Generated (unprocessed): ${categories.aiGenerated.length} (${((categories.aiGenerated.length / articles.length) * 100).toFixed(1)}%)`);
    console.log(`📁 Manually Uploaded (processed): ${categories.manuallyUploaded.length} (${((categories.manuallyUploaded.length / articles.length) * 100).toFixed(1)}%)\n`);

    // Display source breakdown
    console.log('📰 BY SOURCE BREAKDOWN');
    console.log('-'.repeat(40));
    Object.entries(sourceStats)
      .sort(([,a], [,b]) => b.total - a.total)
      .forEach(([source, stats]) => {
        const processedRate = stats.withImages > 0 ? ((stats.processed / stats.withImages) * 100).toFixed(1) : '0.0';
        console.log(`${source}:`);
        console.log(`  Total: ${stats.total} | With Images: ${stats.withImages} | Processed: ${stats.processed} (${processedRate}%)`);
      });

    // Show problematic articles that need processing
    console.log('\n🚨 ARTICLES NEEDING IMAGE PROCESSING');
    console.log('-'.repeat(40));
    
    const needsProcessing = categories.hasImageUrlOnly.filter(article => 
      !categories.aiGenerated.includes(article)
    );

    if (needsProcessing.length > 0) {
      console.log(`Found ${needsProcessing.length} articles with images that need processing:\n`);
      
      // Show top 10 most recent
      needsProcessing.slice(0, 10).forEach((article, index) => {
        console.log(`${index + 1}. ${article.title.substring(0, 60)}...`);
        console.log(`   ID: ${article.id} | Source: ${article.source}`);
        console.log(`   Image: ${article.image_url.substring(0, 80)}...`);
        console.log(`   Created: ${new Date(article.created_at).toLocaleDateString()}\n`);
      });
      
      if (needsProcessing.length > 10) {
        console.log(`... and ${needsProcessing.length - 10} more articles\n`);
      }
    } else {
      console.log('✅ No articles found that need image processing!\n');
    }

    // AI Generated images that need processing
    if (categories.aiGenerated.length > 0) {
      console.log('🤖 AI GENERATED IMAGES NEEDING PROCESSING');
      console.log('-'.repeat(40));
      console.log(`Found ${categories.aiGenerated.length} AI-generated images that need processing:\n`);
      
      categories.aiGenerated.slice(0, 5).forEach((article, index) => {
        console.log(`${index + 1}. ${article.title.substring(0, 60)}...`);
        console.log(`   ID: ${article.id} | Type: ${article.article_type || 'N/A'}`);
        console.log(`   Image: ${article.image_url.substring(0, 80)}...`);
        console.log(`   Created: ${new Date(article.created_at).toLocaleDateString()}\n`);
      });
    }

    // Generate action plan
    console.log('🎯 RECOMMENDED ACTIONS');
    console.log('-'.repeat(40));
    
    const totalNeedingProcessing = needsProcessing.length + categories.aiGenerated.length;
    
    if (totalNeedingProcessing > 0) {
      console.log(`1. 🔧 Process ${totalNeedingProcessing} articles with unprocessed images`);
      console.log(`   - ${needsProcessing.length} scraped images`);
      console.log(`   - ${categories.aiGenerated.length} AI-generated images`);
      console.log(`\n2. 🚀 Priority: Start with most recent articles for immediate impact`);
      console.log(`\n3. 📊 Expected improvement: ${((totalNeedingProcessing / articles.length) * 100).toFixed(1)}% of articles will have better social previews`);
    } else {
      console.log('🎉 All articles with images are already processed!');
    }

    // Export results for bulk processing
    const exportData = {
      timestamp: new Date().toISOString(),
      summary: {
        total: articles.length,
        needsProcessing: totalNeedingProcessing,
        scrapedImages: needsProcessing.length,
        aiGenerated: categories.aiGenerated.length
      },
      articlesToProcess: [
        ...needsProcessing.map(a => ({ ...a, category: 'scraped' })),
        ...categories.aiGenerated.map(a => ({ ...a, category: 'ai_generated' }))
      ]
    };

    fs.writeFileSync('image-audit-results.json', JSON.stringify(exportData, null, 2));
    console.log(`\n💾 Results saved to: image-audit-results.json`);
    console.log(`\nNext step: Run bulk image processing on ${totalNeedingProcessing} articles`);

  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

// Run the audit
auditImageStatus().catch(console.error);