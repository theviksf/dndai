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
- **Character Creation page**: Multi-step character generation.
- **CharacterStatsBar**: Expanded two-row display for character information, including a visual health bar, status effects, and week counter showing turn progress (X/15 - Week Y format) that increments each turn and rolls over every 15 turns.
- **NarrativePanel**: Displays AI-generated story progress, supports Markdown rendering (GFM), and includes a custom action text input.
- **GameInfoTabs**: Tabbed interface with 8 tabs (Inventory, Spells, Locations, Business, Quests, Party, NPCs, History). Features notification badges that pulse when parser updates a tab, clearing when opened. Spells tab includes search filtering, level filtering, and sorting by name/level/school with compact card layout. All tabs have consistent icons.
**Routing Logic**: Smart navigation ensures a smooth user experience, preventing redirect loops and guiding users to character creation or settings when necessary.

### Backend Architecture

**Server Framework**: Express.js on Node.js with TypeScript (ESM modules).
**API Design**: RESTful endpoints proxying requests to OpenRouter's API, including model fetching, chat completions, and streaming chat completions via Server-Sent Events (SSE).
**Session Management**: Currently in-memory, with plans for PostgreSQL persistence using an abstracted `IStorage` interface.
**Development Setup**: Vite middleware for HMR, separate production build for client and server.

### Dual-LLM Architecture

The system utilizes two distinct LLMs:
- **Primary LLM**: Generates rich, immersive narrative responses (200-400 words) using comprehensive game context, formatted in Markdown.
- **Parser LLM**: Extracts structured game state updates from the narrative responses *after* they are displayed to the player. Updates include character details, health, gold, XP, attributes, status effects, location, inventory, spells, quests, companions, and encountered characters. It also generates brief history recaps.

**Execution Flow**: Player action → Primary LLM streams narrative → Parser LLM analyzes narrative and updates game state → Cost tracking updates.
**Streaming**: Primary LLM uses SSE for real-time text display; Parser LLM uses standard request/response.
**Error Handling & Resilience**: Robust JSON parsing handles malformed LLM responses using multiple strategies (code fences, direct parse, balanced-brace scanning). It supports both flat and nested JSON structures, performs type coercion, and uses defensive defaults for UI components. If parsing fails, the game gracefully degrades, continuing with narrative-only updates and logging errors.
**Context Management**: The Primary LLM receives a condensed context package, including all parsed history recaps, recent messages, complete character stats, and current game state, to maintain coherence and reduce token costs.
**Rationale**: This architecture optimizes cost-per-turn by using powerful models for creative tasks and efficient models for structured data extraction, while enhancing UX through immediate narrative display.
**System Prompts**: Both DM and Parser prompts are customizable in settings, guiding their respective behaviors.

### Data Storage Solutions

**Current**: In-memory storage using JavaScript Maps.
**Planned**: PostgreSQL with Drizzle ORM for type-safe operations.
**Schema Design**: `GameState` (character stats, inventory, spells, quests, companions, narrative, parsed recaps), `GameConfig` (LLM selections, API keys, custom prompts), `CostTracker`, `GameCharacter`, `Spell`, `Companion`, `EncounteredCharacter`.

## External Dependencies

### Third-Party Services

**OpenRouter**: Unified API gateway for various LLM providers (Anthropic Claude, OpenAI GPT, Google Gemini). Used for authentication via API keys and accessing chat completion endpoints. The application tracks token usage and provides cost estimates.
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