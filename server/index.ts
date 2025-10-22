/**
 * Development Server Wrapper for Vercel Deployment
 * 
 * This file exists only to support the local development workflow.
 * In production, this app runs as a static site on Vercel with serverless API routes.
 * 
 * For local development:
 * - This script runs the Vite dev server for the frontend
 * - API routes in /api directory won't work without Vercel CLI (`vercel dev`)
 * 
 * To test API routes locally, use:
 *   npm install -g vercel
 *   vercel dev
 */

import { spawn } from 'child_process';

console.log('🚀 Starting Vite development server...');
console.log('📝 Note: API routes require Vercel CLI to work locally');
console.log('   Run "vercel dev" to test API routes\n');

const vite = spawn('vite', ['--config', 'vite.replit.config.ts', '--host', '0.0.0.0', '--port', '5000'], {
  stdio: 'inherit',
  shell: true
});

vite.on('error', (error) => {
  console.error('Failed to start Vite:', error);
  process.exit(1);
});

vite.on('close', (code) => {
  console.log(`Vite process exited with code ${code}`);
  process.exit(code || 0);
});

// Handle termination signals
process.on('SIGINT', () => {
  vite.kill('SIGINT');
});

process.on('SIGTERM', () => {
  vite.kill('SIGTERM');
});
