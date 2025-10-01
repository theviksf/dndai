import type { GameStateData, GameConfig, GameCharacter, CostTracker, NarrativeMessage } from '@shared/schema';

export const DM_SYSTEM_PROMPT = `You are an experienced Dungeon Master running a Dungeons & Dragons adventure. Your role is to:

1. Create immersive, engaging narratives that respond to player actions
2. Maintain consistent world-building and character development
3. Include appropriate skill checks and dice rolls when needed
4. Balance challenge with fun and storytelling
5. Present 3-4 meaningful choices after each narrative response

Keep responses vivid but concise (200-400 words). Include sensory details, dialogue from NPCs, and environmental descriptions. When skill checks are needed, specify the type and DC.`;

export const PARSER_SYSTEM_PROMPT = `You are a game state parser for a D&D adventure game. Analyze the DM's narrative response and extract structured data changes.

Your task:
1. Generate a brief 2-3 sentence summary capturing the key events (for history tracking)
2. Identify ALL state changes including: health, gold, XP, attributes, status effects, location, quests, and inventory
3. Be precise with nuance - capture important details without being verbose

Return a JSON object with this exact structure:
{
  "stateUpdates": {
    "hp": number | undefined (current HP if it changed),
    "gold": number | undefined (current gold if it changed),
    "xp": number | undefined (current XP if it changed),
    "attributes": { "str": number, "dex": number, "con": number, "int": number, "wis": number, "cha": number } | undefined (any attributes that changed),
    "location": { "name": string, "description": string } | undefined (if location changed),
    "statusEffects": [{ "id": string, "name": string, "description": string, "icon": string, "turnsRemaining": number }] | undefined (current active effects),
    "inventory": [{ "id": string, "name": string, "description": string, "icon": string, "type": string, "quantity": number, "equipped": boolean, "magical": boolean }] | undefined (complete inventory if it changed),
    "quests": [{ "id": string, "title": string, "description": string, "type": "main" | "side", "icon": string, "completed": boolean, "objectives": [{ "text": string, "completed": boolean }], "progress": { "current": number, "total": number } }] | undefined (complete quest list if it changed)
  },
  "recap": string (REQUIRED: 2-3 sentence summary capturing key events, enough nuance to not miss a beat but very brief)
}

IMPORTANT: Only include fields in stateUpdates that actually changed. The recap field is ALWAYS required.`;


export function createDefaultGameState(): GameStateData {
  return {
    character: {
      name: '',
      race: '',
      class: '',
      level: 1,
      xp: 0,
      nextLevelXp: 300,
      hp: 10,
      maxHp: 10,
      gold: 50,
      attributes: {
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
      },
    },
    location: {
      name: 'Starting Village',
      description: 'A peaceful hamlet at the edge of the wilderness',
    },
    inventory: [],
    statusEffects: [],
    quests: [],
    narrativeHistory: [],
    parsedRecaps: [],
    turnCount: 0,
  };
}

export function createDefaultConfig(): GameConfig {
  return {
    primaryLLM: 'anthropic/claude-3-opus',
    parserLLM: 'anthropic/claude-3-haiku',
    difficulty: 'normal',
    narrativeStyle: 'balanced',
    autoSave: true,
    openRouterApiKey: '',
    dmSystemPrompt: DM_SYSTEM_PROMPT,
    parserSystemPrompt: PARSER_SYSTEM_PROMPT,
  };
}

export function createDefaultCostTracker(): CostTracker {
  return {
    sessionCost: 0,
    turnCount: 0,
    primaryTokens: {
      prompt: 0,
      completion: 0,
    },
    parserTokens: {
      prompt: 0,
      completion: 0,
    },
  };
}

export function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(score: number): string {
  const mod = calculateModifier(score);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}
