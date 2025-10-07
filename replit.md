# D&D Adventure Game - OpenRouter Powered

## Overview

An interactive Dungeons & Dragons text adventure game leveraging OpenRouter's AI models for dynamic storytelling and intelligent game state management. Players create custom characters, embark on quests, and experience AI-driven narratives with real-time state tracking. The application features a dual-LLM architecture, allowing users to select preferred models for both narrative generation and game state parsing. The project's vision is to deliver an immersive, AI-driven narrative experience that adapts dynamically to player choices, offering high replayability and a personalized D&D adventure.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack**: React with TypeScript, Vite, and Wouter for routing.
**UI Framework**: Shadcn UI built on Radix UI primitives, styled with Tailwind CSS, featuring a D&D-themed design with parchment textures and a fantasy color palette.
**State Management**: React hooks for local state, TanStack Query for server state and API caching.
**Component Structure**:
- **Home page**: Main game interface with expanded character stats, narrative panel, and tabbed info panel (inventory, spells, quests, companions, NPCs, history).
- **Settings page**: LLM configuration, API key input, and custom prompt editing.
- **Character Creation page**: Multi-step character generation with optional file import feature allowing users to skip manual creation by uploading a .ogl save game file (character is extracted from the save).
- **CharacterStatsBar**: Expanded two-row display for character information, including a visual health bar, status effects, and week counter showing turn progress (X/15 - Week Y format) that increments each turn and rolls over every 15 turns.
- **NarrativePanel**: Displays AI-generated story progress, supports Markdown rendering (GFM), and includes a custom action text input.
- **GameInfoTabs**: Tabbed interface with 8 tabs (Inventory, Spells, Locations, Business, Quests, Party, NPCs, History). Features notification badges that pulse when parser updates a tab, clearing when opened. Spells tab includes search filtering, level filtering, and sorting by name/level/school with compact card layout. NPCs tab displays sex/gender and relationship status (-3 to +3 scale) with color-coded text. All tabs have consistent icons.
- **EntityDetailSheet**: Modern sidebar/sheet that opens when clicking on entity images. Features wider layout (sm:max-w-3xl), full-width images with hover scaling, and prominent NPC status badges. Status indicators use green badge with Heart icon for alive NPCs and red badge with Skull icon for dead NPCs. All entities support in-place editing with comprehensive field updates.
**Routing Logic**: Smart navigation ensures a smooth user experience, preventing redirect loops and guiding users to character creation or settings when necessary.

### Backend Architecture

**Server Framework**: Express.js on Node.js with TypeScript (ESM modules).
**API Design**: RESTful endpoints proxying requests to OpenRouter's API, including model fetching, chat completions, and streaming chat completions via Server-Sent Events (SSE).
**API Key Management**: Uses a fallback chain for OpenRouter API keys: explicit user-provided key → OPENROUTER_API_KEY environment variable → OPEN_ROUTER_DEVKEY secret. This allows the application to function without requiring users to provide their own API keys.
**Session Management**: Currently in-memory, with plans for PostgreSQL persistence using an abstracted `IStorage` interface.
**Development Setup**: Vite middleware for HMR, separate production build for client and server.
**Prompt Management System**: Default prompts are stored as markdown files in `/prompts/` folder (primary.md, parser.md, image-character.md, image-location.md). The `/api/prompts/defaults` endpoint serves these defaults, enabling users to customize prompts per session while retaining the ability to reset to defaults via UI buttons in settings.
- **Automatic Backups**: When updating default prompt files, the system automatically creates timestamped backups (e.g., `primary-2025-10-07T06-30-45.md`) before applying changes. Two methods available:
  - **API Endpoint**: `POST /api/prompts/update` with `{ promptType, content }` - creates backup and updates file
  - **CLI Script**: `npx tsx scripts/update-prompt.ts <promptType> <contentFilePath>` - creates backup and updates from file
- **Backup Storage**: All backups are stored in the `/prompts/` directory with descriptive timestamps for easy version tracking and rollback

### Dual-LLM Architecture

The system utilizes two distinct LLMs:
- **Primary LLM**: Generates rich, immersive narrative responses (200-400 words) using comprehensive game context, formatted in Markdown.
- **Parser LLM**: Extracts structured game state updates from the narrative responses *after* they are displayed to the player. Updates include character details, health, gold, XP, attributes, status effects, location, inventory, spells, quests, companions, and encountered characters. It also generates brief history recaps.

