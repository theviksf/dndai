import { apiRequest } from '@/lib/queryClient';
import type { GameConfig, DebugLogEntry, GameStateData, Revelation } from '@shared/schema';
import { nanoid } from 'nanoid';

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
  
  try {
    const response = await apiRequest('POST', '/api/chat/revelations', {
      systemPrompt,
      narrative,
      gameState: sanitizedGameState,
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
        type: 'revelations',
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
        revelations: [],
        debugLogEntry,
      };
    }

    const data = await response.json();
    
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
  } catch (error: any) {
    console.error('Failed to track revelations:', error);
    
    const debugLogEntry: DebugLogEntry = {
      id,
      timestamp,
      type: 'revelations',
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
      revelations: [],
      debugLogEntry,
    };
  }
}
