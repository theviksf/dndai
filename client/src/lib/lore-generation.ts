import { apiRequest } from '@/lib/queryClient';
import type { GameConfig, DebugLogEntry, GameStateData } from '@shared/schema';
import { nanoid } from 'nanoid';
import { runWithRetry } from './agent-retry';
import { reportAgentError } from './agent-error-context';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export interface LoreGenerationOptions {
  gameState: GameStateData;
  config: GameConfig;
}

export interface LoreGenerationResult {
  worldLore: string | null;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
  debugLogEntry?: DebugLogEntry;
}

export async function generateWorldLore({ 
  gameState,
  config 
}: LoreGenerationOptions): Promise<LoreGenerationResult> {
  const timestamp = Date.now();
  const id = `lore-${timestamp}-${nanoid(6)}`;
  const systemPrompt = config.loreSystemPrompt;
  const model = config.loreLLM;
  
  // Sanitize gameState to remove large unnecessary fields before sending
  const { debugLog, turnSnapshots, ...sanitizedGameState } = gameState;
  
  // Build context for lore generation
  const context = buildLoreContext(gameState);
  
  const result = await runWithRetry(
    () => apiRequest('POST', '/api/generate-lore', {
      systemPrompt,
      context,
      gameState: sanitizedGameState,
      model,
      apiKey: config.openRouterApiKey,
    }),
    async (response) => response.json(),
    {
      agentName: 'Lore Agent',
      maxRetries: MAX_RETRIES,
      baseDelayMs: BASE_DELAY_MS,
    }
  );

  if (!result.success) {
    reportAgentError('Lore Agent', result.error || 'Unknown error');
    
    const debugLogEntry: DebugLogEntry = {
      id,
      timestamp,
      type: 'lore',
      prompt: systemPrompt,
      response: JSON.stringify({ error: result.error }),
      model,
      error: result.error,
    };
    
    return { 
      worldLore: null,
      debugLogEntry,
    };
  }

  const data = result.data;
  
  const debugLogEntry: DebugLogEntry = {
    id,
    timestamp,
    type: 'lore',
    prompt: data.fullPrompt || systemPrompt,
    response: data.rawResponse || JSON.stringify({ worldLore: data.worldLore, model: data.model }, null, 2),
    model: data.model || model,
    tokens: data.usage,
  };
  
  return {
    worldLore: data.worldLore || null,
    usage: data.usage,
    model: data.model,
    debugLogEntry,
  };
}

function buildLoreContext(gameState: GameStateData): string {
  // Build comprehensive context for the lore agent to prevent contradictions
  const sections: string[] = [];
  
  // Add existing world backstory if present
  if (gameState.worldBackstory) {
    sections.push('# Existing World Lore');
    sections.push(gameState.worldBackstory);
    sections.push('');
  }
  
  // Add player character info
  sections.push('# Player Character');
  sections.push(`Name: ${gameState.character.name}`);
  sections.push(`Race: ${gameState.character.race}, Class: ${gameState.character.class}, Level: ${gameState.character.level}`);
  sections.push('');
  
  // Add current location with backstory
  sections.push('# Current Location');
  sections.push(`Name: ${gameState.location.name}`);
  sections.push(`Type: ${gameState.location.type || 'Unknown'}`);
  sections.push(`Description: ${gameState.location.description}`);
  if (gameState.location.backstory) {
    sections.push(`Backstory: ${gameState.location.backstory}`);
  }
  sections.push('');
  
  // Add companions with appearance, personality, and backstories
  if (gameState.companions.length > 0) {
    sections.push('# Party Members (Companions)');
    gameState.companions.forEach(comp => {
      sections.push(`- ${comp.name} (${comp.race} ${comp.class}, Level ${comp.level})`);
      if (comp.appearance) {
        sections.push(`  Appearance: ${comp.appearance}`);
      }
      if (comp.personality) {
        sections.push(`  Personality: ${comp.personality}`);
      }
      if (comp.backstory) {
        sections.push(`  Backstory: ${comp.backstory.substring(0, 200)}...`);
      }
    });
    sections.push('');
  }
  
  // Add encountered NPCs with descriptions and backstories
  if (gameState.encounteredCharacters.length > 0) {
    sections.push('# Encountered NPCs');
    gameState.encounteredCharacters.forEach(npc => {
      sections.push(`- ${npc.name} (${npc.role}, ${npc.location}, Relationship: ${npc.relationship})`);
      if (npc.description) {
        sections.push(`  Description: ${npc.description}`);
      }
      if (npc.backstory) {
        sections.push(`  Backstory: ${npc.backstory.substring(0, 200)}...`);
      }
    });
    sections.push('');
  }
  
  // Add businesses
  if (gameState.businesses && gameState.businesses.length > 0) {
    sections.push('# Businesses');
    gameState.businesses.forEach(business => {
      sections.push(`- ${business.name}`);
      sections.push(`  Manager: ${business.manager}`);
      sections.push(`  Description: ${business.description}`);
      sections.push(`  Purchase Cost: ${business.purchaseCost}g, Weekly Income: ${business.weeklyIncome}g, Running Cost: ${business.runningCost}g`);
    });
    sections.push('');
  }
  
  // Add previous locations with backstories
  if (gameState.previousLocations && gameState.previousLocations.length > 0) {
    sections.push('# Previously Visited Locations');
    gameState.previousLocations.forEach(loc => {
      sections.push(`- ${loc.name} (${loc.type || 'Unknown type'})`);
      sections.push(`  Description: ${loc.description}`);
      if (loc.backstory) {
        sections.push(`  Backstory: ${loc.backstory.substring(0, 200)}...`);
      }
    });
    sections.push('');
  }
  
  // Add quests with backstories
  if (gameState.quests.length > 0) {
    sections.push('# Active Quests');
    gameState.quests.forEach(quest => {
      sections.push(`- ${quest.title} (${quest.type}): ${quest.description.substring(0, 100)}...`);
      if (quest.backstory) {
        sections.push(`  Backstory: ${quest.backstory.substring(0, 200)}...`);
      }
    });
    sections.push('');
  }
  
  // Add narrative context for recent events
  if (gameState.parsedRecaps.length > 0) {
    sections.push('# Recent Events (Parsed History)');
    const recentRecaps = gameState.parsedRecaps.slice(-5);
    sections.push(recentRecaps.join(' '));
    sections.push('');
  }
  
  return sections.join('\n');
}

export function needsWorldLoreGeneration(gameState: GameStateData): boolean {
  // Only generate world lore if:
  // 1. It doesn't already exist
  // 2. We have a location set (adventure has started)
  // 3. We have at least one turn (player has taken an action)
  return !gameState.worldBackstory && 
         !!gameState.location && 
         gameState.turnCount >= 1;
}
