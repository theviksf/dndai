import { apiRequest } from '@/lib/queryClient';
import type { GameConfig, DebugLogEntry, GameStateData } from '@shared/schema';
import { nanoid } from 'nanoid';

export interface MemoriesGenerationOptions {
  narrative: string;
  gameState: GameStateData;
  config: GameConfig;
}

export interface MemoriesResult {
  memories: Record<string, string[]>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
  debugLogEntry?: DebugLogEntry;
}

export async function generateMemories({ 
  narrative, 
  gameState,
  config 
}: MemoriesGenerationOptions): Promise<MemoriesResult> {
  const timestamp = Date.now();
  const id = `memories-${timestamp}-${nanoid(6)}`;
  const model = config.parserLLM;
  
  const existingCompanions = gameState.companions?.map(c => c.name) || [];
  const existingNPCs = gameState.encounteredCharacters?.map(n => n.name) || [];
  
  if (existingCompanions.length === 0 && existingNPCs.length === 0) {
    console.log('[MEMORIES] No existing characters to generate memories for');
    return { memories: {} };
  }
  
  try {
    const response = await apiRequest('POST', '/api/chat/memories', {
      narrative,
      existingCompanions,
      existingNPCs,
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
        type: 'memories',
        prompt: errorData.fullPrompt || 'Memories generation prompt',
        response: errorData.rawResponse || JSON.stringify({ 
          status: response.status,
          statusText: response.statusText,
          error: errorData 
        }, null, 2),
        model,
        error: `HTTP ${response.status}: ${errorData.error || response.statusText}`,
      };
      
      return { 
        memories: {},
        debugLogEntry,
      };
    }

    const data = await response.json();
    
    const debugLogEntry: DebugLogEntry = {
      id,
      timestamp,
      type: 'memories',
      prompt: data.fullPrompt || 'Memories generation prompt',
      response: data.rawResponse || JSON.stringify({ memories: data.memories, model: data.model }, null, 2),
      model: data.model || model,
      tokens: data.usage,
    };
    
    console.log('[MEMORIES] Generated memories:', data.memories);
    
    return {
      memories: data.memories || {},
      usage: data.usage,
      model: data.model,
      debugLogEntry,
    };
  } catch (error: any) {
    console.error('[MEMORIES] Failed to generate memories:', error);
    
    const debugLogEntry: DebugLogEntry = {
      id,
      timestamp,
      type: 'memories',
      prompt: 'Memories generation prompt',
      response: JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        name: error.name 
      }, null, 2),
      model,
      error: error.message || 'Unknown error',
    };
    
    return { 
      memories: {},
      debugLogEntry,
    };
  }
}
