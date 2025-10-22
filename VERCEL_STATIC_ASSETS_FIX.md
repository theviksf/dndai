# Vercel Static Assets Fix

## What I Fixed

### Problem 1: Worldmap Not Loading in Vercel
**Cause**: `attached_assets/worldmap.jpg` was outside the Vite build directory
**Fix**: 
- Copied to `client/public/assets/worldmap.jpg`
- Changed import from `import worldmapImage from '@assets/worldmap.jpg'` to `const worldmapImage = '/assets/worldmap.jpg'`
- Now served as static file from `/assets/worldmap.jpg`

### Problem 2: Prompts Not Loading in Vercel
**Status**: Already correctly configured!
- Prompts in `client/public/prompts/*.md`
- Frontend loads via `fetch('/prompts/primary.md')` etc.
- Vite automatically copies `client/public/` to `dist/public/` during build

## File Structure (Vercel)

```
client/public/
├── prompts/           # ← Copied to dist/public/prompts/
│   ├── primary.md
│   ├── parser.md
│   ├── backstory.md
│   ├── revelations.md
│   ├── lore.md
│   ├── image-character.md
│   └── image-location.md
└── assets/
    └── worldmap.jpg   # ← Copied to dist/public/assets/worldmap.jpg
```

After Vite build → Vercel deployment:
```
dist/public/
├── index.html
├── assets/
│   ├── index-C7r0NTkd.js
│   ├── index-u-xNDEol.css
│   └── worldmap.jpg          # ← Static file
├── prompts/                  # ← Static files
│   ├── primary.md
│   ├── parser.md
│   └── ...
```

## URLs in Production

✅ **These URLs work in Vercel**:
- `https://your-app.vercel.app/` - Frontend
- `https://your-app.vercel.app/prompts/primary.md` - Static prompt file
- `https://your-app.vercel.app/assets/worldmap.jpg` - Static image

## Next Steps

1. **Commit changes to Git**:
   ```bash
   git add client/public/assets/worldmap.jpg
   git add client/src/components/character-stats-bar.tsx
   git commit -m "Fix: Move worldmap to public assets for Vercel deployment"
   git push
   ```

2. **Vercel auto-deploys** - Wait for build to complete

3. **Verify in production**:
   - Open browser DevTools Network tab
   - Check that `/prompts/primary.md` returns 200 OK
   - Check that `/assets/worldmap.jpg` loads correctly

## Why This Works

**Vite's Public Directory**:
- Everything in `client/public/` is copied to `dist/public/` at build root
- Files are served at the root URL path (not nested)
- No import/bundling needed - served as-is

**Previous Issue**:
- `attached_assets/` was outside Vite's scope
- `@assets` alias doesn't work in Vercel production build
- Files weren't included in `dist/public/` output

**Current Solution**:
- All static assets in `client/public/`
- Vite handles copying automatically
- Works identically in Replit dev and Vercel production
