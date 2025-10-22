/**
 * Development Server for Local Replit Development
 * 
 * This Express server enables local development by:
 * 1. Serving API routes (mirroring Vercel serverless functions)
 * 2. Running Vite dev server for the frontend
 * 
 * For Production (Vercel):
 * - This file is NOT used
 * - Vercel serves static files and uses /api serverless functions
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import apiRoutes from './routes.js';

const app = express();
const PORT = 5000;

async function startServer() {
  // Parse JSON bodies
  app.use(express.json({ limit: '50mb' }));
  
  // Mount API routes
  app.use('/api', apiRoutes);
  
  // Create Vite server in middleware mode (without its own server)
  const vite = await createViteServer({
    configFile: './vite.replit.config.ts',
    server: {
      middlewareMode: true,
    },
    appType: 'spa',
  });
  
  // Use Vite's middleware to serve the frontend
  app.use(vite.middlewares);
  
  // Start the server with error handling
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📡 API routes available at http://localhost:${PORT}/api/*`);
    console.log(`🎮 Frontend served by Vite with HMR\n`);
  });
  
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Exiting...`);
      process.exit(1);
    } else {
      throw err;
    }
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
