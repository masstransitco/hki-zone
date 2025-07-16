const fetch = require('node-fetch').default || require('node-fetch');

async function testAeMatching() {
  try {
    // Fetch A&E data
    const aeResponse = await fetch('http://localhost:3001/api/ae');
    const aeData = await aeResponse.json();
    
    // Fetch hospital data
    const hospitalResponse = await fetch('http://localhost:3001/api/hospitals');
    const hospitalData = await hospitalResponse.json();
    
    console.log('A&E Articles:', aeData.articles.length);
    console.log('Hospitals:', hospitalData.hospitals.length);
    
    // Test the matching logic
    const combined = hospitalData.hospitals.map((hospital) => {
      const waitingInfo = aeData.articles.find((article) => {
        const hospitalName = hospital.hospital_name_en;
        const articleTitle = article.title;
        
        // Direct match
        if (articleTitle.includes(hospitalName)) {
          return true;
        }
        
        // Handle St. John vs St John
        if (hospitalName === 'St. John Hospital' && articleTitle.includes('St John Hospital')) {
          return true;
        }
        
        return false;
      });
      
      return {
        hospital: hospital.hospital_name_en,
        hasWaitingData: !!waitingInfo,
        waitingTitle: waitingInfo ? waitingInfo.title : null
      };
    });
    
    console.log('\nMatching Results:');
    combined.forEach(item => {
      console.log(`${item.hospital}: ${item.hasWaitingData ? 'MATCH' : 'NO MATCH'} ${item.waitingTitle || ''}`);
    });
    
    const matchCount = combined.filter(item => item.hasWaitingData).length;
    console.log(`\nTotal matches: ${matchCount} of ${combined.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAeMatching();