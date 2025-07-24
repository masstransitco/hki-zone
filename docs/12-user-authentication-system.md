# User Authentication System Documentation

## Overview

This document provides comprehensive documentation for the user authentication system implemented in the Panora application. The system provides secure user registration, login, and session management with multi-language support across English, Simplified Chinese, and Traditional Chinese.

## Architecture

### Core Components

1. **Authentication Context** (`/contexts/auth-context.tsx`)
   - Centralized authentication state management
   - User session handling with persistence
   - Profile management with error recovery
   - Enhanced initialization tracking

2. **Supabase Integration** (`/lib/supabase-auth.ts`)
   - Database connection and configuration
   - Authentication client setup with custom storage
   - SSR-safe session persistence
   - Enhanced error handling

3. **Authentication Forms**
   - Registration Form (`/components/auth/register-form.tsx`)
   - Login Form (`/components/auth/login-form.tsx`)

4. **Side Menu Integration** (`/components/side-menu.tsx`)
   - Authentication UI access point
   - User profile display with localization
   - Multi-language support

5. **Auth Callback Handler** (`/app/auth/callback/route.ts`)
   - OAuth redirect handling
   - Session exchange management
   - Error recovery and logging

6. **Auth Initializer** (`/components/auth-initializer.tsx`)
   - Client-side hydration assistance
   - Session persistence validation

## Database Schema

### User Profiles Table

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Row Level Security (RLS) Policies

```sql
-- Allow public read access for username availability checking
CREATE POLICY "Allow public read access" ON user_profiles
  FOR SELECT USING (true);

-- Users can only insert their own profile
CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own profile
CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);
```

## Key Features

### 1. User Registration

**Username Requirements:**
- Must start with `@` symbol
- 4-20 characters total (including @)
- Only letters, numbers, and underscores allowed
- Real-time availability checking

**Process Flow:**
1. User enters username, email, password, and password confirmation
2. Real-time validation with visual feedback
3. Username availability check with debouncing
4. Password confirmation validation
5. Account creation with profile setup

**Visual Feedback:**
- ✅ Green checkmark for available usernames
- 🚫 Block icon for taken usernames
- ❌ X icon for invalid usernames
- ✅ Green check for matching passwords
- ❌ X icon for non-matching passwords

### 2. User Login

**Features:**
- Email and password authentication
- Form validation
- Loading states
- Error handling

### 3. Multi-Language Support

**Supported Languages:**
- English (en)
- Simplified Chinese (zh-CN)
- Traditional Chinese (zh-TW)

**Translation Coverage:**
- Form labels and placeholders
- Validation messages
- Button states
- Success/error notifications
- Menu navigation

### 4. Side Menu Integration

**Authentication States:**
- **Not Authenticated:** Shows "Sign In" and "Create Account" buttons
- **Authenticated:** Shows user profile with username and email, plus "Sign Out" button
- **Loading:** Shows loading spinner with localized text

## Implementation Details

### Authentication Context

```typescript
interface AuthContextType {
  user: AuthUser | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, username: string) => Promise<{ error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  checkUsernameAvailable: (username: string) => Promise<boolean>
}
```

### User Profile Interface

```typescript
interface UserProfile {
  id: string
  username: string
  email: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

interface AuthUser {
  id: string
  email: string
  profile?: UserProfile
}
```

### Supabase Configuration

```typescript
// Custom storage adapter for better persistence
const customStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(key, value)
    } catch (error) {
      console.warn('Failed to store auth session:', error)
    }
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.warn('Failed to remove auth session:', error)
    }
  }
}

export const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'panora-auth-token',
    storage: customStorage
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-web'
    }
  }
})
```

## User Experience Features

### 1. Real-time Username Validation

- **Debounced checking** (500ms delay) to avoid excessive API calls
- **Visual status indicators** with appropriate icons
- **Contextual helper text** in user's selected language

### 2. Password Confirmation

- **Real-time matching validation** with visual feedback
- **Color-coded borders** (green for match, red for mismatch)
- **Status icons** next to password visibility toggle

### 3. Form Enhancement

- **Username clear button** - X button to clear username field
- **Password visibility toggles** for both password fields
- **Proper accessibility** with aria labels and form validation

### 4. Responsive Design

- **Mobile-optimized** form layouts
- **Touch-friendly** buttons and inputs
- **Gesture support** for menu navigation

## Security Features

### 1. Row Level Security (RLS)

- **Profile isolation** - Users can only access their own profiles
- **Public username checking** - Anonymous users can check availability
- **Secure operations** - Insert/update restricted to profile owners

