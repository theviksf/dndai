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
    // Load prompts directly from static files in /prompts/ directory
    const [primary, parser, imageCharacter, imageLocation, backstory, revelations, lore] = await Promise.all([
      fetch('/prompts/primary.md').then(r => r.text()),
      fetch('/prompts/parser.md').then(r => r.text()),
      fetch('/prompts/image-character.md').then(r => r.text()),
      fetch('/prompts/image-location.md').then(r => r.text()),
      fetch('/prompts/backstory.md').then(r => r.text()),
      fetch('/prompts/revelations.md').then(r => r.text()),
      fetch('/prompts/lore.md').then(r => r.text()),
    ]);
    
    return {
      primary,
      parser,
      imageCharacter,
      imageLocation,
      backstory,
      revelations,
      lore,
    };
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
    racialAbilities: [],
    classFeatures: [],
    classPowers: [],
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
    uiScale: 'compact',
  };
}

export async function migrateConfig(config: any): Promise<GameConfig> {
  const defaults = createDefaultConfig();
  
  // Check if any prompts are missing - only fetch from API if needed
  // Use nullish coalescing to properly check for undefined/null (not empty strings)
  const needsPrompts = config.dmSystemPrompt == null || config.parserSystemPrompt == null || 
                       config.characterImagePrompt == null || config.locationImagePrompt == null ||
                       config.backstorySystemPrompt == null || config.revelationsSystemPrompt == null ||
                       config.loreSystemPrompt == null;
  
  const prompts = needsPrompts ? await loadDefaultPromptsFromAPI() : null;
  
  return {
    ...defaults,
    ...config,
    // Preserve user's model selections
    primaryLLM: config.primaryLLM ?? defaults.primaryLLM,
    parserLLM: config.parserLLM ?? defaults.parserLLM,
    backstoryLLM: config.backstoryLLM ?? defaults.backstoryLLM,
    revelationsLLM: config.revelationsLLM ?? defaults.revelationsLLM,
    loreLLM: config.loreLLM ?? defaults.loreLLM,
    // Use nullish coalescing (??) instead of OR (||) to preserve empty strings and falsy values
    characterImagePrompt: config.characterImagePrompt ?? (prompts?.imageCharacter ?? defaults.characterImagePrompt),
    locationImagePrompt: config.locationImagePrompt ?? (prompts?.imageLocation ?? defaults.locationImagePrompt),
    imageProvider: config.imageProvider ?? defaults.imageProvider,
    autoGenerateImages: config.autoGenerateImages ?? defaults.autoGenerateImages,
    backstorySystemPrompt: config.backstorySystemPrompt ?? (prompts?.backstory ?? defaults.backstorySystemPrompt),
    autoGenerateBackstories: config.autoGenerateBackstories ?? defaults.autoGenerateBackstories,
    revelationsSystemPrompt: config.revelationsSystemPrompt ?? (prompts?.revelations ?? defaults.revelationsSystemPrompt),
    autoGenerateRevelations: config.autoGenerateRevelations ?? defaults.autoGenerateRevelations,
    loreSystemPrompt: config.loreSystemPrompt ?? (prompts?.lore ?? defaults.loreSystemPrompt),
    autoGenerateLore: config.autoGenerateLore ?? defaults.autoGenerateLore,
    dmSystemPrompt: config.dmSystemPrompt ?? (prompts?.primary ?? defaults.dmSystemPrompt),
    parserSystemPrompt: config.parserSystemPrompt ?? (prompts?.parser ?? defaults.parserSystemPrompt),
    uiScale: config.uiScale ?? defaults.uiScale,
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
