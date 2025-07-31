// Simple check for incident IDs without dependencies
const { createClient } = require('@supabase/supabase-js')

// Using environment variables directly 
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qfkbfcgfpzawlsqomyln.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFma2JmY2dmcHphd2xzcW9teWxuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxODUxNTQ2NSwiZXhwIjoyMDM0MDkxNDY1fQ.4bKJgPBH0n_xjFEWqEIjQNMPZaGbBDClVfFNHfn6N4g'
)

async function checkIncidentIds() {
  console.log('🔍 Checking incident IDs in database...\n')
  
  try {
    // Get recent incidents
    const { data: incidents, error } = await supabase
      .from('incidents')
      .select('id, title, source_slug, created_at, source_updated_at')
      .order('created_at', { ascending: false })
      .limit(20)
    
    if (error) {
      console.error('Error fetching incidents:', error)
      return
    }
    
    if (!incidents || incidents.length === 0) {
      console.log('No incidents found in database.')
      return
    }
    
    console.log(`Found ${incidents.length} recent incidents:`)
    console.log('=' * 60)
    
    incidents.forEach((incident, index) => {
      console.log(`${index + 1}. ID: ${incident.id}`)
      console.log(`   Title: ${incident.title}`)
      console.log(`   Source: ${incident.source_slug}`)
      console.log(`   Created: ${incident.created_at}`)
      console.log(`   Updated: ${incident.source_updated_at}`)
      
      // Analyze ID pattern
      if (incident.id.includes('_')) {
        const parts = incident.id.split('_')
        console.log(`   ID Parts: ${parts.length} parts - [${parts.join(', ')}]`)
        
        // Check if it matches timestamp pattern (YYYYMMDD_HHMMSS)
        const timestampPattern = /\d{8}_\d{6}_/
        if (timestampPattern.test(incident.id)) {
          console.log(`   ⚠️  Contains timestamp pattern!`)
        }
        
        // Check if it matches expected pattern (slug_hash)
        const expectedPattern = /^[a-z_]+_[a-f0-9]{12}$/
        if (expectedPattern.test(incident.id)) {
          console.log(`   ✅ Matches expected pattern (slug_hash)`)
        } else {
          console.log(`   ❌ Does not match expected pattern`)
        }
      }
      console.log('')
    })
    
  } catch (error) {
    console.error('Error in check script:', error)
  }
}

checkIncidentIds()