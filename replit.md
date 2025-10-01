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
- **Home page**: Main game container orchestrating character creation, settings, and gameplay
- **CharacterCreationModal**: Multi-step character creation with race/class selection and attribute point-buy system
- **SettingsModal**: LLM configuration interface with model selection, API key input, and custom prompt editing for both DM and Parser system prompts
- **NarrativePanel**: Primary game interface displaying story progression and action input. Implements context limiting by sending only parsed history summaries plus 3 most recent messages to the LLM
- **CharacterStats**: Real-time display of character attributes, health, XP, and status effects
- **InventoryQuestPanel**: Side panel for inventory management and quest tracking

**Path Aliases**: Uses TypeScript path mapping for clean imports (`@/` for client source, `@shared/` for shared types).

### Backend Architecture

**Server Framework**: Express.js running on Node.js with TypeScript, using ESM modules.

**API Design**: RESTful endpoints proxying requests to OpenRouter's API:
- `POST /api/models`: Fetches available LLM models from OpenRouter
- `POST /api/llm/chat`: Proxies chat completion requests to OpenRouter
- Game state CRUD endpoints (planned but not fully implemented in current codebase)

**Session Management**: In-memory storage implementation with plans for PostgreSQL persistence. The storage layer is abstracted through an `IStorage` interface allowing easy database swapping.

**Development Setup**: Vite middleware integration for HMR during development, with separate production build pipeline that bundles both client and server code.

### Dual-LLM Architecture

**Primary LLM**: Generates rich, immersive narrative responses (200-400 words) with sensory details, NPC dialogue, and environmental descriptions. Receives parsed history summaries, 3 most recent messages, and the current action to create engaging story progression without hallucination issues from long context windows.

**Parser LLM**: Extracts structured game state updates from narrative responses, including health changes, gold/XP gains, inventory modifications, location updates, and quest progress. Also generates compressed 2-3 sentence recaps that are stored in `parsedRecaps` array for future context building.

**Context Management**: To minimize hallucinations and token costs, the application only sends the Primary LLM:
- All parsed history recaps (condensed summaries of past turns)
- The 3 most recent narrative messages
- Current character state and action

This approach maintains narrative coherence while keeping context windows manageable and reducing the risk of LLM hallucinations from long histories.

**Rationale**: Separating concerns allows using more powerful (expensive) models for creative storytelling while using efficient (cheaper) models for structured data extraction, optimizing cost-per-turn.

**System Prompts**: Both DM and Parser prompts are fully customizable in the settings modal. Default prompts guide each LLM's behavior - DM prompt focuses on immersive storytelling while parser prompt emphasizes accurate JSON extraction and recap generation.

### Data Storage Solutions

**Current Implementation**: In-memory storage using JavaScript Maps for game state persistence during runtime.

**Planned Implementation**: PostgreSQL database with Drizzle ORM for type-safe database operations and schema management.

**Schema Design** (shared/schema.ts):
- **GameState**: Core game data including character stats, inventory, quests, narrative history, and parsedRecaps (array of condensed turn summaries)
- **GameConfig**: User preferences for LLM selection, OpenRouter API key, and customizable system prompts for both DM and Parser LLMs
- **CostTracker**: Tracks token usage and estimated costs per session
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