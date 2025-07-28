# Redux-Based Authentication Setup Instructions

## Dependencies

First, ensure you have the required Redux packages installed:

```bash
npm install @reduxjs/toolkit react-redux redux-persist
```

## Database Setup

1. **Run the User Profiles Migration**
   - Go to your Supabase dashboard
   - Navigate to the SQL Editor
   - Copy and run the contents of `supabase/user_profiles.sql`

2. **Enable Authentication in Supabase**
   - Go to Authentication > Settings
   - Enable Email authentication
   - Set the Site URL to your domain (e.g., `http://localhost:3000` for development)
   - Configure redirect URLs if needed

3. **Environment Variables**
   Make sure you have these environment variables set:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

## Usage

### Redux Store Integration
The Redux store is integrated into the app layout via `ReduxProvider` and provides:
- **Predictable state management** with Redux Toolkit
- **Persistent sessions** with Redux Persist
- **Type-safe hooks** for auth operations
- **Built-in error handling** and timeout protection

### Auth Hooks
Use the modern auth hooks instead of context:

```typescript
import { useAuth, useAuthUser, useIsAuthenticated } from '@/hooks/redux-auth'

// Main auth hook with all functionality
const { user, loading, signIn, signOut, error } = useAuth()

// Specific selector hooks for better performance
const user = useAuthUser()
const isAuthenticated = useIsAuthenticated()
```

### Side Menu Integration
- Click the menu button in the header to open the side menu
- When not authenticated: Shows "Sign In" and "Create Account" buttons
- When authenticated: Shows user profile and "Sign Out" button
- Forms slide in within the same menu for seamless UX

### Protected Routes
Use the `ProtectedRoute` component or auth hooks to protect pages/components:

```tsx
import ProtectedRoute from '@/components/auth/protected-route'
import { useAuthGuard } from '@/hooks/redux-auth'

// Option 1: Using ProtectedRoute component
function MyProtectedPage() {
  return (
    <ProtectedRoute>
      <div>This content is only visible to authenticated users</div>
    </ProtectedRoute>
  )
}

// Option 2: Using auth guard hook
function MyComponent() {
  const { requireAuth, isAuthenticated } = useAuthGuard()
  
  const handleProtectedAction = () => {
    requireAuth(() => {
      // This code only runs if user is authenticated
      console.log('User is authenticated!')
    })
  }
}
```

### Username Requirements
- Must start with @ (automatically added in the form)
- 3-20 characters long (excluding the @)
- Only letters, numbers, and underscores allowed
- Must be unique across all users
- Real-time availability checking as user types

## Features Implemented

✅ **Redux-based State Management**: Predictable auth state with Redux Toolkit  
✅ **User Registration**: Email + password + @username with async thunks  
✅ **User Login**: Email + password with proper error handling  
✅ **Username Validation**: Real-time checking with timeout protection  
✅ **Side Menu Integration**: Clean UX within existing menu system  
✅ **User Profiles**: Extended user data with username and avatar support  
✅ **Protected Routes**: Component wrapper for authenticated-only content  
✅ **Session Persistence**: Redux Persist for reliable session storage  
✅ **Database Schema**: User profiles table with RLS policies  
✅ **TypeScript Integration**: Fully typed hooks and state management  
✅ **Error Handling**: Comprehensive timeout and error recovery  

## Next Steps (Optional)

- **RTK Query Integration**: Replace manual API calls with RTK Query
- **Optimistic Updates**: Implement optimistic UI updates for better UX
- **Cached Username Checks**: Add caching to username availability checks
- **Background Token Refresh**: Implement proactive token renewal
- **Enhanced Profiles**: Add more user profile fields and avatar upload
- **Social Login**: Add Google/Apple sign-in options with Redux integration
- **Advanced Error Recovery**: Implement retry mechanisms for failed operations

## Migration from Legacy Auth Context

If migrating from the old context-based system:

1. **Replace imports**: Change `@/contexts/auth-context` to `@/hooks/redux-auth`
2. **Update hook usage**: Use specific selector hooks for better performance
3. **Handle loading states**: Use `initializing` and `loading` states appropriately
4. **Error handling**: Switch to new error structure with `clearError()` function
5. **Test thoroughly**: Verify all auth-dependent components work correctly