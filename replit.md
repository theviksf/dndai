# D&D Adventure Game - OpenRouter Powered

## Overview

An interactive Dungeons & Dragons text adventure game that leverages OpenRouter's AI models for dynamic storytelling and intelligent game state management. Players create custom characters, embark on quests, and experience AI-driven narratives with real-time state tracking. The application uses a dual-LLM architecture where users can select their preferred models for both narrative generation and game state parsing.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack**: React with TypeScript, using Vite as the build tool and Wouter for client-side routing.

**UI Framework**: Shadcn UI components built on Radix UI primitives, styled with Tailwind CSS. The application uses a custom D&D-themed design system with parchment textures, ornate borders, and a fantasy color palette featuring warm golds, deep reds, and forest greens.

**State Management**: Local component state with React hooks. Game state is managed at the top level and passed down through props. TanStack Query handles server state and API caching.

**Component Structure**:
- **Home page** (`/`): Main game container orchestrating gameplay with character stats, narrative panel, and inventory/quest display
- **Settings page** (`/settings`): LLM configuration interface with model selection, API key input, and custom prompt editing for both DM and Parser system prompts
- **Character Creation page** (`/character-creation`): Multi-step character creation with race/class/age selection and attribute point-buy system
- **NarrativePanel**: Primary game interface displaying story progression and action input. Shows DM responses immediately, then parses in background
- **CharacterStats**: Real-time display of character attributes, health, XP, status effects, and learned spells
- **InventoryQuestPanel**: Side panel for inventory management, quest tracking, companions, encountered characters, and history display (shows all parsed recaps)

**Path Aliases**: Uses TypeScript path mapping for clean imports (`@/` for client source, `@shared/` for shared types).

**Routing Logic**: Smart navigation flow prevents redirect loops and ensures smooth user experience:
- No character exists → redirect to character creation (`/character-creation`)
- Character exists but no API key and game not started → redirect to settings (`/settings`)
- Character exists and game started → stay on home page even without API key (player will get error when trying to take action)
- This allows players to return from settings page to game page after creating a character, even without an API key

### Backend Architecture

**Server Framework**: Express.js running on Node.js with TypeScript, using ESM modules.

**API Design**: RESTful endpoints proxying requests to OpenRouter's API:
- `POST /api/models`: Fetches available LLM models from OpenRouter
- `POST /api/llm/chat`: Proxies chat completion requests to OpenRouter (standard request/response)
- `POST /api/llm/chat/stream`: Proxies streaming chat completion requests via Server-Sent Events (SSE)
- Game state CRUD endpoints (planned but not fully implemented in current codebase)

**Session Management**: In-memory storage implementation with plans for PostgreSQL persistence. The storage layer is abstracted through an `IStorage` interface allowing easy database swapping.

**Development Setup**: Vite middleware integration for HMR during development, with separate production build pipeline that bundles both client and server code.

### Dual-LLM Architecture

**Primary LLM**: Generates rich, immersive narrative responses (200-400 words) with sensory details, NPC dialogue, and environmental descriptions. Receives a comprehensive context package including all character stats, game state, parsed history summaries, and the last 3 messages to create engaging story progression.

**Parser LLM**: Runs AFTER the narrative is displayed to the player. Extracts structured game state updates from narrative responses, including:
- Character details (name, class, age, level changes)
- Health, gold, XP, and attribute changes
- Status effects and their durations
- Location updates
- Inventory modifications
- Spell learning/forgetting
- Quest progress and new quests
- Companion joining/leaving with detailed tracking (appearance, personality, memories, feelings, relationship)
- Encountered characters with descriptions (NPCs met during adventure)
- Brief 2-3 sentence history recap (stored in `parsedRecaps` for future context)

**Execution Flow**:
1. Player submits action
2. Primary LLM streams narrative response in real-time (word-by-word via SSE)
3. Response chunks are displayed to player as they arrive
4. After streaming completes, parser progress indicator appears
5. Parser LLM analyzes the complete narrative (synchronous)
6. Game state is updated with parsed changes (or continues without updates if parsing fails)
7. Parser progress indicator disappears
8. History recap is added to `parsedRecaps` array (if parsing succeeds)
9. Cost tracker is updated regardless of parser success/failure

**Streaming Implementation**:
- Primary LLM uses Server-Sent Events (SSE) for real-time text streaming via `/api/llm/chat/stream`
- Client buffers incomplete SSE lines across chunk boundaries to prevent data loss
- Parser LLM uses standard request/response (no streaming) via `/api/llm/chat`
- Visual feedback: streaming text appears in real-time, then "Analyzing narrative..." progress bar during parsing

**Error Handling & Resilience**:
- **Robust JSON Parsing**: Multi-strategy extraction system handles malformed LLM responses
  - Primary: Extract JSON from code fences (```json...```)
  - Fallback 1: Direct JSON parsing of response
  - Fallback 2: Balanced-brace scanning to extract JSON objects
  - Sanitization: Removes BOM, normalizes smart quotes, strips trailing commas
- **Dual Structure Support**: Parser validation handles both flat and nested JSON structures
  - Flat: `stateUpdates.level`, `stateUpdates.class`, `stateUpdates.companions`
  - Nested: `stateUpdates.character.level`, `stateUpdates.character.class`, plus top-level arrays
  - Ensures companions, level changes, and class changes are always extracted correctly
