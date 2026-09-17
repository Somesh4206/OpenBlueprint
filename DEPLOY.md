# Render Deployment Guide — OpenBlueprint

## Deploy Steps

### 1. Go to [render.com](https://render.com) → New → Web Service

### 2. Connect your GitHub repo: `Somesh4206/OpenBlueprint` (main branch)

### 3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `openblueprint` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npx prisma generate && npx prisma db push --accept-data-loss && npm run build` |
| **Start Command** | `node .next/standalone/server.js` |
| **Plan** | `Free` |

### 4. Environment Variables:
```
DATABASE_URL = file:./db/custom.db
NODE_ENV = production
```

### 5. Click Create Web Service

Your app will be live at `https://openblueprint.onrender.com`

## If Build Fails

Make sure these are set in Render dashboard:
- **Node Version**: 18 or 20 (set in Environment, or use .nvmrc)
- **Build Command**: `npm install && npx prisma generate && npx prisma db push --accept-data-loss && npm run build`
- **Start Command**: `node .next/standalone/server.js`

