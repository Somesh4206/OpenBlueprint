# Render Deployment Guide — OpenBlueprint

## Deploy Steps

### 1. Go to [render.com](https://render.com) → New → Web Service

### 2. Connect your GitHub repo: `Somesh4206/OpenBlueprint` (main branch)

### 3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `openblueprint` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npx prisma generate && npx prisma db push && npm run build` |
| **Start Command** | `node .next/standalone/server.js` |
| **Plan** | `Free` |

### 4. Environment Variables:
```
DATABASE_URL=file:./db/custom.db
```

### 5. Click Create Web Service

Your app will be live at `https://openblueprint.onrender.com`
