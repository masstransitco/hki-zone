// Content Processing Pipeline
// Shared utilities for content cleaning and quality assessment across scrapers

/**
 * Content Quality Assessment
 * Evaluates article content quality based on multiple factors
 */
export function assessContentQuality(article) {
  const assessment = {
    score: 0,
    issues: [],
    recommendations: []
  };

  // Basic validation
  if (!article.body || article.body.length < 100) {
    assessment.issues.push('Content too short');
    assessment.recommendations.push('Check extraction selectors');
    return { ...assessment, score: 0 };
  }

  // Length scoring (0-30 points)
  const bodyLength = article.body.length;
  if (bodyLength >= 1000) assessment.score += 30;
  else if (bodyLength >= 500) assessment.score += 20;
  else if (bodyLength >= 200) assessment.score += 10;

  // Structure scoring (0-25 points)
  const paragraphs = article.body.split('\n\n').filter(p => p.trim().length > 0);
  if (paragraphs.length >= 5) assessment.score += 25;
  else if (paragraphs.length >= 3) assessment.score += 15;
  else if (paragraphs.length >= 2) assessment.score += 10;

  // Content cleanliness (0-25 points)
  const cleanlinessIssues = [];
  if (article.body.includes('background-color')) cleanlinessIssues.push('CSS styling');
  if (article.body.includes('cursor:pointer')) cleanlinessIssues.push('CSS properties');
  if (article.body.includes('rgba(')) cleanlinessIssues.push('Color values');
  if (article.body.match(/^\{.*\}/m)) cleanlinessIssues.push('JSON fragments');
  if (article.body.includes('Subscribe')) cleanlinessIssues.push('Subscription prompts');
  
  assessment.score += Math.max(0, 25 - (cleanlinessIssues.length * 5));
  if (cleanlinessIssues.length > 0) {
    assessment.issues.push(`Content contamination: ${cleanlinessIssues.join(', ')}`);
    assessment.recommendations.push('Improve content filtering');
  }

  // Metadata completeness (0-20 points)
  let metadataScore = 0;
  if (article.headline && article.headline.length > 10) metadataScore += 5;
  if (article.coverImg) metadataScore += 5;
  if (article.date) metadataScore += 5;
  if (article.id || article.url) metadataScore += 5;
  assessment.score += metadataScore;

  // Quality classification
  if (assessment.score >= 80) assessment.quality = 'excellent';
  else if (assessment.score >= 60) assessment.quality = 'good';
  else if (assessment.score >= 40) assessment.quality = 'fair';
  else assessment.quality = 'poor';

  return assessment;
}

/**
 * Content Cleaning Pipeline
 * Advanced content cleaning that can be applied after initial extraction
 */
export function processContent(content, source = 'generic') {
  if (!content) return '';

  let processed = content;

  // Universal cleaning
  processed = processed
    // Remove HTML entities and normalize whitespace
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')           // Only normalize spaces and tabs, preserve newlines
    .replace(/\n{3,}/g, '\n\n');       // Normalize excessive line breaks

  // Source-specific cleaning
  switch (source.toLowerCase()) {
    case 'scmp':
      processed = cleanSCMPContent(processed);
      break;
    case 'am730':
      processed = cleanAM730Content(processed);
      break;
    // Add more sources as needed
  }

  // Final cleaning - preserve original paragraph structure
  processed = processed
    .trim()
    .replace(/^\s*[\(\)]+\s*$/gm, '') // Remove lines with only parentheses
    .replace(/^\s*-+\s*$/gm, '')      // Remove lines with only dashes
    .replace(/\n{3,}/g, '\n\n');      // Normalize line breaks only

  return processed;
}

/**
 * SCMP-specific content cleaning
 */
function cleanSCMPContent(content) {
  let cleaned = content
    .replace(/^\s*\d{2}:\d{2}\s*$/gm, '')                    // Timestamps
    .replace(/^\s*SCMP\+?.*$/gim, '')                        // SCMP+ promotions
    .replace(/.*background-color:#[^;]+;.*$/gm, '')          // CSS styling
    .replace(/.*cursor:pointer.*$/gm, '')                    // CSS cursor
    .replace(/.*box-shadow:.*$/gm, '')                       // CSS shadows
    .replace(/.*no-repeat center.*$/gm, '')                  // CSS backgrounds
    .replace(/.*rgba\([^)]+\).*$/gm, '')                     // CSS colors
    .replace(/.*webkit-appearance.*$/gm, '')                 // CSS webkit
    .replace(/^Why you can trust SCMP.*$/gm, '')             // Trust banners
    .replace(/^@\w+.*$/gm, '')                               // Schema declarations
    .replace(/^\s*[\{\}].*$/gm, '');                         // JSON fragments
    
  // Improve paragraph structure for SCMP JSON-LD content
  // Convert single line breaks between complete sentences into paragraph breaks
  cleaned = cleaned
    .replace(/\.\s*\n(?=[A-Z""])/g, '.\n\n')                 // Sentence ending + line break + capital letter = new paragraph
    .replace(/\n{3,}/g, '\n\n');                             // Normalize excessive breaks
    
  return cleaned;
}

/**
 * AM730-specific content cleaning
 */
function cleanAM730Content(content) {
  return content
    .replace(/^(返回|分享：|ADVERTISEMENT|熱門搜尋|支持AM730|Facebook|Instagram|Youtube|搜尋|登出|我的收藏|積分及獎賞|活動列表|帳戶概覽)$/gm, '')
    .replace(/熱門搜尋:.*$/gm, '')
    .replace(/window\._taboola.*$/gm, '')
    .replace(/_taboola\.push.*$/gm, '')
    .replace(/element reset style.*$/gm, '')
    .replace(/css specificities.*$/gm, '');
}

/**
 * Content Structure Analysis
 * Analyzes the structure and readability of content
 */
export function analyzeContentStructure(content) {
  if (!content) return null;

  const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const words = content.split(/\s+/).filter(w => w.length > 0);

  return {
    paragraphs: paragraphs.length,
    sentences: sentences.length,
    words: words.length,
    averageWordsPerParagraph: Math.round(words.length / paragraphs.length),
    averageWordsPerSentence: Math.round(words.length / sentences.length),
    readabilityScore: calculateReadabilityScore(sentences, words),
    structure: {
      hasIntroduction: paragraphs.length > 0 && paragraphs[0].length > 100,
      hasConclusion: paragraphs.length > 1 && paragraphs[paragraphs.length - 1].length > 50,
      wellStructured: paragraphs.length >= 3 && words.length >= 200
    }
  };
}

/**
 * Simple readability score calculation
 */
function calculateReadabilityScore(sentences, words) {
  if (sentences.length === 0 || words.length === 0) return 0;
  
  const avgWordsPerSentence = words.length / sentences.length;
  
  // Simple heuristic: optimal is 15-20 words per sentence
  if (avgWordsPerSentence >= 15 && avgWordsPerSentence <= 20) return 100;
  if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 25) return 80;
  if (avgWordsPerSentence >= 5 && avgWordsPerSentence <= 30) return 60;
  return 40;
}

/**
 * Batch Content Processing
 * Process multiple articles with quality assessment
 */
export function processBatch(articles, source = 'generic') {
  return articles.map(article => {
    const processedBody = processContent(article.body, source);
    const quality = assessContentQuality({ ...article, body: processedBody });
    const structure = analyzeContentStructure(processedBody);
    
    return {
      ...article,
      body: processedBody,
      _quality: quality,
      _structure: structure
    };
  });
}