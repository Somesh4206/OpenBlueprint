# Quick Vercel Deployment Guide

Since local database connection is having network issues, let's set up the database directly in Supabase and deploy to Vercel.

## Step 1: Initialize Database in Supabase

1. **Go to your Supabase project dashboard**
2. **Click on "SQL Editor"** in the left sidebar
3. **Click "New query"**
4. **Copy and paste** the contents of `supabase-init.sql` file
5. **Click "Run"** (or press Ctrl+Enter)
6. You should see: "Success. No rows returned"

This creates all the tables your app needs!

## Step 2: Deploy to Vercel

1. **Go to:** [vercel.com/new](https://vercel.com/new)
2. **Sign in** with GitHub
3. **Click "Import"** next to your `Somesh4206/OpenBlueprint` repository
4. **Configure your project:**
   - Framework Preset: Next.js (auto-detected)
   - Root Directory: `./`
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)

5. **Add Environment Variables** (VERY IMPORTANT):

   Click "Environment Variables" and add these:

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | `postgresql://postgres.majoazhfovwbtmvcperq:Somesh_04026@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres` |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://majoazhfovwbtmvcperq.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_0YZKLgP-PdZ-TiCx4Ln-wg_d_2S_Hmr` |
   | `NODE_ENV` | `production` |

6. **Click "Deploy"**

7. Wait 2-3 minutes for deployment to complete ⏱️

## Step 3: Test Your Deployment

1. Once deployed, Vercel will show you a URL like: `https://open-blueprint-xxxxx.vercel.app`
2. Click on it to open your live app!
3. Test creating a new blueprint

## Troubleshooting

### Build fails with Prisma error
- Make sure `DATABASE_URL` is correctly set in environment variables
- Check that the SQL schema was run successfully in Supabase

### App loads but database errors
- Verify the connection string has the correct password
- Check Supabase logs: Dashboard → Logs → Postgres Logs

### TypeScript errors during build
- The project has `ignoreBuildErrors: true` in config, so this shouldn't stop deployment
- But you can fix them later for better code quality

## What's Next?

✅ Your app is now live!
✅ Database is connected and working
✅ You can create blueprints, use AI assistant, view 3D, export PDFs

### Optional Improvements:
1. Set up a custom domain in Vercel
2. Enable Vercel Analytics
3. Set up monitoring and error tracking
4. Add authentication (NextAuth.js is already in dependencies)

---

## Environment Variables Summary

Copy these for easy reference:

```env
DATABASE_URL="postgresql://postgres.majoazhfovwbtmvcperq:Somesh_04026@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://majoazhfovwbtmvcperq.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_0YZKLgP-PdZ-TiCx4Ln-wg_d_2S_Hmr"
NODE_ENV="production"
```

⚠️ **Security Note:** After deployment is working, consider rotating your Supabase password since it's been shared in this conversation.
