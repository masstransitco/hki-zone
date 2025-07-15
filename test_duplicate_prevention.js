// Test script to verify duplicate prevention works
// Run this after applying the database changes

const crypto = require('crypto');

// Test the new content-based ID generation
function generateIncidentId(slug, title, content = '') {
  const normalizedTitle = title.trim().toLowerCase().replace(/\s+/g, ' ');
  const normalizedContent = content ? content.trim().toLowerCase().replace(/\s+/g, ' ') : '';
  const contentHash = crypto.createHash('sha256')
    .update(`${slug}:${normalizedTitle}:${normalizedContent}`)
    .digest('hex')
    .slice(0, 12);
  
  return `${slug}_${contentHash}`;
}

// Test cases
console.log('Testing duplicate prevention...\n');

// Test 1: Same content should generate same ID
const title1 = "Traffic disruption on Central Road";
const content1 = "Road closure due to maintenance work";
const id1 = generateIncidentId('td_notices', title1, content1);
const id2 = generateIncidentId('td_notices', title1, content1);

console.log('Test 1 - Same content:');
console.log(`ID 1: ${id1}`);
console.log(`ID 2: ${id2}`);
console.log(`Same ID: ${id1 === id2 ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 2: Different content should generate different IDs
const title2 = "Traffic disruption on Nathan Road";
const content2 = "Road closure due to construction work";
const id3 = generateIncidentId('td_notices', title2, content2);

console.log('Test 2 - Different content:');
console.log(`ID 1: ${id1}`);
console.log(`ID 3: ${id3}`);
console.log(`Different ID: ${id1 !== id3 ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 3: Same content with different whitespace should generate same ID
const title3 = "  Traffic   disruption  on   Central  Road  ";
const content3 = "  Road   closure  due   to   maintenance   work  ";
const id4 = generateIncidentId('td_notices', title3, content3);

console.log('Test 3 - Same content with different whitespace:');
console.log(`ID 1: ${id1}`);
console.log(`ID 4: ${id4}`);
console.log(`Same ID: ${id1 === id4 ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 4: Same content from different sources should generate different IDs
const id5 = generateIncidentId('hko_warn', title1, content1);

console.log('Test 4 - Same content from different sources:');
console.log(`ID 1 (td_notices): ${id1}`);
console.log(`ID 5 (hko_warn): ${id5}`);
console.log(`Different ID: ${id1 !== id5 ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('All tests completed!');