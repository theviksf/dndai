# ⚠️ CRITICAL: How to Deploy to Vercel

## The Problem You're Seeing

Vercel is bundling the Express server code because it's using the old `package.json` build script. The files I created (`.vercelignore` and `vercel.json`) are in your local Replit environment but **NOT in your Git repository yet**.

## Step-by-Step Solution

### 1. Commit and Push the Fixed Configuration Files

In Replit, run these commands:

```bash
# Stage the critical configuration files
git add .vercelignore
git add vercel.json
git add api/prompts/defaults.ts
git add server/routes.ts

# Commit with a clear message
git commit -m "Fix Vercel deployment: exclude Express server, use static build"

# Push to your repository
git push
```

### 2. Redeploy in Vercel

After pushing, Vercel will automatically redeploy (if you have auto-deploy enabled).

Or manually trigger a redeploy:
- Go to your Vercel dashboard
- Click "Redeploy" on your project
- Vercel will now use the correct build command

### 3. Verify the Build

In the Vercel build logs, you should see:

✅ **CORRECT BUILD**:
```
Running build command: vite build --config vite.config.ts
```

❌ **WRONG BUILD** (what you're seeing now):
```
Running build command: npm run build
(which runs: vite build && esbuild server/index.ts ...)
```

## What I Fixed

### `.vercelignore` (MUST be in Git)
```
server/                  # ← Excludes Express server completely
vite.replit.config.ts
.env
prompts/
```

### `vercel.json` (MUST be in Git)
```json
{
  "buildCommand": "vite build --config vite.config.ts",  # ← NOT npm run build
  "outputDirectory": "dist/public",
  ...
}
```

### API Route (already fixed)
`api/prompts/defaults.ts` now reads from `client/public/prompts/` instead of root `prompts/`

## Quick Verification

Before pushing, verify these files exist locally:

```bash
# Check .vercelignore exists and has correct content
cat .vercelignore | grep "server/"

# Check vercel.json has custom buildCommand
cat vercel.json | grep "buildCommand"

# Should output: "buildCommand": "vite build --config vite.config.ts"
```

## If It Still Fails After Pushing

1. **Check Git Push Worked**:
   ```bash
   git log -1 --oneline
   # Should show your latest commit
   ```

2. **Verify on GitHub/GitLab**:
   - Go to your repository on the web
   - Check that `.vercelignore` and `vercel.json` are there
   - Look at the file contents to confirm they're correct

3. **Force Redeploy in Vercel**:
   - Vercel Dashboard → Deployments → ••• (three dots) → Redeploy
   - Watch the build logs carefully

4. **Override in Vercel Dashboard** (if still failing):
   - Go to Project Settings → General → Build & Development Settings
   - **Build Command**: `vite build --config vite.config.ts`
   - **Output Directory**: `dist/public`
   - Click Save

## Why This Happened

The Vercel deployment is reading from your **Git repository**, not your local Replit files. When you created the Vercel project, it cloned your Git repo, which had the old configuration. My changes are in your Replit workspace but won't affect Vercel until you push them to Git.

## After Successful Deployment

Your app will work like this:
- **Development (Replit)**: Express server on port 5000
- **Production (Vercel)**: Static files + serverless API functions

Both will work identically! 🎉
