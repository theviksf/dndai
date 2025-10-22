# Vercel Deployment Guide

This D&D Adventure Game uses a **hybrid architecture** that works in both environments:
- **Replit (Development)**: Express server with Vite middleware for local development
- **Vercel (Production)**: Static Vite build + Serverless API routes

## Architecture Overview

### Local Development (Replit)
- Express server (`server/index.ts`) serves the app on port 5000
- Vite runs in middleware mode for Hot Module Replacement (HMR)
- API routes handled by Express router (`server/routes.ts`)
- Uses `vite.replit.config.ts` configuration
- Start with: `npm run dev`

### Production (Vercel)
- Static files built from `client/` directory to `dist/public/`
- Serverless functions in `/api` directory handle all backend logic
- No Express server (excluded via `.vercelignore`)
- Uses `vite.config.ts` configuration
- Build with: `vite build --config vite.config.ts`

## Files Configured for Vercel

### 1. `.vercelignore`
Excludes development-only files from deployment:
```
server/                  # Express server (Replit only)
vite.replit.config.ts   # Replit-specific Vite config
.env                    # Local environment variables
.replit, replit.nix     # Replit configuration
prompts/                # Old prompts location (now in client/public/prompts/)
```

### 2. `vercel.json`
```json
{
  "buildCommand": "vite build --config vite.config.ts",
  "outputDirectory": "dist/public",
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### 3. Serverless API Routes (`/api`)
All backend functionality as Vercel serverless functions:

- `/api/models.ts` - Fetch available OpenRouter models
- `/api/llm/chat.ts` - Non-streaming LLM chat completions
- `/api/llm/chat/stream.ts` - Streaming LLM chat completions with SSE
- `/api/generate-backstory.ts` - Generate entity backstories
- `/api/generate-lore.ts` - Generate world lore and mythology
- `/api/chat/revelations.ts` - Extract and track backstory revelations
- `/api/generate-image.ts` - Generate AI images via Gemini 2.5 Flash
- `/api/prompts/defaults.ts` - Load default system prompts from filesystem

**Important**: Each serverless function reads prompts from `client/public/prompts/` (not root `prompts/`)

### 4. Static Assets
- **Frontend**: Built to `dist/public/` by Vite
- **Prompts**: Served from `client/public/prompts/` (accessible at `/prompts/*.md`)
- **Images**: Imported from `attached_assets/` via `@assets` alias
- **Storage**: All game data stored in browser IndexedDB

## Environment Variables

Set these in **Vercel Dashboard → Settings → Environment Variables**:

### Required for LLM Features
- `OPENROUTER_API_KEY` - Your OpenRouter API key
- `OPEN_ROUTER_DEVKEY` - Fallback OpenRouter key (optional but recommended)

### Optional (for Cloudflare R2 Image Storage)
- `R2_ACCESS_KEY_ID` - Cloudflare R2 access key ID
- `R2_SECRET_ACCESS_KEY` - Cloudflare R2 secret access key
- `R2_ENDPOINT` - R2 endpoint URL (e.g., `https://abc123.r2.cloudflarestorage.com`)
- `R2_BUCKET_NAME` - R2 bucket name
- `R2_PUBLIC_URL` - Public URL for accessing images (e.g., `https://pub-xyz.r2.dev`)

**Note**: Without R2 credentials, image generation will fail but the game will still work.

## Deployment Steps

### 1. Push to Git Repository
```bash
git add .
git commit -m "Ready for Vercel deployment"
git push
```

### 2. Import to Vercel
1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import Project"
3. Select your Git repository
4. Vercel auto-detects `vercel.json` configuration
5. Click "Deploy" (environment variables can be added later)

### 3. Add Environment Variables
1. Go to **Settings → Environment Variables**
2. Add `OPENROUTER_API_KEY` (required)
3. Add `OPEN_ROUTER_DEVKEY` (recommended fallback)
4. Add R2 variables if using image storage
5. Apply to: **Production, Preview, Development**
6. Redeploy if already deployed

### 4. Verify Deployment
Test these endpoints:

- ✅ `https://your-app.vercel.app/` - Frontend loads correctly
- ✅ `https://your-app.vercel.app/prompts/primary.md` - Static prompts accessible
- ✅ `https://your-app.vercel.app/api/models` - API works (POST with `{"apiKey": "sk-..."}`)

## Local Development (Replit)

The app runs seamlessly in Replit using the Express server:

```bash
npm run dev
```

This starts:
- Express server on port 5000
- Vite dev server in middleware mode
- API routes via Express router
- Full HMR support

All API endpoints work identically to Vercel, making local development a true replica of production.

## Troubleshooting

### "Module 'server/index.ts' not found" in Vercel
**Cause**: Vercel is trying to bundle Express server  
**Fix**: `.vercelignore` excludes `server/` directory ✅ (already configured)

### "Failed to load default prompts"
**Cause**: Prompts not found in expected location  
**Fix**: Prompts must be in `client/public/prompts/`, not root `prompts/` ✅ (already fixed)

### API Routes Return 404 in Vercel
**Cause**: Serverless functions not deploying correctly  
**Fix**: 
- Ensure `/api` directory exists and is NOT in `.vercelignore`
- Check `vercel.json` rewrites configuration
- Verify API file exports default handler function

### Image Generation Fails
**Cause**: Missing R2 environment variables or API keys  
**Fix**: 
- Add all R2 variables to Vercel environment
- Check R2 bucket permissions (public read access)
- Verify `R2_PUBLIC_URL` matches actual bucket URL

### Prompts Not Loading in Vercel
**Cause**: `/api/prompts/defaults.ts` reading from wrong directory  
**Fix**: Function reads from `client/public/prompts/` ✅ (already fixed)

## Development vs Production Comparison

| Feature | Replit (Dev) | Vercel (Prod) |
|---------|--------------|---------------|
| **Server** | Express + Vite middleware | Static files + Serverless |
| **Port** | 5000 | N/A (CDN) |
| **API Routes** | `server/routes.ts` | `/api/*.ts` functions |
| **Vite Config** | `vite.replit.config.ts` | `vite.config.ts` |
| **Prompts Location** | `client/public/prompts/` | `client/public/prompts/` |
| **Hot Reload** | ✅ HMR enabled | ❌ Build only |
| **Start Command** | `npm run dev` | N/A (auto-deployed) |
| **Build Command** | N/A | `vite build` |
| **Environment** | `.env` file | Vercel dashboard |

Both environments read prompts from the same location (`client/public/prompts/`) for consistency.

## File Structure Reference

```
.
├── api/                          # Vercel serverless functions
│   ├── models.ts
│   ├── llm/
│   │   ├── chat.ts
│   │   └── chat/stream.ts
│   ├── chat/
│   │   └── revelations.ts
│   ├── generate-backstory.ts
│   ├── generate-lore.ts
│   ├── generate-image.ts
│   └── prompts/
│       └── defaults.ts           # Reads from client/public/prompts/
│
├── server/                       # Express dev server (excluded in Vercel)
│   ├── index.ts
│   └── routes.ts                 # Mirrors all /api routes
│
├── client/
│   ├── public/
│   │   └── prompts/             # Default system prompts (both environments)
│   │       ├── primary.md
│   │       ├── parser.md
│   │       ├── backstory.md
│   │       ├── revelations.md
│   │       ├── lore.md
│   │       ├── image-character.md
│   │       └── image-location.md
│   └── src/
│       └── ...                   # React app source
│
├── .vercelignore                 # Exclude dev files
├── vercel.json                   # Vercel config
├── vite.config.ts                # Production Vite config
└── vite.replit.config.ts         # Development Vite config
```

## Data Persistence

- **Game State**: Browser IndexedDB (client-side only, ~10GB quota)
- **Default Prompts**: Filesystem (`client/public/prompts/*.md`)
- **Custom Prompts**: IndexedDB as part of GameConfig
- **Images**: Cloudflare R2 object storage (URLs stored in IndexedDB)
- **Session Management**: Multi-session support via URL sessionId

No server-side database is used. Everything is client-side or serverless.

## Important Notes

1. **Vercel Filesystem is Read-Only**: Prompt updates are stored client-side in IndexedDB
2. **Cold Starts**: First request after inactivity may take 1-2 seconds
3. **Timeouts**: Hobby plan has 10s limit, Pro plan has 60s limit per function
4. **No Express in Production**: `server/` directory is completely excluded from Vercel builds

## Cost Optimization

**Free Tier Options**:
- Vercel Hobby: Free for personal projects (100GB bandwidth/month)
- Cloudflare R2: 10GB storage + 1M reads free/month
- OpenRouter: Pay-per-use (use DeepSeek or free models to minimize costs)

**Best Practices**:
- Cache model list client-side
- Reuse generated images when possible
- Limit debug log sizes to reduce IndexedDB usage

## Support

**Common Issues**:
- Check Vercel function logs in dashboard
- Use browser DevTools → Application → IndexedDB
- Verify environment variables in Vercel settings

**Debugging**:
- Local: Check `http://localhost:5000/api/prompts/defaults` works
- Production: Check `https://your-app.vercel.app/api/prompts/defaults` returns JSON
