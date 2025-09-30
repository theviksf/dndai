import type { GameStateData, GameConfig, GameCharacter, CostTracker, NarrativeMessage } from '@shared/schema';

export const DM_SYSTEM_PROMPT = `You are an experienced Dungeon Master running a Dungeons & Dragons adventure. Your role is to:

1. Create immersive, engaging narratives that respond to player actions
2. Maintain consistent world-building and character development
3. Include appropriate skill checks and dice rolls when needed
4. Balance challenge with fun and storytelling
5. Present 3-4 meaningful choices after each narrative response

Keep responses vivid but concise (200-400 words). Include sensory details, dialogue from NPCs, and environmental descriptions. When skill checks are needed, specify the type and DC.`;

export const PARSER_SYSTEM_PROMPT = `You are a game state parser for a D&D adventure game. Analyze the DM's narrative response and extract structured data.

Return a JSON object with:
{
  "stateUpdates": {
    "hp": number (if health changed),
    "gold": number (if gold changed),
    "xp": number (if experience gained),
    "location": { "name": string, "description": string } (if location changed),
    "inventoryChanges": { "add": [], "remove": [] } (if items gained/lost),
    "statusEffects": [] (active effects),
    "questUpdates": [] (quest progress changes)
  },
  "recap": string (2-3 sentence summary for history),
  "suggestedActions": [
    { "action": string, "description": string, "icon": string }
  ] (3-4 contextual actions)
}

Be precise and only include fields that actually changed.`;

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
