const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkIncidents() {
  try {
    // Get feed statistics
    const { data: feeds, error: feedError } = await supabase
      .from('gov_feeds')
      .select('*')
      .order('slug');
    
    if (feedError) {
      console.error('Feed error:', feedError);
      return;
    }
    
    console.log('=== GOVERNMENT FEEDS CONFIGURED ===');
    feeds.forEach(feed => {
      console.log(`- ${feed.slug}: ${feed.url} (active: ${feed.active})`);
    });
    
    // Get some recent incidents by category
    const { data: incidents, error: incidentError } = await supabase
      .from('incidents')
      .select('id, source_slug, title, category, severity, source_updated_at')
      .order('source_updated_at', { ascending: false })
      .limit(30);
    
    if (incidentError) {
      console.error('Incident error:', incidentError);
      return;
    }
    
    console.log('\n=== RECENT INCIDENTS BY CATEGORY ===');
    const byCategory = {};
    incidents.forEach(incident => {
      if (!byCategory[incident.category]) {
        byCategory[incident.category] = [];
      }
      byCategory[incident.category].push(incident);
    });
    
    Object.keys(byCategory).forEach(category => {
      console.log(`\n${category.toUpperCase()} (${byCategory[category].length} incidents):`);
      byCategory[category].slice(0, 3).forEach(incident => {
        console.log(`  - ${incident.source_slug}: ${incident.title}`);
      });
    });
    
    // Get TD incidents specifically to analyze
    const { data: tdIncidents, error: tdError } = await supabase
      .from('incidents')
      .select('id, source_slug, title, body, category, severity, source_updated_at')
      .or('source_slug.eq.td_special,source_slug.eq.td_notices,source_slug.eq.td_press')
      .order('source_updated_at', { ascending: false })
      .limit(10);
    
    if (!tdError && tdIncidents) {
      console.log('\n=== TRANSPORT DEPARTMENT INCIDENTS (Sample) ===');
      tdIncidents.forEach(incident => {
        console.log(`\n${incident.source_slug} (${incident.category}):`);
        console.log(`  Title: ${incident.title}`);
        console.log(`  Body: ${incident.body ? incident.body.substring(0, 100) + '...' : 'No body'}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkIncidents();