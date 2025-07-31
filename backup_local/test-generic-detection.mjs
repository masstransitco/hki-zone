// Test the generic image detection logic
const testImages = [
  'https://hongkongfp.com/wp-content/uploads/2025/07/selina-court.jpg',
  'https://hongkongfp.com/wp-content/uploads/2025/07/prison.jpg', 
  'https://hongkongfp.com/wp-content/uploads/2025/07/sedition-toilet.jpg',
  'https://hongkongfp.com/wp-content/uploads/2025/06/Article-10-Years-3.jpg'
];

console.log('Testing generic image detection...');

testImages.forEach((img, i) => {
  const imgName = img.split('/').pop()?.toLowerCase() || '';
  
  const isGenericImage = imgName.includes('selina-court') || 
                        imgName.includes('prison.jpg') ||
                        imgName.includes('generic') ||
                        imgName.includes('default');
  
  console.log(`${i + 1}. ${imgName}`);
  console.log(`   Generic: ${isGenericImage ? '✅ Yes' : '❌ No'}`);
  console.log('');
});

console.log('Issue: prison.jpg should be generic but selina-court should be specific');
console.log('Let me adjust the detection logic...');