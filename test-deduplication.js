/**
 * Test script for story deduplication
 * Tests the embeddings and NLP-based deduplication system
 */

require('dotenv').config({ path: '.env.local' });

const { generateEmbeddings, calculateCosineSimilarity, clusterBySimilarity } = require('./lib/embeddings-service');
const { deduplicateStories } = require('./lib/story-deduplicator');

// Test articles - some are duplicates with different titles
const testArticles = [
  {
    id: '1',
    title: '港深警方聯手破跨境假飛集團拘12人',
    summary: '香港警方聯同深圳公安成功瓦解跨境假演唱會門票集團',
    content: '香港警方與深圳公安聯合行動，成功瓦解一個偽造及販賣假演唱會門票的跨境詐騙集團，拘捕12人',
    source: 'bastillepost',
    created_at: new Date().toISOString(),
    content_length: 200
  },
  {
    id: '2',
    title: 'HK-Shenzhen Police Bust Cross-Border Fake Ticket Syndicate',
    summary: 'Hong Kong and Shenzhen police jointly dismantled a cross-border fake concert ticket syndicate',
    content: 'Hong Kong and Shenzhen police jointly dismantled a cross-border fake concert ticket syndicate, arresting 12 suspects',
    source: 'RTHK',
    created_at: new Date().toISOString(),
    content_length: 180
  },
  {
    id: '3',
    title: '假演唱會飛｜港深拘12人檢490張G-Dragon等高仿票',
    summary: '警方與公安聯手搗破跨境「假飛」集團',
    content: '警方與公安聯手搗破跨境「假飛」集團，涉GD演唱會等拘12人包括港人主腦',
    source: 'HK01',
    created_at: new Date().toISOString(),
    content_length: 150
  },
  {
    id: '4',
    title: '香港極端暴雨挑戰生產力與工作制度',
    summary: '香港近日八天內發出四次黑色暴雨警告',
    content: '香港近日八天內發出四次黑色暴雨警告，創歷史新高，嚴重影響正常工作秩序',
    source: 'scmp',
    created_at: new Date().toISOString(),
    content_length: 250
  },
  {
    id: '5',
    title: 'Hong Kong Faces Productivity Challenge Amid Extreme Rainstorms',
    summary: 'Hong Kong recently set a record with four black rainstorm signals in eight days',
    content: 'Hong Kong recently set a record with four black rainstorm signals in eight days, severely disrupting normal work routines',
    source: 'scmp',
    created_at: new Date().toISOString(),
    content_length: 240
  }
];

async function testDeduplication() {
  console.log('🧪 Testing Story Deduplication System\n');
  console.log('===================================\n');
  
  try {
    // Test 1: Generate embeddings
    console.log('📊 Test 1: Generating embeddings...');
    const embeddings = await generateEmbeddings(testArticles);
    console.log(`✅ Generated ${embeddings.length} embeddings\n`);
    
    // Test 2: Calculate similarities
    console.log('📊 Test 2: Calculating similarities between articles...');
    for (let i = 0; i < embeddings.length; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        const similarity = calculateCosineSimilarity(embeddings[i].embedding, embeddings[j].embedding);
        if (similarity > 0.7) {
          console.log(`   Articles ${i+1} & ${j+1}: ${(similarity * 100).toFixed(1)}% similar`);
          console.log(`     - "${testArticles[i].title.substring(0, 30)}..."`);
          console.log(`     - "${testArticles[j].title.substring(0, 30)}..."`);
        }
      }
    }
    console.log('');
    
    // Test 3: Cluster similar articles
    console.log('📊 Test 3: Clustering similar articles...');
    const clusters = clusterBySimilarity(testArticles, embeddings, 0.75);
    console.log(`Found ${clusters.length} unique story clusters:`);
    clusters.forEach((cluster, index) => {
      console.log(`\n   Cluster ${index + 1}: ${cluster.articles.length} article(s)`);
      cluster.articles.forEach(article => {
        console.log(`     - [${article.source}] "${article.title.substring(0, 40)}..."`);
      });
    });
    console.log('');
    
    // Test 4: Full deduplication pipeline
    console.log('📊 Test 4: Running full deduplication pipeline...');
    const result = await deduplicateStories(testArticles);
    
    console.log('\n✨ Deduplication Results:');
    console.log(`   • Original articles: ${result.stats.originalCount}`);
    console.log(`   • Unique stories: ${result.stats.uniqueStories}`);
    console.log(`   • Duplicates removed: ${result.duplicatesRemoved}`);
    console.log(`   • Average cluster size: ${result.stats.averageClusterSize.toFixed(1)}`);
    
    console.log('\n📰 Selected unique articles:');
    result.uniqueArticles.forEach((article, index) => {
      console.log(`   ${index + 1}. [${article.source}] "${article.title}"`);
    });
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
testDeduplication();