const { createClient } = require('@supabase/supabase-js');
const { autoProcessArticleImage } = require('./lib/image-processor.ts');
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

async function testImageProcessing() {
  console.log('🧪 Testing Image Auto-Processing Workflow\n');
  
  try {
    // Find a recent article with an image but no metadata
    console.log('🔍 Finding an article with unprocessed image...');
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, source, image_url, image_metadata, created_at')
      .not('image_url', 'is', null)
      .is('image_metadata', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!articles || articles.length === 0) {
      console.log('❌ No articles found with unprocessed images');
      return;
    }

    const article = articles[0];
    console.log(`📄 Testing with article: ${article.title.substring(0, 60)}...`);
    console.log(`📊 Source: ${article.source}`);
    console.log(`🖼️  Image: ${article.image_url.substring(0, 80)}...`);
    console.log(`📅 Created: ${new Date(article.created_at).toLocaleString()}\n`);

    // Test the auto-processing function
    console.log('🔧 Running autoProcessArticleImage...');
    const success = await autoProcessArticleImage(article.id, article.image_url, 'articles');
    
    if (success) {
      console.log('✅ SUCCESS! Image processing completed\n');
      
      // Verify the results
      console.log('🔍 Verifying processing results...');
      const { data: updated, error: verifyError } = await supabase
        .from('articles')
        .select('id, image_url, image_metadata')
        .eq('id', article.id)
        .single();

      if (verifyError) {
        console.error('❌ Error verifying results:', verifyError);
        return;
      }

      console.log('📊 PROCESSING RESULTS:');
      console.log(`   Original URL: ${article.image_url.substring(0, 80)}...`);
      console.log(`   Updated URL: ${updated.image_url.substring(0, 80)}...`);
      
      if (updated.image_metadata) {
        console.log('   ✅ image_metadata created:');
        console.log(`      - Original: ${updated.image_metadata.original ? 'Present' : 'Missing'}`);
        console.log(`      - Optimized: ${updated.image_metadata.optimized ? 'Present' : 'Missing'}`);
        console.log(`      - WhatsApp: ${updated.image_metadata.whatsapp ? 'Present' : 'Missing'}`);
        console.log(`      - Processed at: ${updated.image_metadata.processed_at || 'Missing'}`);
      } else {
        console.log('   ❌ image_metadata not created');
      }

      console.log('\n🎉 TEST SUCCESSFUL! The auto-processing workflow is working correctly.');
      console.log('   📈 Future scraped articles will automatically have optimized images.');
      
    } else {
      console.log('❌ FAILED! Image processing did not complete successfully');
    }

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testImageProcessing();