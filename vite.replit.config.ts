/**
 * Replit-specific Vite configuration wrapper
 * 
 * This config extends the base vite.config.ts and adds Replit-specific
 * host allowlist to enable access via Replit's public URLs.
 * 
 * The base vite.config.ts remains untouched for production builds.
 */

import { mergeConfig, defineConfig } from "vite";
import baseConfig from "./vite.config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    server: {
      host: "0.0.0.0",
      port: 5000,
      allowedHosts: [
        "localhost",
        ".replit.dev",
        ".replit.app",
        ".repl.co",
      ],
    },
  })
);
