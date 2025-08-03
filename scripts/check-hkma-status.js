const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkHKMAStatus() {
  console.log('📊 Checking HKMA signals status...');
  
  try {
    // Get HKMA signal counts by status
    const { data: statusCounts, error } = await supabase
      .from('government_signals')
      .select('processing_status')
      .like('feed_group', 'hkma%');
    
    if (error) {
      console.error('❌ Error fetching HKMA signals:', error);
      return;
    }
    
    const counts = statusCounts.reduce((acc, signal) => {
      acc[signal.processing_status] = (acc[signal.processing_status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n📈 HKMA Signal Status Counts:');
    for (const [status, count] of Object.entries(counts)) {
      const emoji = status === 'content_complete' ? '✅' : 
                   status === 'content_partial' ? '⚠️' : '🔍';
      console.log(`  ${emoji} ${status}: ${count}`);
    }
    
    // Get details on content_partial signals
    const { data: partialSignals, error: partialError } = await supabase
      .from('government_signals')
      .select('source_identifier, scraping_attempts, updated_at')
      .like('feed_group', 'hkma%')
      .eq('processing_status', 'content_partial')
      .order('updated_at', { ascending: false })
      .limit(5);
    
    if (partialError) {
      console.error('❌ Error fetching partial signals:', partialError);
      return;
    }
    
    if (partialSignals.length > 0) {
      console.log('\n⚠️ HKMA signals still needing content:');
      partialSignals.forEach(signal => {
        console.log(`  ${signal.source_identifier} (attempts: ${signal.scraping_attempts}, updated: ${signal.updated_at})`);
      });
    }
    
    // Get sample of successful signals with body content
    const { data: completeSignals, error: completeError } = await supabase
      .from('government_signals')
      .select('source_identifier, content')
      .like('feed_group', 'hkma%')
      .eq('processing_status', 'content_complete')
      .order('updated_at', { ascending: false })
      .limit(3);
    
    if (completeError) {
      console.error('❌ Error fetching complete signals:', completeError);
      return;
    }
    
    console.log('\n✅ Recently completed HKMA signals:');
    completeSignals.forEach(signal => {
      const languages = signal.content?.languages || {};
      const bodyCounts = Object.entries(languages).map(([lang, content]) => 
        `${lang}:${(content.body || '').length}`
      ).join(', ');
      console.log(`  ${signal.source_identifier} (${bodyCounts})`);
    });
    
  } catch (error) {
    console.error('❌ Error checking HKMA status:', error);
  }
}

// Run the script
checkHKMAStatus().catch(console.error);