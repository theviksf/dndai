import { apiRequest } from '@/lib/queryClient';
import type { GameConfig, DebugLogEntry, GameStateData, Memory } from '@shared/schema';
import { nanoid } from 'nanoid';
import { runWithRetry } from './agent-retry';
import { reportAgentError } from './agent-error-context';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

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
  
  // Sanitize gameState to remove large unnecessary fields before sending
  const { debugLog, turnSnapshots, ...sanitizedGameState } = gameState;
  
  const result = await runWithRetry(
    () => apiRequest('POST', '/api/chat/memories', {
      systemPrompt,
      narrative,
      gameState: sanitizedGameState,
      model,
      apiKey: config.openRouterApiKey,
      newCompanionIds,
      newNPCIds,
    }),
    async (response) => response.json(),
    {
      agentName: 'Memories Agent',
      maxRetries: MAX_RETRIES,
      baseDelayMs: BASE_DELAY_MS,
    }
  );

  if (!result.success) {
    reportAgentError('Memories Agent', result.error || 'Unknown error');
    
    const debugLogEntry: DebugLogEntry = {
      id,
      timestamp,
      type: 'memories',
      prompt: systemPrompt,
      response: JSON.stringify({ error: result.error }),
      model,
      error: result.error,
    };
    
    return { 
      memories: [],
      debugLogEntry,
    };
  }

  const data = result.data;
  
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
