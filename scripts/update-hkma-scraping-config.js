const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateHKMAScrapingConfig() {
  console.log('🔧 Updating HKMA scraping configuration...');
  
  // HKMA scraping configuration based on the URL structure we analyzed
  const hkmaScrapingConfig = {
    enabled: true,
    content_selectors: {
      title: '.press-release-title, h1, h3.press-release-title',
      body: '.template-content-area, .content-area, .main-content'
    },
    frequency_minutes: 15,
    priority_boost: 5,
    url_patterns: {
      language_url_map: {
        'en': '/eng/news-and-media/press-releases/',
        'zh-TW': '/chi/news-and-media/press-releases/',
        'zh-CN': '/gb_chi/news-and-media/press-releases/'
      }
    }
  };

  try {
    // Update all HKMA feed groups
    const hkmaFeedGroups = ['hkma_press', 'hkma_speeches', 'hkma_circulars', 'hkma_guidelines'];
    
    for (const feedGroup of hkmaFeedGroups) {
      console.log(`📝 Updating scraping config for ${feedGroup}...`);
      
      const { data, error } = await supabase
        .from('government_feed_sources')
        .update({
          scraping_config: hkmaScrapingConfig,
          updated_at: new Date().toISOString()
        })
        .eq('feed_group', feedGroup);
      
      if (error) {
        console.error(`❌ Error updating ${feedGroup}:`, error);
      } else {
        console.log(`✅ Successfully updated ${feedGroup}`);
      }
    }
    
    // Verify the updates
    const { data: sources, error: fetchError } = await supabase
      .from('government_feed_sources')
      .select('feed_group, scraping_config')
      .in('feed_group', hkmaFeedGroups);
    
    if (fetchError) {
      console.error('❌ Error fetching updated configs:', fetchError);
      return;
    }
    
    console.log('\n📊 Updated configurations:');
    sources.forEach(source => {
      console.log(`${source.feed_group}:`, JSON.stringify(source.scraping_config, null, 2));
    });
    
    console.log('\n🎉 HKMA scraping configuration update completed!');
    
  } catch (error) {
    console.error('❌ Error updating HKMA scraping configuration:', error);
  }
}

// Run the script
updateHKMAScrapingConfig().catch(console.error);