# Vercel Deployment Debug Guide

## ✅ Confirmed Working Locally

Build output verified:
```
dist/public/
├── index.html
├── test.html (NEW - for testing)
├── assets/
│   ├── worldmap.jpg ✅
│   ├── index-*.js
│   └── index-*.css
└── prompts/
    ├── primary.md ✅
    ├── parser.md ✅
    └── ... (all 7 prompt files)
```

## 🔧 Changes Made

### 1. Fixed .vercelignore
**Removed**: `prompts/` exclusion (was potentially causing confusion)

### 2. Fixed vercel.json
**Current configuration**:
```json
{
  "buildCommand": "vite build --config vite.config.ts",
  "outputDirectory": "dist/public",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**How Vercel processes requests**:
1. Check if static file exists in `dist/public/`
2. If yes → serve it
3. If no → apply rewrite to `/index.html`

### 3. Added Test Page
**New file**: `dist/public/test.html`
- Tests static file access directly
- Will be available at: `https://your-app.vercel.app/test.html`

## 🧪 Testing After Deployment

### Test URLs to try:

1. **Test page** (bypasses SPA):
   ```
   https://your-app.vercel.app/test.html
   ```
   ✅ Should show test page with prompts content and worldmap image

2. **Direct static files**:
   ```
   https://your-app.vercel.app/prompts/primary.md
   https://your-app.vercel.app/assets/worldmap.jpg
   ```
   ✅ Should return raw files (not 404)

3. **Main app**:
   ```
   https://your-app.vercel.app/?session=test123
   ```
   ✅ Should load without "cannot load default prompts" error

## 🐛 If Still Not Working

### Check Vercel Build Logs:
1. Go to Vercel dashboard → your deployment
2. Click "Building" or "Deployment" tab
3. Look for:
   - Build command: Should be `vite build --config vite.config.ts`
   - Output directory: Should show files in `dist/public/`
   - Any errors during build

### Check Browser DevTools:
1. Open browser DevTools (F12)
2. Network tab
3. Try loading `/prompts/primary.md`
4. Check:
   - Status code (should be 200, not 404 or 301)
   - Response headers
   - Response body (should be markdown text)

### Potential Issues:

**Issue 1**: Vercel dashboard overriding vercel.json settings
- **Fix**: In Vercel dashboard → Settings → ensure build settings match vercel.json

**Issue 2**: Build cache
- **Fix**: In Vercel deployment → "..." menu → "Redeploy" → check "Clear build cache"

**Issue 3**: Wrong output directory structure
- **Fix**: Verify in Vercel build logs that files are actually in the output

## 📝 Next Steps

1. Commit all changes:
   ```bash
   git add .vercelignore vercel.json client/public/assets/worldmap.jpg client/src/components/character-stats-bar.tsx
   git commit -m "Fix Vercel static file serving"
   git push
   ```

2. Wait for Vercel auto-deploy (or manually trigger)

3. Test the URLs above

4. If test.html works but main app doesn't, the issue is in the frontend code fetch logic

5. If test.html doesn't work, the issue is in Vercel configuration
