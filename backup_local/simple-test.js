// Simple test without fetch
const hospitalsData = [
  { hospital_name_en: "Alice Ho Miu Ling Nethersole Hospital" },
  { hospital_name_en: "Caritas Medical Centre" },
  { hospital_name_en: "Kwong Wah Hospital" },
  { hospital_name_en: "Princess Margaret Hospital" },
  { hospital_name_en: "Queen Elizabeth Hospital" },
  { hospital_name_en: "Queen Mary Hospital" },
  { hospital_name_en: "Ruttonjee Hospital" },
  { hospital_name_en: "Tuen Mun Hospital" },
  { hospital_name_en: "United Christian Hospital" },
  { hospital_name_en: "Yan Chai Hospital" },
  { hospital_name_en: "St. John Hospital" }
];

const aeData = [
  { title: "A&E Waiting Time: Alice Ho Miu Ling Nethersole Hospital" },
  { title: "A&E Waiting Time: Caritas Medical Centre" },
  { title: "A&E Waiting Time: Kwong Wah Hospital" },
  { title: "A&E Waiting Time: Princess Margaret Hospital" },
  { title: "A&E Waiting Time: Queen Elizabeth Hospital" },
  { title: "A&E Waiting Time: Queen Mary Hospital" },
  { title: "A&E Waiting Time: Ruttonjee Hospital" },
  { title: "A&E Waiting Time: Tuen Mun Hospital" },
  { title: "A&E Waiting Time: United Christian Hospital" },
  { title: "A&E Waiting Time: Yan Chai Hospital" },
  { title: "A&E Waiting Time: St John Hospital" }
];

// Test matching logic
const combined = hospitalsData.map((hospital) => {
  const waitingInfo = aeData.find((article) => {
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
    matchedTitle: waitingInfo ? waitingInfo.title : null
  };
});

console.log('Matching Results:');
combined.forEach(item => {
  console.log(`${item.hospital}: ${item.hasWaitingData ? 'MATCH' : 'NO MATCH'}`);
  if (item.matchedTitle) {
    console.log(`  -> ${item.matchedTitle}`);
  }
});

const matchCount = combined.filter(item => item.hasWaitingData).length;
console.log(`\nTotal matches: ${matchCount} of ${combined.length}`);