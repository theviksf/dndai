import { apiRequest } from '@/lib/queryClient';
import type { GameCharacter, Companion, EncounteredCharacter, Location, GameConfig, DebugLogEntry } from '@shared/schema';

export interface ImageGenerationOptions {
  entityType: 'character' | 'companion' | 'npc' | 'location';
  entity: GameCharacter | Companion | EncounteredCharacter | Location;
  config: GameConfig;
}

export interface ImageGenerationResult {
  imageUrl: string | null;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
  debugLogEntry?: DebugLogEntry;
}

export async function generateEntityImage({ 
  entityType, 
  entity, 
  config 
}: ImageGenerationOptions): Promise<ImageGenerationResult> {
  const timestamp = Date.now();
  const id = `image-${timestamp}`;
  const isLocationEntity = entityType === 'location';
  const promptTemplate = isLocationEntity 
    ? config.locationImagePrompt 
    : config.characterImagePrompt;
  
  try {
    const response = await apiRequest('POST', '/api/generate-image', {
      promptTemplate,
      entity,
      entityType,
      apiKey: config.openRouterApiKey,
    });

    if (!response.ok) {
      // Handle HTTP errors
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
        type: 'image',
        prompt: errorData.filledPrompt || promptTemplate,
        response: errorData.rawResponse || JSON.stringify({ 
          status: response.status,
          statusText: response.statusText,
          error: errorData 
        }, null, 2),
        model: 'google/gemini-2.5-flash-image-preview',
        entityType,
        imageUrl: null,
        error: `HTTP ${response.status}: ${errorData.error || response.statusText}`,
      };
      
      return { 
        imageUrl: null,
        debugLogEntry,
      };
    }

    const data = await response.json();
    
    // Create debug log entry
    const debugLogEntry: DebugLogEntry = {
      id,
      timestamp,
      type: 'image',
      prompt: data.filledPrompt || promptTemplate,
      response: data.rawResponse || JSON.stringify({ imageUrl: data.imageUrl, model: data.model }, null, 2),
      model: data.model || 'google/gemini-2.5-flash-image-preview',
      tokens: data.usage,
      entityType,
      imageUrl: data.imageUrl || null,
      error: data.imageUrl ? undefined : 'No image URL returned',
    };
    
    return {
      imageUrl: data.imageUrl || null,
      usage: data.usage,
      model: data.model,
      debugLogEntry,
    };
  } catch (error: any) {
    console.error(`Failed to generate image for ${entityType}:`, error);
    
    // Create debug log entry for error
    const debugLogEntry: DebugLogEntry = {
      id,
      timestamp,
      type: 'image',
      prompt: promptTemplate,
      response: JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        name: error.name 
      }, null, 2),
      model: 'google/gemini-2.5-flash-image-preview',
      entityType,
      imageUrl: null,
      error: error.message || 'Unknown error',
    };
    
    return { 
      imageUrl: null,
      debugLogEntry,
    };
  }
}

export function needsImageGeneration(
  entity: GameCharacter | Companion | EncounteredCharacter | Location
): boolean {
  return !entity.imageUrl;
}

export function hasCharacterAppearanceChanged(
  oldChar: GameCharacter,
  newChar: GameCharacter
): boolean {
  return (
    oldChar.race !== newChar.race ||
    oldChar.sex !== newChar.sex ||
    oldChar.age !== newChar.age
  );
}
