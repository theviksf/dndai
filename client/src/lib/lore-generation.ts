import { apiRequest } from '@/lib/queryClient';
import type { GameConfig, DebugLogEntry, GameStateData } from '@shared/schema';
import { nanoid } from 'nanoid';

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
  
  try {
    // Build context for lore generation
    const context = buildLoreContext(gameState);
    
    const response = await apiRequest('POST', '/api/generate-lore', {
      systemPrompt,
      context,
      gameState,
      model,
      apiKey: config.openRouterApiKey,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      
      const debugLogEntry: DebugLogEntry = {
        id,
        timestamp,
        type: 'lore',
        prompt: errorData.fullPrompt || systemPrompt,
        response: errorData.rawResponse || JSON.stringify({ 
          status: response.status,
          statusText: response.statusText,
          error: errorData 
        }, null, 2),
        model,
        error: `HTTP ${response.status}: ${errorData.error || response.statusText}`,
      };
      
      return { 
        worldLore: null,
        debugLogEntry,
      };
    }

    const data = await response.json();
    
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
  } catch (error: any) {
    console.error('Failed to generate world lore:', error);
    
    const debugLogEntry: DebugLogEntry = {
      id,
      timestamp,
      type: 'lore',
      prompt: systemPrompt,
      response: JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        name: error.name 
      }, null, 2),
      model,
      error: error.message || 'Unknown error',
    };
    
    return { 
      worldLore: null,
      debugLogEntry,
    };
  }
}

function buildLoreContext(gameState: GameStateData): string {
  // Build rich context for the lore agent
  const sections: string[] = [];
  
  // Add player character info
  sections.push('# Player Character');
  sections.push(`Name: ${gameState.character.name}`);
  sections.push(`Race: ${gameState.character.race}, Class: ${gameState.character.class}, Level: ${gameState.character.level}`);
  sections.push('');
  
  // Add current location
  sections.push('# Starting Location');
  sections.push(`Name: ${gameState.location.name}`);
  sections.push(`Type: ${gameState.location.type || 'Unknown'}`);
  sections.push(`Description: ${gameState.location.description}`);
  sections.push('');
  
  // Add narrative context if available
  if (gameState.parsedRecaps.length > 0) {
    sections.push('# Adventure Beginning');
    const recentRecaps = gameState.parsedRecaps.slice(0, 3);
    sections.push(recentRecaps.join(' '));
    sections.push('');
  }
  
  // Add any immediate world context from narrative history
  if (gameState.narrativeHistory.length > 0) {
    sections.push('# Initial Narrative');
    const lastMessage = gameState.narrativeHistory[gameState.narrativeHistory.length - 1];
    if (lastMessage.type === 'dm') {
      sections.push(lastMessage.content.substring(0, 500));
      sections.push('');
    }
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
