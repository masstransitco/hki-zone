#!/usr/bin/env node

/**
 * Test Anthropic API Authentication
 */

import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testAnthropicAuth() {
  console.log('🔑 Testing Anthropic API Authentication...\n');
  
  console.log(`API Key format: ${process.env.ANTHROPIC_API_KEY?.substring(0, 20)}...`);
  console.log(`API Key length: ${process.env.ANTHROPIC_API_KEY?.length || 0} characters`);
  
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not found in environment');
    return;
  }
  
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    console.log('📡 Testing simple API call...');
    
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 100,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: 'Hello! Please respond with just "API test successful" if you can read this.'
        }
      ]
    });

    console.log('✅ Anthropic API Authentication Successful!');
    console.log(`Response: ${response.content[0].text}`);
    console.log(`Model: ${response.model}`);
    console.log(`Usage: ${JSON.stringify(response.usage)}`);
    
  } catch (error) {
    console.error('❌ Anthropic API Authentication Failed:', error.message);
    
    if (error.status === 401) {
      console.error('🔑 Authentication Error - API key is invalid or expired');
      console.error('💡 Please check your ANTHROPIC_API_KEY in .env.local');
    } else if (error.status === 429) {
      console.error('⏰ Rate Limit Error - Too many requests');
    } else if (error.status === 400) {
      console.error('📝 Bad Request - Check your request format');
    } else {
      console.error('🔧 Other Error:', error);
    }
  }
}

testAnthropicAuth().catch(console.error);