# Authentication Setup Instructions

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

### Authentication Context
The `AuthProvider` is already integrated into the app layout and provides:
- `user`: Current authenticated user with profile
- `session`: Supabase session
- `loading`: Authentication loading state
- `signUp()`: Register a new user
- `signIn()`: Sign in existing user
- `signOut()`: Sign out current user
- `checkUsernameAvailable()`: Check if username is available

### Side Menu Integration
- Click the menu button in the header to open the side menu
- When not authenticated: Shows "Sign In" and "Create Account" buttons
- When authenticated: Shows user profile and "Sign Out" button
- Forms slide in within the same menu for seamless UX

### Protected Routes
Use the `ProtectedRoute` component to protect pages/components:

```tsx
import ProtectedRoute from '@/components/auth/protected-route'

function MyProtectedPage() {
  return (
    <ProtectedRoute>
      <div>This content is only visible to authenticated users</div>
    </ProtectedRoute>
  )
}
```

### Username Requirements
- Must start with @ (automatically added in the form)
- 3-20 characters long (excluding the @)
- Only letters, numbers, and underscores allowed
- Must be unique across all users
- Real-time availability checking as user types

## Features Implemented

✅ **User Registration**: Email + password + @username  
✅ **User Login**: Email + password  
✅ **Username Validation**: Real-time checking with proper format validation  
✅ **Side Menu Integration**: Clean UX within existing menu system  
✅ **User Profiles**: Extended user data with username and avatar support  
✅ **Protected Routes**: Component wrapper for authenticated-only content  
✅ **Authentication State**: Global context with loading states  
✅ **Database Schema**: User profiles table with RLS policies  

## Next Steps (Optional)

- **Saved Articles**: Link articles to users for personalized bookmarks
- **Reading History**: Track user's reading activity
- **User Preferences**: Store personalized settings
- **Social Features**: User interactions, following, etc.
- **Password Reset**: Implement forgot password flow
- **Social Login**: Add Google/Apple sign-in options