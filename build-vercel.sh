#!/bin/bash
set -e

echo "Building with Vite..."
vite build --config vite.config.ts

echo "Verifying public directory was copied..."
ls -la dist/public/prompts/ || echo "WARNING: prompts not found!"
ls -la dist/public/assets/worldmap.jpg || echo "WARNING: worldmap not found!"

echo "Build complete!"
