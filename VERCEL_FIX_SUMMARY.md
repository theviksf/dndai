# Vercel Deployment Fix - Summary

## ✅ Changes Made

### 1. **Version Number Added** (v1.0.0)
- **Location**: Top of screen, left of the cost tracker
- **Display**: Small badge with "v1.0.0" in monospace font
- **Update Process**: Edit line 1432 in `client/src/pages/home.tsx` to change version

### 2. **Fixed Static File Serving for Vercel**

#### Problem Identified:
The catch-all rewrite `/(.*) → /index.html` was intercepting ALL requests including static files like `.md` and `.jpg`, causing 404 errors for prompts and worldmap.

#### Solution Applied:
**Updated `vercel.json` rewrite rule**:
```json
"source": "/((?!.*\\.).*)"
```
This regex **excludes files with extensions** from being rewritten to index.html, allowing:
- `/prompts/primary.md` ✅ (has `.md` extension)
- `/assets/worldmap.jpg` ✅ (has `.jpg` extension)
- `/settings` → `/index.html` ✅ (no extension, SPA route)

### 3. **Created Build Verification Script**
**File**: `build-vercel.sh`
- Runs Vite build
- Verifies prompts and worldmap are in output
- Helps debug if files are missing

**Updated vercel.json**:
- Build command now uses `bash build-vercel.sh`

## 📦 Files Changed

1. ✅ `client/src/pages/home.tsx` - Added version display
2. ✅ `vercel.json` - Fixed rewrite rule to exclude files with extensions
3. ✅ `build-vercel.sh` - Created build verification script
4. ✅ `.vercelignore` - Removed confusing prompts/ exclusion
5. ✅ `client/public/assets/worldmap.jpg` - Moved from attached_assets
6. ✅ `client/src/components/character-stats-bar.tsx` - Updated to use static path

## 🚀 Deploy to Vercel

**1. Commit and push all changes:**
```bash
git add .
git commit -m "Fix: Vercel static file serving + version number v1.0.0"
git push
```

**2. Vercel will auto-deploy**

**3. Test these URLs after deployment:**

✅ **Static files (should work now)**:
```
https://your-app.vercel.app/prompts/primary.md
https://your-app.vercel.app/assets/worldmap.jpg
```

✅ **Main app**:
```
https://your-app.vercel.app/?session=test123
```
- Should show version "v1.0.0" in header
- Should load without "cannot load default prompts" error
- Worldmap should display in character stats

## 🐛 If Still Not Working

### Debug Steps:

**1. Check Vercel Build Logs:**
- Go to Vercel Dashboard → Your Project → Latest Deployment
- Click "Building" tab
- Look for the build verification output:
  ```
  Verifying public directory was copied...
  total 64
  drwxr-xr-x ... prompts/
  -rw-r--r-- ... worldmap.jpg
  Build complete!
  ```

**2. Check Browser Network Tab:**
- Open DevTools (F12) → Network tab
- Load `/prompts/primary.md`
- Should show:
  - Status: 200 OK
  - Type: text/plain or text/markdown
  - Response: markdown content

**3. If files are 404ing:**
- Try "Redeploy" in Vercel with "Clear build cache" option
- Check if Vercel dashboard settings override vercel.json:
  - Settings → General → Build & Development Settings
  - Output Directory should be: `dist/public`
  - Build Command should be: `bash build-vercel.sh`

## 📝 How the Fix Works

### Before (Broken):
```
Request: /prompts/primary.md
↓
Rewrite: /(.*) matches everything
↓
Redirect: /index.html
↓
Result: 404 (React app doesn't have this route)
```

### After (Fixed):
```
Request: /prompts/primary.md
↓
Check rewrite: /((?!.*\\.).*)
↓
Has extension (.md), doesn't match
↓
Serve static file from dist/public/prompts/primary.md
↓
Result: 200 OK ✅
```

## 🎯 Next Steps After Deployment

1. **Verify version number shows** in production
2. **Test prompt loading** - create character, check for errors
3. **Test worldmap** - view character stats, check image loads
4. **Update version number** for each deployment by editing:
   - `client/src/pages/home.tsx` line 1432
   - Change `v1.0.0` to `v1.0.1`, etc.

## 🔄 Future Version Updates

To update the version for each deployment:

```tsx
// File: client/src/pages/home.tsx (line ~1432)
<span className="text-xs text-muted-foreground font-mono">v1.0.1</span>
//                                                          ^^^^^^
//                                                          Change this
```

Consider creating a VERSION file and importing it later for automation.
