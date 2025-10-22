# 🔧 IMMEDIATE FIX: Override in Vercel Dashboard

Since Vercel is still using the wrong build command, you need to **manually override it in the Vercel dashboard**.

## Quick Fix (5 minutes)

### Step 1: Go to Vercel Project Settings
1. Open your Vercel dashboard: https://vercel.com/dashboard
2. Click on your D&D project
3. Go to **Settings** (top navigation)
4. Click **General** in the left sidebar

### Step 2: Override Build Settings
Scroll down to **Build & Development Settings** and set:

**Build Command:**
```
vite build --config vite.config.ts
```
✅ Check "Override" checkbox

**Output Directory:**
```
dist/public
```
✅ Check "Override" checkbox

**Install Command:**
```
npm install
```
(Leave as default or check "Override" if needed)

**Click "Save"** at the bottom

### Step 3: Trigger New Deployment
1. Go to **Deployments** tab
2. Click the **••• (three dots)** on the latest deployment
3. Click **Redeploy**
4. Watch the build logs - it should now say:
   ```
   Running "vite build --config vite.config.ts"
   ```

## Why This Works

By overriding in the dashboard:
- Vercel ignores `package.json` build script
- Vercel ignores `vercel.json` (if it's not in Git yet)
- Uses your manual settings instead

## Expected Build Output

✅ **CORRECT** (what you should see):
```
Running "vite build --config vite.config.ts"
✓ built in 3.45s
dist/public/index.html
dist/public/assets/...
```

❌ **WRONG** (what you're seeing now):
```
Running "npm run build"
> vite build && esbuild server/index.ts...
(bundling Express server code)
```

## After It Works

Once Vercel is deploying correctly, you can:
1. Commit `.vercelignore` and `vercel.json` to Git
2. Remove the manual override from Vercel dashboard
3. Let `vercel.json` control the build instead

But for now, **manual override is the fastest fix**.

## Troubleshooting

**If build still fails:**
- Make sure `client/public/prompts/` directory exists in your Git repo
- Check that all files in `/api` directory are in Git
- Verify environment variables are set in Vercel (OPENROUTER_API_KEY, etc.)

**If build succeeds but app doesn't work:**
- Check Vercel function logs for errors
- Verify API routes are accessible: `https://your-app.vercel.app/api/models`
- Ensure environment variables are set for Production environment