- **Type Coercion**: Validates and coerces parsed data to expected types with finite number checks
- **Defensive Defaults**: All UI components use defensive defaults (|| []) to handle undefined fields gracefully
- **Graceful Degradation**: If parser fails, game continues with narrative-only update (no state changes)
  - Non-destructive warning toast shown to player
  - Error details logged to console for debugging
  - Turn count still increments
  - Cost tracking always updates

**Context Management**: To minimize hallucinations and token costs, the Primary LLM receives:
- All parsed history recaps (condensed summaries of past turns)
- Last 6 messages (3 back-and-forth exchanges) from recent conversation
- Complete character stats (HP, gold, XP, attributes, level, class, race, age)
- Current game state (location, inventory, status effects, spells, quests, companions with full details, encountered characters)
- Current player action

This approach maintains narrative coherence while keeping context windows manageable and reducing the risk of LLM hallucinations from long histories. The full companion details (appearance, personality, memories, feelings, relationship) and encountered character data ensure the LLM can reference NPCs accurately.

**Rationale**: Separating concerns allows using more powerful (expensive) models for creative storytelling while using efficient (cheaper) models for structured data extraction, optimizing cost-per-turn. Displaying responses before parsing provides better UX.

**System Prompts**: Both DM and Parser prompts are fully customizable in the settings page. Default prompts guide each LLM's behavior - DM prompt focuses on immersive storytelling while parser prompt emphasizes accurate JSON extraction, comprehensive state tracking, and brief history recap generation.

### Data Storage Solutions

**Current Implementation**: In-memory storage using JavaScript Maps for game state persistence during runtime.

**Planned Implementation**: PostgreSQL database with Drizzle ORM for type-safe database operations and schema management.

**Schema Design** (shared/schema.ts):
- **GameState**: Core game data including character stats (with age field), inventory, spells, status effects, quests, companions, encountered characters, narrative history, and parsedRecaps (array of condensed turn summaries)
- **GameConfig**: User preferences for LLM selection, OpenRouter API key, and customizable system prompts for both DM and Parser LLMs
- **CostTracker**: Tracks token usage and estimated costs per session
- **GameCharacter**: Player character with name, race, class, age, level, XP, HP, gold, and attributes
- **Spell**: Spell data with id, name, level, school, description, and icon
- **Companion**: Detailed companion tracking with id, name, race, age, class, level, appearance, personality, criticalMemories, feelingsTowardsPlayer, and relationship
- **EncounteredCharacter**: NPC tracking with id, name, role, appearance, and description
- Complex nested types for attributes, inventory items, quests, and status effects

**Migration Strategy**: Drizzle Kit configured for PostgreSQL with migrations directory and schema definition path specified.

### Authentication & Authorization

**Current State**: No authentication implemented. API key management handled client-side with optional user-provided OpenRouter keys.

**Security Consideration**: Server-side API key (OPENROUTER_API_KEY environment variable) acts as fallback when users don't provide their own keys.

## External Dependencies

### Third-Party Services

**OpenRouter** (Primary Integration):
- **Purpose**: Unified API gateway providing access to multiple LLM providers (Anthropic Claude, OpenAI GPT, Google Gemini, etc.)
- **Authentication**: Bearer token authentication using API keys
- **Key Endpoints**:
  - `GET https://openrouter.ai/api/v1/models`: Lists available models with pricing and capabilities
  - `POST https://openrouter.ai/api/v1/chat/completions`: Standard OpenAI-compatible chat completion format
- **Rate Limiting**: Handled by OpenRouter per their API limits
- **Cost Management**: Application tracks token usage and provides cost estimates based on model pricing

### Database

**Neon Database** (Serverless PostgreSQL):
- **Connection**: Uses `@neondatabase/serverless` adapter for edge-compatible database connections
- **Configuration**: Connection string stored in `DATABASE_URL` environment variable
- **Session Store**: `connect-pg-simple` configured for PostgreSQL-backed Express sessions (prepared for future implementation)

### UI Component Libraries

**Radix UI**: Comprehensive set of accessible, unstyled React components for building the UI foundation (dialogs, dropdowns, accordions, etc.)

**Shadcn UI**: Pre-styled component collection built on Radix UI, configured for the "new-york" style variant

**Embla Carousel**: Carousel/slider functionality for potential character selection or quest browsing

### Utility Libraries

**TanStack Query**: Server state management with intelligent caching, background refetching, and optimistic updates

**React Hook Form + Zod**: Form state management with schema validation for character creation and settings

**date-fns**: Date formatting and manipulation for timestamp handling

**Drizzle ORM + Drizzle Zod**: Type-safe database queries with automatic Zod schema generation from database schema

**Tailwind CSS**: Utility-first CSS framework with custom configuration for fantasy theme

**Wouter**: Lightweight client-side routing alternative to React Router

### Development Tools

**Replit Plugins**:
- `@replit/vite-plugin-runtime-error-modal`: Enhanced error display during development
- `@replit/vite-plugin-cartographer`: Code navigation and project structure visualization
- `@replit/vite-plugin-dev-banner`: Development environment indicator

**Build Tools**:
- **Vite**: Frontend build tool with fast HMR and optimized production builds
- **esbuild**: Server-side code bundling for production deployment
- **tsx**: TypeScript execution for development server
- **PostCSS + Autoprefixer**: CSS processing pipeline