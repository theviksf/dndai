import { apiRequest } from '@/lib/queryClient';
import type { GameConfig, DebugLogEntry, GameStateData, Revelation } from '@shared/schema';
import { nanoid } from 'nanoid';
import { runWithRetry } from './agent-retry';
import { reportAgentError } from './agent-error-context';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export interface RevelationsTrackingOptions {
  narrative: string;
  gameState: GameStateData;
  config: GameConfig;
}

export interface RevelationResult {
  entityType: 'character' | 'companion' | 'npc' | 'location' | 'quest';
  entityId: string;
  entityName: string;
  text: string;
  revealedAtTurn?: number;
}

export interface RevelationsTrackingResult {
  revelations: RevelationResult[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
  debugLogEntry?: DebugLogEntry;
}

export async function trackRevelations({ 
  narrative, 
  gameState,
  config 
}: RevelationsTrackingOptions): Promise<RevelationsTrackingResult> {
  const timestamp = Date.now();
  const id = `revelations-${timestamp}-${nanoid(6)}`;
  const systemPrompt = config.revelationsSystemPrompt;
  const model = config.revelationsLLM;
  
  // Sanitize gameState to remove large unnecessary fields before sending
  const { debugLog, turnSnapshots, ...sanitizedGameState } = gameState;
  
  const result = await runWithRetry(
    () => apiRequest('POST', '/api/chat/revelations', {
      systemPrompt,
      narrative,
      gameState: sanitizedGameState,
      model,
      apiKey: config.openRouterApiKey,
    }),
    async (response) => response.json(),
    {
      agentName: 'Revelations Agent',
      maxRetries: MAX_RETRIES,
      baseDelayMs: BASE_DELAY_MS,
    }
  );

  if (!result.success) {
    reportAgentError('Revelations Agent', result.error || 'Unknown error');
    
    const debugLogEntry: DebugLogEntry = {
      id,
      timestamp,
      type: 'revelations',
      prompt: systemPrompt,
      response: JSON.stringify({ error: result.error }),
      model,
      error: result.error,
    };
    
    return { 
      revelations: [],
      debugLogEntry,
    };
  }

  const data = result.data;
  
  const debugLogEntry: DebugLogEntry = {
    id,
    timestamp,
    type: 'revelations',
    prompt: data.fullPrompt || systemPrompt,
    response: data.rawResponse || JSON.stringify({ revelations: data.revelations, model: data.model }, null, 2),
    model: data.model || model,
    tokens: data.usage,
  };
  
  return {
    revelations: data.revelations || [],
    usage: data.usage,
    model: data.model,
    debugLogEntry,
  };
}
