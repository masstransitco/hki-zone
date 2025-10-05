import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Log the token for testing purposes
    console.log('📱 Push notification token registered:', token);

    // In a real app, you would save this token to your database
    // along with user information for targeted notifications

    // For now, we'll just store it in memory or log it
    // You can extend this to save to your database:
    /*
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
      .from('push_tokens')
      .upsert([
        {
          token,
          device_type: 'ios',
          registered_at: new Date().toISOString(),
          active: true
        }
      ]);
    */

    return NextResponse.json({
      success: true,
      message: 'Token registered successfully',
      token: token.substring(0, 20) + '...' // Only show partial token for security
    });
  } catch (error) {
    console.error('Error registering push token:', error);
    return NextResponse.json(
      { error: 'Failed to register token' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Push token registration endpoint',
    method: 'POST',
    body: { token: 'device_push_token' }
  });
}