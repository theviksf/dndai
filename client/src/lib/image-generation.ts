import { apiRequest } from '@/lib/queryClient';
import type { GameCharacter, Companion, EncounteredCharacter, Location, GameConfig } from '@shared/schema';

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
}

export async function generateEntityImage({ 
  entityType, 
  entity, 
  config 
}: ImageGenerationOptions): Promise<ImageGenerationResult> {
  try {
    const isLocationEntity = entityType === 'location';
    const promptTemplate = isLocationEntity 
      ? config.locationImagePrompt 
      : config.characterImagePrompt;

    const response = await apiRequest('POST', '/api/generate-image', {
      promptTemplate,
      entity,
      entityType,
      apiKey: config.openRouterApiKey,
    });

    const data = await response.json();
    return {
      imageUrl: data.imageUrl || null,
      usage: data.usage,
      model: data.model,
    };
  } catch (error) {
    console.error(`Failed to generate image for ${entityType}:`, error);
    return { imageUrl: null };
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
