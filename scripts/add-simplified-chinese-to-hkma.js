const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addSimplifiedChineseToHKMA() {
  console.log('🔧 Adding Simplified Chinese support to HKMA signals...');
  
  try {
    // Get existing HKMA feed sources to check current configuration
    const { data: sources, error: fetchError } = await supabase
      .from('government_feed_sources')
      .select('feed_group, urls, scraping_config')
      .like('feed_group', 'hkma%');
    
    if (fetchError) {
      console.error('❌ Error fetching HKMA sources:', fetchError);
      return;
    }
    
    console.log('\n📋 Current HKMA feed sources:');
    sources.forEach(source => {
      console.log(`${source.feed_group}:`, Object.keys(source.urls || {}));
    });
    
    // Updated scraping configuration with Simplified Chinese
    const updatedScrapingConfig = {
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
    
    // Update scraping config for all HKMA feeds
    const hkmaFeedGroups = ['hkma_press', 'hkma_speeches', 'hkma_circulars', 'hkma_guidelines'];
    
    for (const feedGroup of hkmaFeedGroups) {
      console.log(`📝 Updating ${feedGroup} with Simplified Chinese support...`);
      
      const { error: updateError } = await supabase
        .from('government_feed_sources')
        .update({
          scraping_config: updatedScrapingConfig,
          updated_at: new Date().toISOString()
        })
        .eq('feed_group', feedGroup);
      
      if (updateError) {
        console.error(`❌ Error updating ${feedGroup}:`, updateError);
      } else {
        console.log(`✅ Updated ${feedGroup} with zh-CN support`);
      }
    }
    
    // Check if we need to update existing HKMA signals to include Simplified Chinese URLs
    console.log('\n🔍 Checking existing HKMA signals for zh-CN URL support...');
    
    const { data: hkmaSignals, error: signalsError } = await supabase
      .from('government_signals')
      .select('id, source_identifier, content')
      .like('feed_group', 'hkma%')
      .limit(5);
    
    if (signalsError) {
      console.error('❌ Error fetching HKMA signals:', signalsError);
      return;
    }
    
    let signalsUpdated = 0;
    for (const signal of hkmaSignals) {
      const content = signal.content;
      const metaUrls = content?.meta?.urls || {};
      
      // Check if we need to add zh-CN URL
      if (metaUrls.en && !metaUrls['zh-CN']) {
        // Generate zh-CN URL from English URL
        const zhCnUrl = metaUrls.en.replace('/eng/', '/gb_chi/');
        
        // Update the signal with zh-CN URL
        const updatedContent = {
          ...content,
          meta: {
            ...content.meta,
            urls: {
              ...metaUrls,
              'zh-CN': zhCnUrl
            }
          }
        };
        
        const { error: updateSignalError } = await supabase
          .from('government_signals')
          .update({
            content: updatedContent,
            updated_at: new Date().toISOString()
          })
          .eq('id', signal.id);
        
        if (updateSignalError) {
          console.error(`❌ Error updating signal ${signal.source_identifier}:`, updateSignalError);
        } else {
          signalsUpdated++;
        }
      }
    }
    
    console.log(`\n🔄 Updated ${signalsUpdated} HKMA signals with zh-CN URLs`);
    console.log('\n🎉 Simplified Chinese support added to HKMA configuration!');
    
  } catch (error) {
    console.error('❌ Error adding Simplified Chinese support:', error);
  }
}

// Run the script
addSimplifiedChineseToHKMA().catch(console.error);