import type { GameStateData, GameConfig, GameCharacter, CostTracker, NarrativeMessage } from '@shared/schema';

export async function loadDefaultPromptsFromAPI(): Promise<{
  primary: string;
  parser: string;
  imageCharacter: string;
  imageLocation: string;
  backstory: string;
  revelations: string;
  lore: string;
} | null> {
  try {
    const response = await fetch('/api/prompts/defaults');
    if (!response.ok) {
      console.error('Failed to load default prompts from API');
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading default prompts:', error);
    return null;
  }
}

export function createDefaultGameState(): GameStateData {
  return {
    character: {
      name: '',
      race: '',
      class: '',
      age: '',
      sex: '',
      description: '',
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
        ac: 10,
      },
    },
    location: {
      name: 'Starting Village',
      description: 'A peaceful hamlet at the edge of the wilderness',
      imageUrl: 'https://pub-afdd42fe7a3c42bb872f7beb4a9359ef.r2.dev/loc_village-day-NA-Oakhaven-neutral_o2mq6hGyKD_20251007T045226.jpg',
    },
    previousLocations: [],
    inventory: [],
    spells: [],
    statusEffects: [],
    quests: [],
    companions: [],
    encounteredCharacters: [],
    businesses: [],
    narrativeHistory: [],
    parsedRecaps: [],
    turnCount: 0,
    turnSnapshots: [],
    debugLog: [],
  };
}

export function createDefaultConfig(): GameConfig {
  return {
    primaryLLM: 'deepseek/deepseek-chat-v3.1',
    parserLLM: 'deepseek/deepseek-chat-v3.1',
    backstoryLLM: 'deepseek/deepseek-chat-v3.1',
    revelationsLLM: 'deepseek/deepseek-chat-v3.1',
    loreLLM: 'deepseek/deepseek-chat-v3.1',
    difficulty: 'normal',
    narrativeStyle: 'balanced',
    autoSave: true,
    openRouterApiKey: '',
    dmSystemPrompt: '',
    parserSystemPrompt: '',
    characterImagePrompt: '',
    locationImagePrompt: '',
    backstorySystemPrompt: '',
    revelationsSystemPrompt: '',
    loreSystemPrompt: '',
    imageProvider: 'flux',
    autoGenerateImages: false,
    autoGenerateBackstories: true,
    autoGenerateRevelations: true,
    autoGenerateLore: true,
  };
}

export async function migrateParserPrompt(config: GameConfig): Promise<GameConfig> {
  // Skip migration if config already has version marker (user has edited/saved after version system)
  if ((config as any).promptsVersion === 1) {
    return config;
  }
  
  if (!config.parserSystemPrompt) {
    return config;
  }
  
  const hasOldPrompt = 
    config.parserSystemPrompt.includes('questUpdates') || 
    !config.parserSystemPrompt.includes('companions') ||
    !config.parserSystemPrompt.includes('encounteredCharacters') ||
    !config.parserSystemPrompt.includes('spells') ||
    !config.parserSystemPrompt.includes('businesses') ||
    !config.parserSystemPrompt.includes('"status"');
  
  if (hasOldPrompt) {
    console.log('Migrating old parser prompt to new comprehensive version');
    const defaults = await loadDefaultPromptsFromAPI();
    if (defaults) {
      return {
        ...config,
        parserSystemPrompt: defaults.parser,
        promptsVersion: 1 as any, // Mark as migrated
      };
    }
  }
  
  return {
    ...config,
    promptsVersion: 1 as any, // Mark as current version
  };
}

export async function migrateConfig(config: any): Promise<GameConfig> {
  const defaults = createDefaultConfig();
  const prompts = await loadDefaultPromptsFromAPI();
  
  return {
    ...defaults,
    ...config,
    characterImagePrompt: config.characterImagePrompt || (prompts?.imageCharacter ?? defaults.characterImagePrompt),
    locationImagePrompt: config.locationImagePrompt || (prompts?.imageLocation ?? defaults.locationImagePrompt),
    imageProvider: config.imageProvider || defaults.imageProvider,
    autoGenerateImages: config.autoGenerateImages ?? defaults.autoGenerateImages,
    backstoryLLM: config.backstoryLLM || defaults.backstoryLLM,
    backstorySystemPrompt: config.backstorySystemPrompt || (prompts?.backstory ?? defaults.backstorySystemPrompt),
    autoGenerateBackstories: config.autoGenerateBackstories ?? defaults.autoGenerateBackstories,
    revelationsLLM: config.revelationsLLM || defaults.revelationsLLM,
    revelationsSystemPrompt: config.revelationsSystemPrompt || (prompts?.revelations ?? defaults.revelationsSystemPrompt),
    autoGenerateRevelations: config.autoGenerateRevelations ?? defaults.autoGenerateRevelations,
    loreLLM: config.loreLLM || defaults.loreLLM,
    loreSystemPrompt: config.loreSystemPrompt || (prompts?.lore ?? defaults.loreSystemPrompt),
    autoGenerateLore: config.autoGenerateLore ?? defaults.autoGenerateLore,
    dmSystemPrompt: config.dmSystemPrompt || (prompts?.primary ?? defaults.dmSystemPrompt),
    parserSystemPrompt: config.parserSystemPrompt || (prompts?.parser ?? defaults.parserSystemPrompt),
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
    primaryCost: 0,
    parserCost: 0,
    lastTurnPrimaryTokens: {
      prompt: 0,
      completion: 0,
    },
    lastTurnParserTokens: {
      prompt: 0,
      completion: 0,
    },
    lastTurnPrimaryCost: 0,
    lastTurnParserCost: 0,
    lastTurnCost: 0,
    imageCost: 0,
    lastTurnImageCost: 0,
  };
}

export function migrateCostTracker(tracker: any): CostTracker {
  const defaults = createDefaultCostTracker();
  return {
    ...defaults,
    ...tracker,
    primaryTokens: {
      ...defaults.primaryTokens,
      ...tracker.primaryTokens,
    },
    parserTokens: {
      ...defaults.parserTokens,
      ...tracker.parserTokens,
    },
    lastTurnPrimaryTokens: {
      ...defaults.lastTurnPrimaryTokens,
      ...tracker.lastTurnPrimaryTokens,
    },
    lastTurnParserTokens: {
      ...defaults.lastTurnParserTokens,
      ...tracker.lastTurnParserTokens,
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
