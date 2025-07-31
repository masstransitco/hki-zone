import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export interface AuthenticatedUser {
  id: string
  email: string
  [key: string]: any
}

export interface AuthContext {
  user: AuthenticatedUser
  token: string
}

// Middleware function to authenticate API requests
export async function withAuth<T = any>(
  request: NextRequest,
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse<T>>
): Promise<NextResponse<T>> {
  try {
    // Get auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      ) as NextResponse<T>
    }

    const token = authHeader.split(' ')[1]
    
    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      ) as NextResponse<T>
    }

    // Create auth context
    const authContext: AuthContext = {
      user: {
        id: user.id,
        email: user.email!,
        ...user.user_metadata
      },
      token
    }

    // Call the handler with auth context
    return await handler(request, authContext)

  } catch (error) {
    console.error('Auth middleware error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    ) as NextResponse<T>
  }
}

// Simplified version for quick auth checks
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return null
    }

    return {
      id: user.id,
      email: user.email!,
      ...user.user_metadata
    }
  } catch (error) {
    console.error('Error getting authenticated user:', error)
    return null
  }
}

// Error response helpers
export const authErrorResponses = {
  unauthorized: () => NextResponse.json(
    { error: 'Missing or invalid authorization header' },
    { status: 401 }
  ),
  forbidden: () => NextResponse.json(
    { error: 'Access denied' },
    { status: 403 }
  ),
  invalidToken: () => NextResponse.json(
    { error: 'Invalid authentication token' },
    { status: 401 }
  ),
  serverError: (message = 'Internal server error') => NextResponse.json(
    { error: message },
    { status: 500 }
  )
}