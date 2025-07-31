const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function examinePerplexityFeed() {
  console.log('🔍 Examining Perplexity Feed Database Issues\n');

  try {
    // 1. Check total count of AI-generated articles
    console.log('1️⃣ Checking total AI-generated articles:');
    const { data: totalCount, error: countError } = await supabase
      .from('articles_unified')
      .select('id', { count: 'exact', head: true })
      .eq('article_type', 'ai_generated')
      .eq('status', 'published')
      .eq('processing_status', 'ready');

    if (countError) {
      console.error('Error counting articles:', countError);
    } else {
      console.log(`   Total AI-generated articles: ${totalCount}`);
    }

    // 2. Check articles by page (simulate pagination)
    console.log('\n2️⃣ Checking pagination (10 articles per page):');
    for (let page = 0; page < 3; page++) {
      const { data: pageArticles, error: pageError } = await supabase
        .from('articles_unified')
        .select('id, title, published_at, created_at')
        .eq('article_type', 'ai_generated')
        .eq('status', 'published')
        .eq('processing_status', 'ready')
        .order('published_at', { ascending: false })
        .order('id', { ascending: false })
        .range(page * 10, (page + 1) * 10 - 1);

      if (pageError) {
        console.error(`Error fetching page ${page}:`, pageError);
      } else {
        console.log(`\n   Page ${page} (${pageArticles.length} articles):`);
        pageArticles.forEach((article, index) => {
          console.log(`   ${page * 10 + index + 1}. [${article.id.substring(0, 8)}...] ${article.title.substring(0, 50)}...`);
          console.log(`      Published: ${article.published_at}`);
        });
      }
    }

    // 3. Check for duplicate articles
    console.log('\n3️⃣ Checking for duplicate URLs:');
    const { data: duplicates, error: dupError } = await supabase
      .rpc('check_duplicate_urls');

    if (dupError) {
      // If RPC doesn't exist, do manual check
      const { data: allArticles, error: allError } = await supabase
        .from('articles_unified')
        .select('url, title')
        .eq('article_type', 'ai_generated');

      if (!allError && allArticles) {
        const urlCounts = {};
        allArticles.forEach(article => {
          urlCounts[article.url] = (urlCounts[article.url] || 0) + 1;
        });
        
        const duplicateUrls = Object.entries(urlCounts)
          .filter(([url, count]) => count > 1)
          .map(([url, count]) => ({ url, count }));

        if (duplicateUrls.length > 0) {
          console.log(`   Found ${duplicateUrls.length} duplicate URLs:`);
          duplicateUrls.forEach(dup => {
            console.log(`   - ${dup.url} (${dup.count} times)`);
          });
        } else {
          console.log('   ✅ No duplicate URLs found');
        }
      }
    }

    // 4. Check date distribution
    console.log('\n4️⃣ Checking article date distribution:');
    const { data: dateDistribution, error: dateError } = await supabase
      .from('articles_unified')
      .select('published_at, created_at')
      .eq('article_type', 'ai_generated')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(20);

    if (!dateError && dateDistribution) {
      const dates = {};
      dateDistribution.forEach(article => {
        const date = new Date(article.published_at).toISOString().split('T')[0];
        dates[date] = (dates[date] || 0) + 1;
      });

      console.log('   Articles per day:');
      Object.entries(dates).forEach(([date, count]) => {
        console.log(`   ${date}: ${count} articles`);
      });
    }

    // 5. Check if using views or direct table
    console.log('\n5️⃣ Checking backward compatibility views:');
    const { data: viewData, error: viewError } = await supabase
      .from('perplexity_news_view')
      .select('id, title')
      .limit(5);

    if (viewError) {
      console.log('   ❌ View not accessible:', viewError.message);
    } else {
      console.log(`   ✅ View is working, found ${viewData?.length || 0} articles`);
    }

    // 6. Check for any ordering issues
    console.log('\n6️⃣ Checking for ordering issues:');
    const { data: orderCheck, error: orderError } = await supabase
      .from('articles_unified')
      .select('id, title, published_at, updated_at')
      .eq('article_type', 'ai_generated')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(10);

    if (!orderError && orderCheck) {
      let hasOrderingIssue = false;
      for (let i = 1; i < orderCheck.length; i++) {
        const current = new Date(orderCheck[i].published_at);
        const previous = new Date(orderCheck[i - 1].published_at);
        if (current > previous) {
          hasOrderingIssue = true;
          console.log(`   ⚠️  Ordering issue found between articles ${i - 1} and ${i}`);
        }
      }
      if (!hasOrderingIssue) {
        console.log('   ✅ Articles are properly ordered by published_at DESC');
      }
    }

    // 7. Sample articles to see the actual data
    console.log('\n7️⃣ Sample article data:');
    const { data: sampleArticles, error: sampleError } = await supabase
      .from('articles_unified')
      .select('*')
      .eq('article_type', 'ai_generated')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(3);

    if (!sampleError && sampleArticles) {
      sampleArticles.forEach((article, index) => {
        console.log(`\n   Article ${index + 1}:`);
        console.log(`   ID: ${article.id}`);
        console.log(`   Title: ${article.title}`);
        console.log(`   Published: ${article.published_at}`);
        console.log(`   Created: ${article.created_at}`);
        console.log(`   Updated: ${article.updated_at}`);
        console.log(`   Status: ${article.status}`);
        console.log(`   Processing: ${article.processing_status}`);
        console.log(`   Has Image: ${article.features?.has_image}`);
        console.log(`   Legacy ID: ${article.legacy_article_id}`);
      });
    }

  } catch (error) {
    console.error('Error examining database:', error);
  }
}

// Run the examination
examinePerplexityFeed();