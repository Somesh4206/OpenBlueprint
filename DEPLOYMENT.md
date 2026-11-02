# OpenBlueprint Deployment Guide

## Option 1: Deploy to Vercel (Recommended for Next.js)

### Prerequisites
- GitHub/GitLab/Bitbucket account
- Vercel account (free tier available)

### Steps

1. **Push your code to Git**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Connect your Git repository
   - Vercel will auto-detect Next.js configuration
   - Click "Deploy"

3. **Configure Database (Important!)**
   
   SQLite doesn't work on Vercel's serverless environment. You need to switch to PostgreSQL:
   
   **Option A: Use Vercel Postgres (Recommended)**
   - In your Vercel project, go to "Storage" tab
   - Click "Create Database" → "Postgres"
   - Copy the `DATABASE_URL` connection string
   - Add it to your project's Environment Variables
   
   **Option B: Use External PostgreSQL (Supabase, Neon, Railway)**
   - Create a free PostgreSQL database on:
     - [Supabase](https://supabase.com) (Recommended, 500MB free)
     - [Neon](https://neon.tech) (Free tier available)
     - [Railway](https://railway.app) (Free $5 credit)
   - Copy the connection string
   - Add to Vercel Environment Variables as `DATABASE_URL`
   
4. **Update Prisma Schema for PostgreSQL**
   
   Edit `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"  // Changed from "sqlite"
     url      = env("DATABASE_URL")
   }
   ```

5. **Run Database Migration**
   ```bash
   npx prisma migrate dev --name init
   git add .
   git commit -m "Switch to PostgreSQL"
   git push
   ```
   
   Vercel will automatically redeploy.

### Environment Variables in Vercel
Go to Project Settings → Environment Variables and add:
- `DATABASE_URL` - Your PostgreSQL connection string
- `NODE_ENV` - Set to `production`
- Any AI API keys your project needs

---

## Option 2: Deploy to Render

Render supports persistent disk storage, so SQLite will work!

### Steps

1. **Push your code to Git**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Deploy to Render**
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your Git repository
   - Render will detect the `render.yaml` configuration
   - Or manually configure:
     - **Build Command**: `npm install && npx prisma generate && npm run build`
     - **Start Command**: `npm run start`
     - **Environment**: Node
     - **Plan**: Starter ($7/month for persistent disk)

3. **Add Persistent Disk**
   - In your web service settings, go to "Disks"
   - Click "Add Disk"
   - Name: `openblueprint-data`
   - Mount Path: `/var/data`
   - Size: 1 GB

4. **Configure Environment Variables**
   Go to "Environment" tab and add:
   - `DATABASE_URL` = `file:/var/data/prod.db`
   - `NODE_ENV` = `production`

5. **Initialize Database**
   After first deployment, run in Render Shell:
   ```bash
   npx prisma db push
   ```

---

## Option 3: Quick Deploy (One-Click)

### Deploy to Vercel (1-Click)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/OpenBlueprint)

### Deploy to Render (1-Click)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

---

## Post-Deployment Checklist

- [ ] Database is connected and working
- [ ] Environment variables are set
- [ ] Run `prisma db push` or migrations
- [ ] Test creating a new blueprint
- [ ] Test AI assistant functionality
- [ ] Test 3D visualization
- [ ] Test PDF export
- [ ] Check performance and load times

---

## Troubleshooting

### Build fails with "Cannot find module 'prisma'"
Run: `npm install prisma @prisma/client`

### Database connection errors
- Verify `DATABASE_URL` is correctly set
- For Vercel: Ensure using PostgreSQL, not SQLite
- For Render: Ensure disk is mounted at `/var/data`

### TypeScript build errors ignored
The project has `ignoreBuildErrors: true` in `next.config.ts`. This is intentional but you may want to fix them for production.

### Missing environment variables
Copy `.env.example` to `.env.local` and fill in required values.

---

## Performance Optimization

After deployment:
1. Enable **Edge Caching** in Vercel/Render
2. Optimize images with Next.js Image component
3. Enable **Incremental Static Regeneration (ISR)** for static pages
4. Monitor with Vercel Analytics or Render Metrics

---

## Cost Estimates

### Vercel
- **Hobby (Free)**: 100GB bandwidth, serverless functions
- **Pro ($20/month)**: More bandwidth, advanced analytics

### Render
- **Free**: 750 hours/month, no persistent disk
- **Starter ($7/month)**: Always on, persistent disk included

---

## Support

For deployment issues:
- [Vercel Documentation](https://vercel.com/docs)
- [Render Documentation](https://render.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
