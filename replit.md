# D&D Adventure Game - OpenRouter Powered

## Overview

An interactive Dungeons & Dragons text adventure game leveraging OpenRouter's AI models for dynamic storytelling and intelligent game state management. Players create custom characters, embark on quests, and experience AI-driven narratives with real-time state tracking. The application features a dual-LLM architecture, allowing users to select preferred models for both narrative generation and game state parsing. The project's vision is to deliver an immersive, AI-driven narrative experience that adapts dynamically to player choices, offering high replayability and a personalized D&D adventure.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack**: React with TypeScript, Vite, Wouter for routing, Shadcn UI (Radix UI + Tailwind CSS) for a D&D-themed design.
**State Management**: React hooks for local state, TanStack Query for server state.
**Key Components**:
- **Home page**: Main game interface with character stats, narrative, and tabbed info (inventory, spells, quests, etc.).
- **Settings page**: LLM configuration, API key input, custom prompt editing, and game settings (auto-save, image generation).
- **Character Creation page**: Multi-step character generation with optional `.ogl` file import.
- **CharacterStatsBar**: Modern, organized stats display with D&D-themed design, responsive layout.
- **NarrativePanel**: Displays AI-generated story (Markdown), includes action input.
- **GameInfoTabs**: Tabbed interface for game elements with notification badges and detailed views (e.g., Spells with filtering, NPCs with relationship status).
- **EntityDetailSheet**: Wide modal for detailed views of NPCs, companions, quests, locations, and businesses, featuring in-place editing, revelatory displays with turn badges, and optimized character stats.
- **Header Navigation**: Cost Tracker, Save Game, and Game Menu with logical sections for game actions, data management, and system settings.
**Routing Logic**: Smart navigation for smooth user experience.

### Backend Architecture

**Server Framework**: Express.js on Node.js with TypeScript (ESM modules).
**API Design**: RESTful endpoints proxying OpenRouter API for model fetching and chat completions (streaming via SSE).
**API Key Management**: Fallback chain for OpenRouter API keys (user-provided > environment variable > secret).
**Prompt Management System**: Default prompts stored as markdown files in `/prompts/`, served via `/api/prompts/defaults`, with user customization and reset options. Automatic timestamped backups are created when default prompt files are updated via API or CLI, stored in `/prompts/`.
**Development Setup**: Vite middleware for HMR.

### Multi-Agent LLM Architecture

Uses specialized LLMs for different tasks:
- **Primary LLM (Narrative Agent)**: Generates rich narrative responses (200-400 words) in Markdown using comprehensive game context.
- **Parser LLM (State Extraction Agent)**: Extracts structured game state updates from narrative responses (character details, inventory, quests, etc.) and generates history recaps.
- **Revelations Agent**: Identifies and extracts backstory revelations from narrative for entities, tracks when they are discovered, and provides in-game notifications and debug logging.
- **Image Agent**: Generates AI images for characters, NPCs, companions, and locations using Google's Gemini 2.5 Flash Image Preview via OpenRouter.
- **Backstory Agent**: Generates structured backstories for NPCs, companions, quests, and locations.
**Execution Flow**: Player action → Primary LLM streams narrative → Parser LLM updates game state → Revelations Agent tracks reveals → Image Agent generates visuals → Backstory Agent creates context → Cost tracking updates.
**Streaming**: Primary LLM uses SSE; others use standard request/response.
**Error Handling & Resilience**: Robust JSON parsing with multiple strategies for malformed LLM responses, type coercion, and graceful degradation.
**Context Management**: Primary LLM receives a condensed context (history, messages, stats, state) for coherence and cost reduction.
**System Prompts**: All agent prompts are customizable in settings, with defaults in `/prompts/`.

### NPC-to-Companion Migration System

When an NPC joins the party as a companion, the system automatically migrates their data to prevent duplication and preserve continuity:

**Migration Process**:
1. **Detection**: When the parser adds a new companion, the system checks if an NPC exists with the same name (case-insensitive) or ID
2. **Data Preservation**: If a matching NPC is found, all their data is migrated to the companion:
   - **imageUrl**: AI-generated portrait preserved
   - **backstory**: Generated backstory preserved
   - **revelations**: Discovered revelations preserved
   - **id**: Entity ID maintained for continuity
3. **Field Mapping**: NPC fields are intelligently mapped to companion equivalents:
   - `role` → `class` (e.g., "Merchant" → "Merchant")
   - `description` → `appearance` (fallback if appearance not set)
   - `relationship` (numeric -3 to +3) → relationship text ("Hostile", "Unfriendly", "Neutral", "Friendly", "Ally")
4. **Cleanup**: The NPC is automatically removed from the `encounteredCharacters` list after migration
5. **Duplication Prevention**: When adding NPCs, the system checks if they're already companions and skips adding them

**Benefits**: Players see NPCs only once (either in NPCs tab or Party tab), with all generated content (images, backstories, revelations) preserved when they join the party. No redundant AI generation needed.

### Data Storage Solutions

**IndexedDB Storage (Primary)**: All game data stored in browser IndexedDB (Dexie.js) for capacity and performance. Each game has a unique `sessionId` in the URL. Supports multi-session management, migration from localStorage, and UI for storage display. Base64 image data is sanitized, only R2 URLs are persisted.

**Snapshot System (Undo/Rollback)**: Turn snapshots stored in IndexedDB for game state restoration. Clicking "Undo" opens a dialog showing all available snapshots (newest to oldest), each displaying:
- Turn count badge (e.g., "2 turns ago")
- Timestamp of snapshot creation
- Narrative preview (first 80 characters of last DM message)
- Snapshot size in KB/MB

Players can select any snapshot to restore the game to that exact point. All newer snapshots are automatically removed upon restoration. Snapshots are optimized for storage by:
- Removing all imageUrl fields (R2 URLs preserved in main game state)
- Limiting debug logs to last 30 entries
- Keeping maximum 10 snapshots (oldest auto-pruned)
- Storing state, costTracker, and timestamp for each snapshot

**Image Storage (Cloudflare R2)**: AI-generated images stored in Cloudflare R2 using AWS S3-compatible API to prevent local storage quota issues. Uses structured filenames for identification and session tracking. R2 credentials are stored in Replit secrets.

## External Dependencies

### Third-Party Services

**OpenRouter**: Unified API gateway for various LLM providers (Anthropic Claude, OpenAI GPT, Google Gemini) for chat completions and model access.
**Cloudflare R2**: Object storage service for AI-generated images.
**Neon Database**: Serverless PostgreSQL for database connections (future integration).

### UI Component Libraries

**Radix UI**: Accessible, unstyled React components.
**Shadcn UI**: Pre-styled components built on Radix UI.
**Embla Carousel**: Carousel functionality.

### Utility Libraries

**TanStack Query**: Server state management.
**React Hook Form + Zod**: Form management and validation.
**date-fns**: Date manipulation.
**Drizzle ORM + Drizzle Zod**: Type-safe database queries (future integration).
**Tailwind CSS**: Utility-first CSS framework.
**Wouter**: Lightweight client-side routing.
**React Markdown + Remark GFM**: Markdown rendering.