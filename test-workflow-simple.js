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

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkForNewProcessedImages() {
  console.log('🔍 Checking for recently processed images...\n');
  
  try {
    // Check if any articles have been processed very recently (last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: recentlyProcessed, error } = await supabase
      .from('articles')
      .select('id, title, source, image_url, image_metadata, created_at')
      .not('image_metadata', 'is', null)
      .gte('created_at', tenMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    if (recentlyProcessed && recentlyProcessed.length > 0) {
      console.log(`🎉 Found ${recentlyProcessed.length} recently processed images!`);
      recentlyProcessed.forEach((article, index) => {
        console.log(`\n${index + 1}. ${article.title.substring(0, 60)}...`);
        console.log(`   📊 Source: ${article.source}`);
        console.log(`   📅 Created: ${new Date(article.created_at).toLocaleString()}`);
        console.log(`   🔧 Processed: ${new Date(article.image_metadata.processed_at).toLocaleString()}`);
        console.log(`   ✅ Has optimized: ${article.image_metadata.optimized ? 'Yes' : 'No'}`);
        console.log(`   ✅ Has WhatsApp: ${article.image_metadata.whatsapp ? 'Yes' : 'No'}`);
      });
      console.log('\n✅ SUCCESS! The auto-processing workflow is working!');
    } else {
      console.log('📊 No recently processed images found in the last 10 minutes.');
      console.log('This could mean:');
      console.log('   1. No new articles were scraped (likely duplicates)');
      console.log('   2. The scrapers are still running');
      console.log('   3. There were no images to process');
    }
    
    // Also check the total count to see if it increased
    const { data: totalStats, error: statsError } = await supabase
      .from('articles')
      .select('id, image_metadata')
      .not('image_url', 'is', null);

    if (!statsError && totalStats) {
      const processedCount = totalStats.filter(a => a.image_metadata && typeof a.image_metadata === 'object').length;
      console.log(`\n📊 Total processed images: ${processedCount} / ${totalStats.length} articles with images`);
    }

  } catch (error) {
    console.error('💥 Check failed:', error);
  }
}

checkForNewProcessedImages();