**Execution Flow**: Player action → Primary LLM streams narrative → Parser LLM analyzes narrative and updates game state → Cost tracking updates.
**Streaming**: Primary LLM uses SSE for real-time text display; Parser LLM uses standard request/response.
**Error Handling & Resilience**: Robust JSON parsing handles malformed LLM responses using multiple strategies (code fences, direct parse, balanced-brace scanning). It supports both flat and nested JSON structures, performs type coercion, and uses defensive defaults for UI components. If parsing fails, the game gracefully degrades, continuing with narrative-only updates and logging errors.
**Context Management**: The Primary LLM receives a condensed context package, including all parsed history recaps, recent messages, complete character stats, and current game state, to maintain coherence and reduce token costs.
**Rationale**: This architecture optimizes cost-per-turn by using powerful models for creative tasks and efficient models for structured data extraction, while enhancing UX through immediate narrative display.
**System Prompts**: Both DM and Parser prompts are customizable in settings, with default prompts stored as markdown files in `/prompts/` folder. Users can modify prompts per session and reset to defaults via "Reset to Default" buttons in the settings UI. The system includes prompts for narrative generation, state parsing, character image generation, and location image generation.

### Data Storage Solutions

**Session-Based Storage**: All game data is stored in browser localStorage with session-scoped keys. Each game has a unique session ID in the URL (e.g., `/?session=abc123`), allowing multiple independent games to coexist.
- **Session ID**: 10-character unique identifier generated using nanoid
- **Storage Keys**: All localStorage keys are prefixed with session ID (e.g., `gameCharacter_abc123`, `gameConfig_abc123`, `turnSnapshots_abc123`)
- **Session Management**: Session ID is automatically created on first visit and persists in URL across all navigation
- **Multi-Session Support**: Users can have multiple games by changing the session parameter in URL
- **New Game Button**: Creates a fresh session with new ID, resetting to default settings and prompting for new character creation

**Image Storage (Cloudflare R2)**: AI-generated images are stored in Cloudflare R2 cloud storage to prevent localStorage quota issues.
- **Storage Service**: Uses AWS S3-compatible API via @aws-sdk/client-s3
- **Filename Convention**: Structured filenames for easy identification and session tracking
  - Characters: `char_[age]-[sex]-[race]-[job]-[mood]_[sessionId]_[timestamp].jpg`
  - Companions: `comp_[age]-[sex]-[race]-[job]-[mood]_[sessionId]_[timestamp].jpg`
  - NPCs: `npc_[age]-[sex]-[race]-[job]-[mood]_[sessionId]_[timestamp].jpg`
  - Locations: `loc_[environment]-[timeOfDay]-[weather]-[region]-[vibe]_[sessionId]_[timestamp].jpg`
- **Upload Flow**: Base64 image from LLM → Backend converts to Buffer → Upload to R2 → Return public URL
- **Configuration**: R2 credentials stored in Replit secrets (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME)
- **Rationale**: Eliminates localStorage quota errors caused by large base64 images, enables persistent image storage across sessions

**Future**: PostgreSQL with Drizzle ORM for type-safe operations.
**Schema Design**: `GameState` (character stats, inventory, spells, quests, companions, narrative, parsed recaps), `GameConfig` (LLM selections, API keys, custom prompts), `CostTracker`, `GameCharacter`, `Spell`, `Companion`, `EncounteredCharacter`.

## External Dependencies

### Third-Party Services

**OpenRouter**: Unified API gateway for various LLM providers (Anthropic Claude, OpenAI GPT, Google Gemini). Used for authentication via API keys and accessing chat completion endpoints. The application tracks token usage and provides cost estimates.
**Cloudflare R2**: Object storage service for AI-generated images. Uses S3-compatible API for uploading and hosting images with structured filenames.
**Neon Database**: Serverless PostgreSQL used for database connections.

### UI Component Libraries

**Radix UI**: Accessible, unstyled React components forming the UI foundation.
**Shadcn UI**: Pre-styled components built on Radix UI.
**Embla Carousel**: Carousel functionality.

### Utility Libraries

**TanStack Query**: Server state management with caching and background refetching.
**React Hook Form + Zod**: Form management and schema validation.
**date-fns**: Date formatting and manipulation.
**Drizzle ORM + Drizzle Zod**: Type-safe database queries and Zod schema generation.
**Tailwind CSS**: Utility-first CSS framework with custom fantasy theme configuration.
**Wouter**: Lightweight client-side routing.
**React Markdown + Remark GFM**: Markdown rendering for narrative text with custom D&D-themed styling.