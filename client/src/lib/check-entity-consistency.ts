import { apiRequest } from '@/lib/queryClient';
import type { GameCharacter, Companion, EncounteredCharacter, Location, Quest, GameConfig, DebugLogEntry } from '@shared/schema';
import { nanoid } from 'nanoid';

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
  
  try {
    const response = await apiRequest('POST', '/api/check-entity-consistency', {
      systemPrompt,
      entity,
      entityType,
      backstory,
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
        type: 'checker',
        prompt: errorData.fullPrompt || systemPrompt,
        response: errorData.rawResponse || JSON.stringify({ 
          status: response.status,
          statusText: response.statusText,
          error: errorData 
        }, null, 2),
        model,
        entityType,
        error: `HTTP ${response.status}: ${errorData.error || response.statusText}`,
      };
      
      return { 
        entityUpdates: null,
        debugLogEntry,
      };
    }

    const data = await response.json();
    
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
  } catch (error: any) {
    console.error(`Failed to check consistency for ${entityType}:`, error);
    
    const debugLogEntry: DebugLogEntry = {
      id,
      timestamp,
      type: 'checker',
      prompt: systemPrompt,
      response: JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        name: error.name 
      }, null, 2),
      model,
      entityType,
      error: error.message || 'Unknown error',
    };
    
    return { 
      entityUpdates: null,
      debugLogEntry,
    };
  }
}
