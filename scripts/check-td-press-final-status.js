const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTDPressFinalStatus() {
  console.log('📊 Checking final TD press signals status...');
  
  try {
    // Get TD press signal counts by status
    const { data: statusCounts, error } = await supabase
      .from('government_signals')
      .select('processing_status')
      .eq('feed_group', 'td_press');
    
    if (error) {
      console.error('❌ Error fetching TD press signals:', error);
      return;
    }
    
    const counts = statusCounts.reduce((acc, signal) => {
      acc[signal.processing_status] = (acc[signal.processing_status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n📈 TD Press Signal Status Counts:');
    for (const [status, count] of Object.entries(counts)) {
      const emoji = status === 'content_complete' ? '✅' : 
                   status === 'content_partial' ? '⚠️' : '🔍';
      console.log(`  ${emoji} ${status}: ${count}`);
    }
    
    // Get sample of successful signals with body content
    const { data: completeSignals, error: completeError } = await supabase
      .from('government_signals')
      .select('source_identifier, content, updated_at')
      .eq('feed_group', 'td_press')
      .eq('processing_status', 'content_complete')
      .order('updated_at', { ascending: false })
      .limit(5);
    
    if (completeError) {
      console.error('❌ Error fetching complete signals:', completeError);
      return;
    }
    
    console.log('\n✅ Recently completed TD press signals:');
    completeSignals.forEach(signal => {
      const languages = signal.content?.languages || {};
      const bodyCounts = Object.entries(languages).map(([lang, content]) => 
        `${lang}:${(content.body || '').length}`
      ).join(', ');
      console.log(`  ${signal.source_identifier} (${bodyCounts}) - ${signal.updated_at}`);
    });
    
    // Check recent processing activity
    const { data: recentlyUpdated, error: recentError } = await supabase
      .from('government_signals')
      .select('source_identifier, processing_status, updated_at')
      .eq('feed_group', 'td_press')
      .gte('updated_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Last 30 minutes
      .order('updated_at', { ascending: false });
    
    if (recentError) {
      console.error('❌ Error fetching recent updates:', recentError);
      return;
    }
    
    if (recentlyUpdated.length > 0) {
      console.log('\n🔄 Recent TD press activity (last 30 minutes):');
      recentlyUpdated.forEach(signal => {
        const emoji = signal.processing_status === 'content_complete' ? '✅' : '⚠️';
        console.log(`  ${emoji} ${signal.source_identifier} - ${signal.processing_status} (${signal.updated_at})`);
      });
    } else {
      console.log('\n💤 No recent TD press activity in the last 30 minutes');
    }
    
  } catch (error) {
    console.error('❌ Error checking TD press final status:', error);
  }
}

// Run the script
checkTDPressFinalStatus().catch(console.error);