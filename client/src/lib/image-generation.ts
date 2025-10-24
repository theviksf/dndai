import { apiRequest } from '@/lib/queryClient';
import type { GameCharacter, Companion, EncounteredCharacter, Location, GameConfig, DebugLogEntry } from '@shared/schema';
import { nanoid } from 'nanoid';

export interface ImageGenerationOptions {
  entityType: 'character' | 'companion' | 'npc' | 'location' | 'business';
  entity: GameCharacter | Companion | EncounteredCharacter | Location;
  config: GameConfig;
  sessionId: string;
  existingJobId?: string;
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
  config,
  sessionId,
  existingJobId
}: ImageGenerationOptions): Promise<ImageGenerationResult> {
  const timestamp = Date.now();
  const id = `image-${timestamp}-${nanoid(6)}`;
  const isLocationEntity = entityType === 'location' || entityType === 'business';
  let promptTemplate = isLocationEntity 
    ? config.locationImagePrompt 
    : config.characterImagePrompt;
  
  // Fallback to loading defaults from API if prompts are empty
  if (!promptTemplate || promptTemplate.trim() === '') {
    try {
      const response = await fetch('/api/prompts/defaults');
      if (response.ok) {
        const defaults = await response.json();
        promptTemplate = isLocationEntity ? defaults.imageLocation : defaults.imageCharacter;
      }
    } catch (error) {
      console.error('Failed to load default image prompts:', error);
    }
    
    // If still empty after fallback, throw error
    if (!promptTemplate || promptTemplate.trim() === '') {
      throw new Error(`Image prompt not loaded for ${isLocationEntity ? 'location' : 'character'}`);
    }
  }
  
  try {
    let currentJobId = existingJobId;
    let maxRetries = 5;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      const response = await apiRequest('POST', '/api/generate-image', {
        promptTemplate,
        entity,
        entityType,
        apiKey: config.openRouterApiKey,
        sessionId,
        provider: config.imageProvider || 'flux',
        existingJobId: currentJobId,
      });

      // Handle 202 Accepted - job is still queued
      if (response.status === 202) {
        const data = await response.json();
        console.log(`[IMAGE GEN] Job still queued (attempt ${retryCount + 1}/${maxRetries}), job ID:`, data.jobId);
        
        // Store the job ID and wait before retrying
        currentJobId = data.jobId;
        retryCount++;
        
        if (retryCount < maxRetries) {
          // Wait 5 seconds before retrying
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue; // Retry with the existing job ID
        } else {
          // Max retries reached, return an error
          const debugLogEntry: DebugLogEntry = {
            id,
            timestamp,
            type: 'image',
            prompt: data.filledPrompt || promptTemplate,
            response: JSON.stringify({
              status: 'IN_QUEUE',
              jobId: currentJobId,
              message: data.message,
              attempts: retryCount
            }, null, 2),
            model: 'flux-1.1-schnell',
            entityType,
            imageUrl: null,
            error: `Image generation still in queue after ${retryCount} attempts. Please try again later.`,
          };
          
          return {
            imageUrl: null,
            debugLogEntry,
          };
        }
      }
      
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
          model: config.imageProvider === 'flux' ? 'flux-1.1-schnell' : 'google/gemini-2.5-flash-image-preview',
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
      
      // Success! Create debug log entry with R2 URL (small string, safe to store)
      const debugLogEntry: DebugLogEntry = {
        id,
        timestamp,
        type: 'image',
        prompt: data.filledPrompt || promptTemplate,
        response: data.rawResponse || JSON.stringify({ 
          imageUrl: data.imageUrl || null, 
          model: data.model 
        }, null, 2),
        model: data.model || (config.imageProvider === 'flux' ? 'flux-1.1-schnell' : 'google/gemini-2.5-flash-image-preview'),
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
    }
    
    // Fallback if loop exits without returning (should never happen)
    throw new Error('Image generation failed: max retries exceeded');
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
      model: config.imageProvider === 'flux' ? 'flux-1.1-schnell' : 'google/gemini-2.5-flash-image-preview',
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
