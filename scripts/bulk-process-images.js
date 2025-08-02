const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const sharp = require('sharp');

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

// Configuration
const BATCH_SIZE = 10; // Process 10 images at a time
const DELAY_BETWEEN_BATCHES = 2000; // 2 second delay between batches
const MAX_ARTICLES = 50; // Limit for initial test run

let processedCount = 0;
let failedCount = 0;
let skippedCount = 0;

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadImage(url, timeout = 10000) {
  return new Promise(async (resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Download timeout after ${timeout}ms`));
    }, timeout);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      clearTimeout(timeoutId);
      resolve(buffer);
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

async function processImage(imageBuffer) {
  try {
    // Process images in parallel
    const [optimizedBuffer, whatsappBuffer] = await Promise.all([
      // Optimized for general social media (1200x630)
      sharp(imageBuffer)
        .resize(1200, 630, {
          fit: "cover",
          position: "center"
        })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer(),
      
      // Optimized for WhatsApp (800x800)
      sharp(imageBuffer)
        .resize(800, 800, {
          fit: "cover",
          position: "center"
        })
        .jpeg({ quality: 80, progressive: true })
        .toBuffer()
    ]);

    return { optimizedBuffer, whatsappBuffer };
  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
}

async function uploadToSupabase(articleId, optimizedBuffer, whatsappBuffer) {
  const timestamp = Date.now();
  const basePath = `articles/${articleId}/processed`;
  
  try {
    const uploadPromises = [
      supabase.storage
        .from("article-images")
        .upload(`${basePath}/${timestamp}-optimized.jpg`, optimizedBuffer, {
          contentType: "image/jpeg",
          upsert: true
        }),
      
      supabase.storage
        .from("article-images")
        .upload(`${basePath}/${timestamp}-whatsapp.jpg`, whatsappBuffer, {
          contentType: "image/jpeg",
          upsert: true
        })
    ];
    
    const [optimizedUpload, whatsappUpload] = await Promise.all(uploadPromises);
    
    if (optimizedUpload.error) {
      throw new Error(`Optimized upload failed: ${optimizedUpload.error.message}`);
    }
    if (whatsappUpload.error) {
      throw new Error(`WhatsApp upload failed: ${whatsappUpload.error.message}`);
    }
    
    // Get public URLs
    const { data: { publicUrl: optimizedUrl } } = supabase.storage
      .from("article-images")
      .getPublicUrl(optimizedUpload.data.path);
    
    const { data: { publicUrl: whatsappUrl } } = supabase.storage
      .from("article-images")
      .getPublicUrl(whatsappUpload.data.path);
    
    return { optimizedUrl, whatsappUrl };
  } catch (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
}

async function updateArticleMetadata(table, articleId, originalUrl, optimizedUrl, whatsappUrl) {
  const imageMetadata = {
    original: originalUrl,
    optimized: optimizedUrl,
    whatsapp: whatsappUrl,
    processed_at: new Date().toISOString()
  };

  try {
    let updateData;
    if (table === 'articles') {
      updateData = {
        image_url: optimizedUrl, // Use optimized as primary image
        image_metadata: imageMetadata
      };
    } else if (table === 'perplexity_news') {
      // For perplexity table, we'll need to check if it has image_metadata column
      updateData = {
        image_url: optimizedUrl // Just update the image_url for now
      };
    }

    const { error } = await supabase
      .from(table)
      .update(updateData)
      .eq('id', articleId);

    if (error) {
      throw new Error(`Database update failed: ${error.message}`);
    }

    return imageMetadata;
  } catch (error) {
    throw new Error(`Metadata update failed: ${error.message}`);
  }
}

async function processArticle(article) {
  const { id, image_url, title, table } = article;
  
  console.log(`\n🔄 Processing: ${title.substring(0, 60)}...`);
  console.log(`   📊 ID: ${id} | 🗃️  Table: ${table}`);
  console.log(`   🖼️  Original: ${image_url.substring(0, 80)}...`);

  try {
    // Step 1: Download image
    console.log('   📥 Downloading image...');
    const imageBuffer = await downloadImage(image_url);
    console.log(`   ✅ Downloaded: ${(imageBuffer.length / 1024).toFixed(1)}KB`);

    // Step 2: Process image
    console.log('   🔧 Processing image...');
    const { optimizedBuffer, whatsappBuffer } = await processImage(imageBuffer);
    console.log(`   ✅ Processed: ${(optimizedBuffer.length / 1024).toFixed(1)}KB optimized, ${(whatsappBuffer.length / 1024).toFixed(1)}KB whatsapp`);

    // Step 3: Upload to Supabase
    console.log('   📤 Uploading to storage...');
    const { optimizedUrl, whatsappUrl } = await uploadToSupabase(id, optimizedBuffer, whatsappBuffer);
    console.log('   ✅ Uploaded to storage');

    // Step 4: Update database
    console.log('   💾 Updating database...');
    const metadata = await updateArticleMetadata(table, id, image_url, optimizedUrl, whatsappUrl);
    console.log('   ✅ Database updated');

    processedCount++;
    console.log(`   🎉 SUCCESS! (${processedCount} processed, ${failedCount} failed, ${skippedCount} skipped)`);

    return {
      success: true,
      metadata,
      sizes: {
        original: `${(imageBuffer.length / 1024).toFixed(1)}KB`,
        optimized: `${(optimizedBuffer.length / 1024).toFixed(1)}KB`,
        whatsapp: `${(whatsappBuffer.length / 1024).toFixed(1)}KB`
      }
    };

  } catch (error) {
    failedCount++;
    console.log(`   ❌ FAILED: ${error.message}`);
    console.log(`   📊 (${processedCount} processed, ${failedCount} failed, ${skippedCount} skipped)`);
    
    return {
      success: false,
      error: error.message
    };
  }
}

async function bulkProcessImages() {
  console.log('🚀 Bulk Image Processing Started\n');
  console.log('=' .repeat(70));

  try {
    // Load the audit results
    if (!fs.existsSync('image-audit-results.json')) {
      console.error('❌ Please run audit-image-status-v2.js first to generate image-audit-results.json');
      return;
    }

    const auditData = JSON.parse(fs.readFileSync('image-audit-results.json', 'utf8'));
    let articlesToProcess = auditData.articlesToProcess || [];

    console.log(`📋 Found ${articlesToProcess.length.toLocaleString()} articles to process`);
    
    // Limit for initial test
    if (articlesToProcess.length > MAX_ARTICLES) {
      console.log(`🔬 Limiting to first ${MAX_ARTICLES} articles for test run`);
      articlesToProcess = articlesToProcess.slice(0, MAX_ARTICLES);
    }

    // Sort by creation date (newest first) for maximum impact
    articlesToProcess.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    console.log(`\n🎯 Processing ${articlesToProcess.length} articles in batches of ${BATCH_SIZE}`);
    console.log(`⏱️  ${DELAY_BETWEEN_BATCHES/1000}s delay between batches\n`);

    const results = [];
    
    // Process in batches
    for (let i = 0; i < articlesToProcess.length; i += BATCH_SIZE) {
      const batch = articlesToProcess.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(articlesToProcess.length / BATCH_SIZE);
      
      console.log(`\n📦 BATCH ${batchNumber}/${totalBatches} (${batch.length} articles)`);
      console.log('-'.repeat(50));

      // Process batch in parallel
      const batchPromises = batch.map(article => processArticle(article));
      const batchResults = await Promise.all(batchPromises);
      
      results.push(...batchResults);

      // Delay between batches (except for the last batch)
      if (i + BATCH_SIZE < articlesToProcess.length) {
        console.log(`\n⏳ Waiting ${DELAY_BETWEEN_BATCHES/1000}s before next batch...`);
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }

    // Final summary
    console.log('\n🎉 BULK PROCESSING COMPLETE!');
    console.log('=' .repeat(70));
    console.log(`✅ Successfully processed: ${processedCount.toLocaleString()}`);
    console.log(`❌ Failed: ${failedCount.toLocaleString()}`);
    console.log(`⏭️  Skipped: ${skippedCount.toLocaleString()}`);
    console.log(`📊 Success rate: ${processedCount > 0 ? ((processedCount / (processedCount + failedCount)) * 100).toFixed(1) : '0.0'}%`);

    // Save detailed results
    const detailedResults = {
      timestamp: new Date().toISOString(),
      summary: {
        processed: processedCount,
        failed: failedCount,
        skipped: skippedCount,
        total: articlesToProcess.length
      },
      results
    };

    fs.writeFileSync('bulk-processing-results.json', JSON.stringify(detailedResults, null, 2));
    console.log(`\n💾 Detailed results saved to: bulk-processing-results.json`);
    console.log('\n🎯 Next steps:');
    console.log('   1. Test social media previews on processed articles');
    console.log('   2. Run the audit script again to verify improvements');
    console.log('   3. Process remaining articles if test was successful');

  } catch (error) {
    console.error('❌ Bulk processing failed:', error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Process interrupted by user');
  console.log(`📊 Progress: ${processedCount} processed, ${failedCount} failed, ${skippedCount} skipped`);
  process.exit(0);
});

// Run the bulk processing
bulkProcessImages().catch(console.error);