# Supabase PostgreSQL Setup Guide

## Step 1: Create a Supabase Project

1. **Go to:** [supabase.com](https://supabase.com)
2. **Sign up/Login** with GitHub
3. **Click:** "New Project"
4. **Fill in:**
   - Project Name: `openblueprint` (or any name)
   - Database Password: Create a strong password (SAVE THIS!)
   - Region: Choose closest to your users
   - Plan: Free (500MB, sufficient to start)
5. **Click:** "Create new project"
6. Wait 2-3 minutes for project to initialize

## Step 2: Get Database Connection Strings

1. In your Supabase project dashboard
2. **Go to:** Settings → Database
3. **Scroll to:** "Connection String" section
4. You'll see two connection modes:

### **Connection Pooling (Recommended for Vercel)**
- Copy the **URI** format
- Replace `[YOUR-PASSWORD]` with your database password
- Example:
  ```
  postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
  ```

### **Direct Connection**
- Copy the **URI** format  
- Replace `[YOUR-PASSWORD]` with your database password
- Example:
  ```
  postgresql://postgres.xxxxx:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
  ```

## Step 3: Add to Environment Variables

### **For Local Development:**

Create `.env.local` file in your project root:

```env
# Supabase PostgreSQL Connection
DATABASE_URL="postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxxxx:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres"
```

### **For Vercel Deployment:**

1. Go to your Vercel project dashboard
2. **Settings** → **Environment Variables**
3. Add these variables:

| Name | Value |
|------|-------|
| `DATABASE_URL` | Connection Pooling URL (with `?pgbouncer=true`) |
| `DIRECT_URL` | Direct Connection URL |
| `NODE_ENV` | `production` |

**Important:** Make sure to replace `YOUR_PASSWORD` with your actual Supabase database password!

## Step 4: Run Database Migrations

### **Local Migration:**

```bash
# Generate Prisma Client
npx prisma generate

# Push schema to database (creates tables)
npx prisma db push

# Or create a migration
npx prisma migrate dev --name init
```

### **After Vercel Deployment:**

Option A: Run migration locally (recommended):
```bash
# With production DATABASE_URL in .env.local
npx prisma db push
```

Option B: Add build command in Vercel:
- Go to Project Settings → General → Build & Development Settings
- Override Build Command:
  ```
  npx prisma generate && npx prisma db push --accept-data-loss && npm run build
  ```

## Step 5: Verify Connection

Test the connection locally:

```bash
# Install Prisma CLI if not already
npm install -D prisma

# Test connection
npx prisma db pull
```

If successful, you should see: "Introspecting based on datasource..."

## Step 6: Push Changes to Git

```bash
git add prisma/schema.prisma
git commit -m "Switch to PostgreSQL for Vercel deployment"
git push origin main
```

Vercel will automatically redeploy with the new schema.

---

## Troubleshooting

### Error: "Can't reach database server"
- Check your DATABASE_URL is correct
- Ensure password has no special characters that need URL encoding
- Verify your IP isn't blocked (Supabase allows all by default)

### Error: "Connection pool timeout"
- You're using `DATABASE_URL` without connection pooling
- Make sure your pooling URL includes `?pgbouncer=true`

### Error: "SSL connection required"
- Add `?sslmode=require` to your connection string
- Example: `...postgres?sslmode=require`

### Error: "Migration failed" 
- You might have existing SQLite data
- Delete `prisma/migrations` folder if it exists
- Use `npx prisma db push` instead of `migrate`

---

## Important Notes

✅ **Free Tier Limits:**
- 500MB database storage
- Up to 2GB bandwidth
- Unlimited API requests
- 500MB file storage

✅ **Connection Pooling:**
- Required for serverless (Vercel/Netlify)
- Use the pooler URL as `DATABASE_URL`

✅ **Direct Connection:**
- Use for migrations and Prisma Studio
- Set as `DIRECT_URL` in schema

✅ **Security:**
- Never commit `.env.local` to Git
- Use environment variables in Vercel
- Row Level Security (RLS) is available but not required for this project

---

## Alternative: Vercel Postgres

If you prefer Vercel's native solution:

1. In Vercel project → **Storage** tab
2. **Create Database** → **Postgres**
3. Vercel auto-configures `DATABASE_URL`
4. No additional setup needed!

---

## Next Steps After Setup

1. ✅ Database connected
2. ✅ Schema migrated
3. Deploy to Vercel
4. Test creating a blueprint
5. Monitor database usage in Supabase dashboard
