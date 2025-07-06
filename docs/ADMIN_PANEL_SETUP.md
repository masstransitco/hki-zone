# Admin Panel Setup Guide

This guide will help you set up the admin panel with full article editing capabilities.

## Prerequisites

- Supabase project with environment variables configured
- Access to Supabase Dashboard

## Database Setup

### 1. Check Current Database Status

First, check which migrations need to be run:

```bash
curl http://localhost:3000/api/admin/database/status
```

This will show you which columns are missing and which migrations need to be applied.

### 2. Run Required Migrations

Run the migrations in this order:

#### a. Base Articles Table (if not exists)
```bash
curl -X POST http://localhost:3000/api/setup-database
```

#### b. AI Enhancement Fields
```bash
curl -X POST http://localhost:3000/api/admin/database/migrate-ai-enhancement
```

#### c. Language Field
```bash
curl -X POST http://localhost:3000/api/admin/database/add-language-field
```

#### d. Deleted At Field (for soft deletes)
```bash
curl -X POST http://localhost:3000/api/admin/database/add-deleted-at-field
```

### 3. Verify All Migrations

After running all migrations, verify the status:

```bash
curl http://localhost:3000/api/admin/database/status
```

You should see all columns as existing and no pending migrations.

## Storage Setup

### Create Storage Bucket for Article Images

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **Storage** section
3. Click **"Create a new bucket"**
4. Configure the bucket:
   - Name: `article-images`
   - Public: **Yes** (if you want images to be publicly accessible)
   - File size limit: 10MB (or your preference)
   - Allowed MIME types: `image/*`
5. Click **"Create bucket"**

### Storage Policies (Optional)

If you want to restrict uploads to authenticated users only:

1. In the Storage section, click on the `article-images` bucket
2. Go to **Policies** tab
3. Create a new policy:
   - Name: "Allow authenticated uploads"
   - Policy type: INSERT
   - SQL: `(auth.role() = 'authenticated')`

## Testing the Setup

### 1. Test Article Editing

Try editing an article in the admin panel:
- Navigate to `/admin/articles`
- Click on any article
- Click the **Edit** button
- Make changes and save

### 2. Test Image Upload

In edit mode:
- Use the **Upload Image** button to test file uploads
- Or paste an image URL directly

### 3. Test Soft Delete

- Click the **Delete** button on an article
- Confirm the deletion
- The article should disappear from the list

## Troubleshooting

### "Disconnected" Status

If you see "Disconnected" instead of "Live News":
1. Check that all migrations have been run
2. Verify your Supabase environment variables are set correctly
3. Check the browser console for specific errors

### Missing Column Errors

If you get errors about missing columns:
1. Run the database status check endpoint
2. Apply any pending migrations
3. Refresh the page

### Storage Upload Errors

If image uploads fail:
1. Verify the `article-images` bucket exists
2. Check that the bucket is set to public (or has appropriate policies)
3. Ensure file size is under 10MB

## Security Considerations

**⚠️ IMPORTANT**: The admin panel currently has no authentication. Before deploying to production:

1. Implement authentication (Supabase Auth, NextAuth, or Clerk)
2. Protect all `/admin/*` routes with middleware
3. Add role-based access control
4. Enable Row Level Security (RLS) on the articles table

## Next Steps

1. Add authentication to protect admin routes
2. Implement rich text editor for better content editing
3. Add bulk operations for managing multiple articles
4. Create activity logs to track admin actions