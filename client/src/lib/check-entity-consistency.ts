import { apiRequest } from '@/lib/queryClient';
import type { GameCharacter, Companion, EncounteredCharacter, Location, Quest, GameConfig, DebugLogEntry } from '@shared/schema';
import { nanoid } from 'nanoid';
import { runWithRetry } from './agent-retry';
import { reportAgentError } from './agent-error-context';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export interface EntityConsistencyCheckOptions {
  entityType: 'character' | 'companion' | 'npc' | 'location' | 'quest';
  entity: GameCharacter | Companion | EncounteredCharacter | Location | Quest;
  backstory: string;
  config: GameConfig;
}

export interface EntityConsistencyCheckResult {
  entityUpdates: Record<string, any> | null;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
  debugLogEntry?: DebugLogEntry;
}

export async function checkEntityConsistency({ 
  entityType, 
  entity, 
  backstory,
  config 
}: EntityConsistencyCheckOptions): Promise<EntityConsistencyCheckResult> {
  const timestamp = Date.now();
  const id = `checker-${timestamp}-${nanoid(6)}`;
  const systemPrompt = config.checkerSystemPrompt;
  const model = config.checkerLLM;
  
  const entityName = 'name' in entity ? entity.name : ('title' in entity ? (entity as any).title : 'Unknown');
  
  const result = await runWithRetry(
    () => apiRequest('POST', '/api/check-entity-consistency', {
      systemPrompt,
      entity,
      entityType,
      backstory,
      model,
      apiKey: config.openRouterApiKey,
    }),
    async (response) => response.json(),
    {
      agentName: 'Checker Agent',
      maxRetries: MAX_RETRIES,
      baseDelayMs: BASE_DELAY_MS,
    }
  );

  if (!result.success) {
    reportAgentError('Checker Agent', result.error || 'Unknown error', entityName);
    
    const debugLogEntry: DebugLogEntry = {
      id,
      timestamp,
      type: 'checker',
      prompt: systemPrompt,
      response: JSON.stringify({ error: result.error }),
      model,
      entityType,
      error: result.error,
    };
    
    return { 
      entityUpdates: null,
      debugLogEntry,
    };
  }

  const data = result.data;
  
  const debugLogEntry: DebugLogEntry = {
    id,
    timestamp,
    type: 'checker',
    prompt: data.fullPrompt || systemPrompt,
    response: data.rawResponse || JSON.stringify({ entityUpdates: data.entityUpdates, model: data.model }, null, 2),
    model: data.model || model,
    tokens: data.usage,
    entityType,
  };
  
  return {
    entityUpdates: data.entityUpdates || null,
    usage: data.usage,
    model: data.model,
    debugLogEntry,
  };
}
