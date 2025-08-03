const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateTDPressConfig() {
  console.log('🔧 Updating TD press scraping configuration...');
  
  try {
    // Updated TD press scraping configuration for info.gov.hk
    const tdPressScrapingConfig = {
      enabled: true,
      content_selectors: {
        title: '#PRHeadlineSpan, .fontSize1, h1',
        body: '#pressrelease, .pressrelease, .content-body'
      },
      frequency_minutes: 15,
      priority_boost: 10, // Higher priority for transport press releases
      url_patterns: {
        // TD press releases use info.gov.hk URLs, not td.gov.hk
        language_url_map: {
          'en': '/gia/general/',
          'zh-TW': '/gia/general/',  // May have different URLs for Chinese
          'zh-CN': '/gia/general/'   // May have different URLs for Chinese
        }
      }
    };
    
    console.log('📝 Updating td_press scraping configuration...');
    
    const { error } = await supabase
      .from('government_feed_sources')
      .update({
        scraping_config: tdPressScrapingConfig,
        updated_at: new Date().toISOString()
      })
      .eq('feed_group', 'td_press');
    
    if (error) {
      console.error('❌ Error updating td_press:', error);
      return;
    }
    
    console.log('✅ Successfully updated td_press configuration');
    
    // Verify the update
    const { data: updatedConfig, error: fetchError } = await supabase
      .from('government_feed_sources')
      .select('scraping_config')
      .eq('feed_group', 'td_press')
      .single();
    
    if (fetchError) {
      console.error('❌ Error fetching updated config:', fetchError);
      return;
    }
    
    console.log('\n📊 Updated TD Press Configuration:');
    console.log(JSON.stringify(updatedConfig.scraping_config, null, 2));
    
    console.log('\n🎉 TD press scraping configuration updated successfully!');
    console.log('\nKey changes:');
    console.log('- ✅ Content selector: #pressrelease (info.gov.hk format)');
    console.log('- ✅ Title selector: #PRHeadlineSpan');
    console.log('- ✅ Higher priority boost: 10 (transport press)');
    console.log('- ✅ URL patterns updated for info.gov.hk');
    
  } catch (error) {
    console.error('❌ Error updating TD press configuration:', error);
  }
}

// Run the script
updateTDPressConfig().catch(console.error);