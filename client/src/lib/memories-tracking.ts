import { apiRequest } from '@/lib/queryClient';
import type { GameConfig, DebugLogEntry, GameStateData, Memory } from '@shared/schema';
import { nanoid } from 'nanoid';

export interface MemoriesTrackingOptions {
  narrative: string;
  gameState: GameStateData;
  config: GameConfig;
  newCompanionIds?: string[];
  newNPCIds?: string[];
}

export interface MemoryResult {
  characterType: 'companion' | 'npc';
  characterId: string;
  characterName: string;
  text: string;
  turn: number;
}

export interface MemoriesTrackingResult {
  memories: MemoryResult[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
  debugLogEntry?: DebugLogEntry;
}

export async function trackMemories({ 
  narrative, 
  gameState,
  config,
  newCompanionIds = [],
  newNPCIds = []
}: MemoriesTrackingOptions): Promise<MemoriesTrackingResult> {
  const timestamp = Date.now();
  const id = `memories-${timestamp}-${nanoid(6)}`;
  const systemPrompt = config.memoriesSystemPrompt || '';
  const model = config.memoriesLLM || config.parserLLM || 'deepseek/deepseek-chat-v3.1';
  
  if (!systemPrompt) {
    console.warn('[MEMORIES] No memories system prompt configured, skipping');
    return { memories: [] };
  }
  
  try {
    const response = await apiRequest('POST', '/api/chat/memories', {
      systemPrompt,
      narrative,
      gameState,
      model,
      apiKey: config.openRouterApiKey,
      newCompanionIds,
      newNPCIds,
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
        memories: [],
        debugLogEntry,
      };
    }

    const data = await response.json();
    
    const debugLogEntry: DebugLogEntry = {
      id,
      timestamp,
      type: 'memories',
      prompt: data.fullPrompt || systemPrompt,
      response: data.rawResponse || JSON.stringify({ memories: data.memories, model: data.model }, null, 2),
      model: data.model || model,
      tokens: data.usage,
    };
    
    return {
      memories: data.memories || [],
      usage: data.usage,
      model: data.model,
      debugLogEntry,
    };
  } catch (error: any) {
    console.error('Failed to track memories:', error);
    
    const debugLogEntry: DebugLogEntry = {
      id,
      timestamp,
      type: 'memories',
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
      memories: [],
      debugLogEntry,
    };
  }
}

export function applyMemoriesToGameState(
  gameState: GameStateData,
  memories: MemoryResult[]
): GameStateData {
  if (!memories || memories.length === 0) {
    return gameState;
  }

  const updatedCompanions = [...gameState.companions];
  const updatedNPCs = [...gameState.encounteredCharacters];

  for (const memory of memories) {
    const memoryEntry: Memory = {
      text: memory.text,
      turn: memory.turn,
    };

    if (memory.characterType === 'companion') {
      const idx = updatedCompanions.findIndex(
        c => c.id === memory.characterId || c.name.toLowerCase() === memory.characterName.toLowerCase()
      );
      if (idx !== -1) {
        const companion = updatedCompanions[idx];
        const existingMemories = companion.memories || [];
        const isDuplicate = existingMemories.some(m => m.text === memory.text);
        if (!isDuplicate) {
          updatedCompanions[idx] = {
            ...companion,
            memories: [...existingMemories, memoryEntry],
          };
        }
      }
    } else if (memory.characterType === 'npc') {
      const idx = updatedNPCs.findIndex(
        c => c.id === memory.characterId || c.name.toLowerCase() === memory.characterName.toLowerCase()
      );
      if (idx !== -1) {
        const npc = updatedNPCs[idx];
        const existingMemories = npc.memories || [];
        const isDuplicate = existingMemories.some(m => m.text === memory.text);
        if (!isDuplicate) {
          updatedNPCs[idx] = {
            ...npc,
            memories: [...existingMemories, memoryEntry],
          };
        }
      }
    }
  }

  return {
    ...gameState,
    companions: updatedCompanions,
    encounteredCharacters: updatedNPCs,
  };
}
