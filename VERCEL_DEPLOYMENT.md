# Vercel Deployment Guide

This project has been refactored from an Express + Vite full-stack app to a fully static Vite React app with Vercel serverless API routes.

## Architecture Changes

### Before (Express)
- Express server handling API routes and serving static files
- Server-side game state storage (MemStorage)
- Vite middleware for development
- Single server process handling everything

### After (Vercel)
- Static Vite React app (client-only)
- Vercel serverless functions in `/api` directory
- IndexedDB for all data persistence (client-side)
- No server process - fully static deployment

## API Routes

All backend functionality has been converted to Vercel serverless functions in the `/api` directory:

- `/api/models.ts` - Fetch OpenRouter models
- `/api/llm/chat.ts` - Non-streaming LLM chat completions
- `/api/llm/chat/stream.ts` - Streaming LLM chat completions
- `/api/generate-backstory.ts` - Generate entity backstories
- `/api/generate-lore.ts` - Generate world lore
- `/api/chat/revelations.ts` - Track backstory revelations
- `/api/generate-image.ts` - Generate images (RunPod Flux + Gemini)
- `/api/prompts/defaults.ts` - Load default prompts from filesystem

## Environment Variables

Set these in Vercel dashboard (Settings → Environment Variables):

### Required for LLM Features
- `OPENROUTER_API_KEY` - OpenRouter API key for LLM access
- `OPEN_ROUTER_DEVKEY` - Alternative OpenRouter key (fallback)

### Required for Flux Image Generation
- `RUNPOD_API_KEY` - RunPod API key for Flux 1.1 Schnell

### Required for Image Storage (Cloudflare R2)
- `R2_ACCESS_KEY_ID` - Cloudflare R2 access key
- `R2_SECRET_ACCESS_KEY` - Cloudflare R2 secret key
- `R2_ENDPOINT` - R2 endpoint URL (e.g., `https://ACCOUNT_ID.r2.cloudflarestorage.com`)
- `R2_BUCKET_NAME` - R2 bucket name
- `R2_PUBLIC_URL` - Public URL for R2 bucket (e.g., `https://BUCKET.ACCOUNT.r2.dev`)

## Important Notes

### Build Script
The `package.json` still contains the old build script with esbuild (for the removed Express server). **This is intentional** - Vercel uses the `buildCommand` from `vercel.json` instead, which is set to `vite build`.

If you want to build locally, use:
```bash
vite build
```

Or update the build script in `package.json` to:
```json
"build": "vite build"
```

## Deployment Steps

1. **Push code to GitHub/GitLab/Bitbucket**

2. **Import project in Vercel**
   - Go to vercel.com
   - Click "New Project"
   - Import your repository

3. **Configure environment variables**
   - Add all required environment variables listed above
   - Make sure to add them for all environments (Production, Preview, Development)

4. **Deploy**
   - Vercel will automatically detect the configuration from `vercel.json`
   - Build command: `npm run build` (or `vite build`)
   - Output directory: `dist/public`
   - Install command: `npm install`

5. **Verify deployment**
   - Check that the static site loads
   - Test API routes by trying to load models or generate content
   - Verify IndexedDB persistence works

## Development

### Local Development
```bash
npm install
npm run dev
```

This will start Vite dev server on port 5173 (or similar).

**Note:** API routes won't work in local development without additional setup. You have two options:

1. **Use Vercel CLI** (recommended):
   ```bash
   npm install -g vercel
   vercel dev
   ```
   This runs both the Vite dev server and API routes locally.

2. **Keep Express server for development** (not recommended):
   The old Express server files are in `server/` but are no longer part of the build.

### Production Build
```bash
npm run build
```

Output will be in `dist/public/` directory.

## Data Storage

- **Game State**: Stored in browser IndexedDB (client-side)
- **Prompts**: Default prompts read from `/prompts/*.md` files
  - Custom prompts stored in IndexedDB as part of GameConfig
  - Prompt updates are client-side only (Vercel filesystem is read-only)
- **Images**: Generated images uploaded to Cloudflare R2
  - R2 URLs stored in IndexedDB (not base64 data)

## Important Notes

1. **Filesystem is Read-Only**: Vercel serverless functions cannot write to the filesystem
   - Prompt updates must be stored client-side
   - No server-side game state persistence

2. **Cold Starts**: Serverless functions may have cold start delays (~1-2 seconds)
   - First request after inactivity may be slower
   - Subsequent requests are fast

3. **Timeouts**: Vercel has execution limits
   - Hobby plan: 10 seconds per function
   - Pro plan: 60 seconds per function
   - Image generation with RunPod may timeout on Hobby plan

4. **Bundle Size**: Keep API functions lean
   - Each API route is bundled separately
   - Large dependencies increase cold start time

## Troubleshooting

### API Routes Return 404
- Check `vercel.json` rewrites configuration
- Verify API files are in `/api` directory
- Check function file names match URL paths

### Image Generation Fails
- Verify R2 environment variables are set
- Check RunPod/OpenRouter API keys
- Monitor Vercel function logs for errors

### Prompts Not Loading
- Ensure `/prompts/*.md` files are included in deployment
- Check API route `/api/prompts/defaults` is working
- Verify filesystem reads are using `process.cwd()` correctly

### Database/Storage Issues
- IndexedDB is client-side only - check browser console
- Clear browser IndexedDB if corruption occurs
- Storage quota: ~10GB per origin in most browsers

## Cost Optimization

1. **Use Free Tier Services**:
   - Vercel Hobby: Free for personal projects
   - Cloudflare R2: 10GB free storage, 1M free reads/month
   - OpenRouter: Pay-per-use (use DeepSeek for cheaper costs)

2. **Optimize API Calls**:
   - Cache OpenRouter model list
   - Reuse images when possible
   - Limit debug log sizes

3. **Monitor Usage**:
   - Check Vercel usage dashboard
   - Monitor R2 bandwidth
   - Track OpenRouter API costs

## Migration from Express

If migrating from the old Express version:

1. Data is already in IndexedDB - no migration needed
2. Environment variables may need to be moved to Vercel
3. Custom prompt modifications will be preserved in GameConfig
4. Remove old server dependencies if desired (Express, tsx, etc.)

## Support

For issues:
- Check Vercel function logs in dashboard
- Use browser DevTools to debug client-side issues
- Verify all environment variables are set correctly