### 2. Password Requirements

- **Minimum 6 characters** length requirement
- **Client-side validation** before submission
- **Server-side validation** through Supabase

### 3. Enhanced Session Management

- **Automatic token refresh** for long-lived sessions
- **Persistent sessions** across browser restarts and page navigation
- **Custom storage adapter** with SSR-safe error handling
- **Session persistence** with explicit storage key (`panora-auth-token`)
- **Graceful storage failure** recovery with fallback mechanisms
- **Secure session detection** for URL-based auth flows

### 4. Authentication Persistence

- **Cross-page navigation** - Auth state persists when navigating between routes
- **Page refresh resilience** - Sessions survive browser refresh
- **SSR compatibility** - Proper server-side rendering support
- **Memory leak prevention** - Component cleanup and mounted state tracking

## Language Support

### Translation Keys

All authentication-related text uses the translation system:

```typescript
// English
"auth.createAccount": "Create account"
"auth.usernameAvailable": "Username is available!"
"auth.passwordsDontMatch": "Passwords do not match"

// Simplified Chinese
"auth.createAccount": "创建账户"
"auth.usernameAvailable": "用户名可用！"
"auth.passwordsDontMatch": "密码不匹配"

// Traditional Chinese
"auth.createAccount": "建立帳戶"
"auth.usernameAvailable": "用戶名可用！"
"auth.passwordsDontMatch": "密碼不匹配"
```

### Menu Integration

The side menu includes comprehensive translations for:

- Section headers (Account, System Status, Language, Theme)
- Authentication buttons and states
- Loading and error messages
- Accessibility labels

## Development Notes

### Environment Configuration

For development environments, email confirmation is disabled:

```sql
-- Confirm all existing users (for development only)
UPDATE auth.users 
SET email_confirmed_at = NOW(), 
    phone_confirmed_at = NOW() 
WHERE email_confirmed_at IS NULL;
```

### Session Persistence Fixes

Recent updates address authentication context persistence issues:

1. **Custom Storage Adapter**: Implements SSR-safe localStorage with error handling
2. **Enhanced Context Initialization**: Better mounting state tracking and cleanup
3. **Auth Callback Route**: Proper OAuth redirect handling at `/auth/callback`
4. **Page Navigation Fix**: Ensures all pages use correct `side-menu` component
5. **Initialization Component**: Client-side hydration assistance

### Testing

- Username availability can be tested with existing usernames
- Password validation works in real-time
- Language switching affects all authentication UI immediately
- Form submission handles both success and error states
- **Authentication persists** across page navigation and browser refresh
- **Debug logging** available in browser console for troubleshooting

### Enhanced Error Handling

- **Network errors** are caught and displayed to users
- **Validation errors** are shown with contextual messages
- **Authentication errors** are handled gracefully with user feedback
- **Loading states** prevent duplicate submissions
- **Storage failures** are handled with graceful degradation
- **Session recovery** attempts automatic restoration on errors
- **Component cleanup** prevents memory leaks and stale state

## Known Issues & Fixes

### Recently Resolved

1. **✅ Authentication Context Loss**: Fixed session persistence across page navigation
2. **✅ SSR Compatibility**: Resolved server-side rendering conflicts with auth state
3. **✅ Side Menu Component**: Fixed incorrect imports causing auth UI not to display
4. **✅ Storage Failures**: Added graceful handling of localStorage issues
5. **✅ Memory Leaks**: Implemented proper component cleanup and state management

### Troubleshooting

If authentication state is lost:

1. **Check browser console** for auth state change logs
2. **Verify localStorage** contains `panora-auth-token` key
3. **Ensure pages import** correct `side-menu` component (not `side-menu-overlay`)
4. **Check network tab** for failed session requests
5. **Refresh page** to trigger session restoration

## Future Enhancements

### Potential Additions

1. **Password Reset Flow** - Currently placeholder implementation
2. **Profile Avatar Upload** - Avatar field exists in schema
3. **Social Authentication** - OAuth providers integration
4. **Two-Factor Authentication** - Enhanced security option
5. **Username Change** - Allow users to update usernames
6. **Account Deletion** - Self-service account removal

### Performance Optimizations

1. **Username Check Caching** - Cache availability results temporarily
2. **Form State Persistence** - Remember form data across sessions
3. **Progressive Enhancement** - Improve experience for slow connections
4. **Session Preloading** - Anticipate auth state for faster navigation

## Conclusion

The authentication system provides a robust, secure, and user-friendly experience with comprehensive multi-language support. The implementation follows modern best practices for security, accessibility, and user experience while maintaining consistency across the entire application.