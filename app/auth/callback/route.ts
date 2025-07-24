import { NextRequest, NextResponse } from 'next/server'
import { supabaseAuth } from '@/lib/supabase-auth'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    try {
      const { data, error } = await supabaseAuth.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Error exchanging code for session:', error)
        return NextResponse.redirect(`${origin}/?error=auth-callback-error`)
      }

      console.log('Successfully exchanged code for session:', data.user?.id)
      
      // Redirect to the home page or a success page
      return NextResponse.redirect(`${origin}/`)
    } catch (error) {
      console.error('Unexpected error in auth callback:', error)
      return NextResponse.redirect(`${origin}/?error=unexpected-error`)
    }
  }

  // No code parameter, redirect to home
  return NextResponse.redirect(`${origin}/`)
}