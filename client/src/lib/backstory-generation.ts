import { apiRequest } from '@/lib/queryClient';
import type { GameCharacter, Companion, EncounteredCharacter, Location, Quest, GameConfig, DebugLogEntry, GameStateData } from '@shared/schema';
import { nanoid } from 'nanoid';
import { checkEntityConsistency } from './check-entity-consistency';

export interface BackstoryGenerationOptions {
  entityType: 'character' | 'companion' | 'npc' | 'location' | 'quest';
  entity: GameCharacter | Companion | EncounteredCharacter | Location | Quest;
  gameState: GameStateData;
  config: GameConfig;
}

export interface BackstoryGenerationResult {
  backstory: string | null;
  entityUpdates?: Record<string, any> | null;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
  debugLogEntry?: DebugLogEntry;
  checkerDebugLogEntry?: DebugLogEntry;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateEntityBackstory({ 
  entityType, 
  entity, 
  gameState,
  config 
}: BackstoryGenerationOptions): Promise<BackstoryGenerationResult> {
  const timestamp = Date.now();
  const id = `backstory-${timestamp}-${nanoid(6)}`;
  const systemPrompt = config.backstorySystemPrompt;
  const model = config.backstoryLLM;
  const context = buildBackstoryContext(entityType, entity, gameState);
  
  let lastError: string | null = null;
  let lastDebugLogEntry: DebugLogEntry | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const entityName = 'name' in entity ? entity.name : ('title' in entity ? entity.title : 'Unknown');
      console.log(`[BACKSTORY GEN] Attempt ${attempt}/${MAX_RETRIES} for ${entityType}: ${entityName}`);
      
      const response = await apiRequest('POST', '/api/generate-backstory', {
        systemPrompt,
        context,
        entity,
        entityType,
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
        
        lastError = `HTTP ${response.status}: ${errorData.error || response.statusText}`;
        lastDebugLogEntry = {
          id: `${id}-attempt${attempt}`,
          timestamp: Date.now(),
          type: 'backstory',
          prompt: errorData.fullPrompt || systemPrompt,
          response: errorData.rawResponse || JSON.stringify({ 
            status: response.status,
            statusText: response.statusText,
            error: errorData 
          }, null, 2),
          model,
          entityType,
          error: lastError,
        };
        
        // Check if it's a JSON parsing error (500) - worth retrying
        const isRetryable = response.status === 500 && 
          (errorData.error?.includes('parse') || errorData.error?.includes('JSON'));
        
        if (isRetryable && attempt < MAX_RETRIES) {
          console.log(`[BACKSTORY GEN] Retryable error, waiting ${RETRY_DELAY_MS}ms before retry...`);
          await sleep(RETRY_DELAY_MS * attempt); // Exponential backoff
          continue;
        }
        
        // Non-retryable error or max retries reached
        console.error(`[BACKSTORY GEN] Failed after ${attempt} attempts:`, lastError);
        return { 
          backstory: null,
          debugLogEntry: lastDebugLogEntry,
        };
      }

      const data = await response.json();
      
      // Success!
      if (attempt > 1) {
        console.log(`[BACKSTORY GEN] Succeeded on attempt ${attempt}`);
      }
    
    const debugLogEntry: DebugLogEntry = {
      id,
      timestamp,
      type: 'backstory',
      prompt: data.fullPrompt || systemPrompt,
      response: data.rawResponse || JSON.stringify({ backstory: data.backstory, model: data.model }, null, 2),
      model: data.model || model,
      tokens: data.usage,
      entityType,
    };
    
    const backstory = data.backstory || null;
    
    // If backstory was successfully generated, run checker to update entity fields
    let entityUpdates: Record<string, any> | null = null;
    let checkerDebugLogEntry: DebugLogEntry | undefined;
    
    if (backstory) {
      try {
        console.log(`[BACKSTORY GEN] Running checker for ${entityType} to align entity with backstory`);
        const checkerResult = await checkEntityConsistency({
          entityType,
          entity,
          backstory,
          config,
        });
        
        entityUpdates = checkerResult.entityUpdates;
        checkerDebugLogEntry = checkerResult.debugLogEntry;
        
        if (entityUpdates && Object.keys(entityUpdates).length > 0) {
          console.log(`[BACKSTORY GEN] Checker found ${Object.keys(entityUpdates).length} updates:`, Object.keys(entityUpdates));
        } else {
          console.log(`[BACKSTORY GEN] Checker found no updates needed`);
        }
      } catch (error) {
        console.error(`[BACKSTORY GEN] Checker failed for ${entityType}:`, error);
        // Don't fail backstory generation if checker fails - continue without updates
      }
    }
    
      return {
        backstory,
        entityUpdates,
        usage: data.usage,
        model: data.model,
        debugLogEntry,
        checkerDebugLogEntry,
      };
    } catch (error: any) {
      console.error(`[BACKSTORY GEN] Attempt ${attempt} caught error:`, error.message);
      lastError = error.message || 'Unknown error';
      lastDebugLogEntry = {
        id: `${id}-attempt${attempt}`,
        timestamp: Date.now(),
        type: 'backstory',
        prompt: systemPrompt,
        response: JSON.stringify({ 
          error: error.message,
          stack: error.stack,
          name: error.name 
        }, null, 2),
        model,
        entityType,
        error: lastError || undefined,
      };
      
      if (attempt < MAX_RETRIES) {
        console.log(`[BACKSTORY GEN] Retrying after error, waiting ${RETRY_DELAY_MS * attempt}ms...`);
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
    }
  }
  
  // All retries exhausted
  console.error(`[BACKSTORY GEN] All ${MAX_RETRIES} attempts failed for ${entityType}`);
  return { 
    backstory: null,
    debugLogEntry: lastDebugLogEntry || {
      id,
      timestamp,
      type: 'backstory',
      prompt: systemPrompt,
      response: JSON.stringify({ error: lastError }),
      model,
      entityType,
      error: lastError || 'Unknown error after retries',
    },
  };
}

function buildBackstoryContext(
  entityType: string,
  entity: any,
  gameState: GameStateData
): string {
  // Build rich context for the backstory agent
  const sections: string[] = [];
  
  // Add entity type and basic info
  sections.push(`# Entity Type: ${entityType.toUpperCase()}`);
  sections.push(`# Entity Name: ${entity.name || 'Unknown'}`);
  sections.push('');
  
  // Add world context
  if (gameState.worldBackstory) {
    sections.push('# World Context');
    sections.push(gameState.worldBackstory);
    sections.push('');
  }
  
  // Add current location
  sections.push('# Current Location');
  sections.push(`Name: ${gameState.location.name}`);
  sections.push(`Type: ${gameState.location.type || 'Unknown'}`);
  sections.push(`Description: ${gameState.location.description}`);
  if (gameState.location.backstory) {
    sections.push(`Backstory: ${gameState.location.backstory}`);
  }
  if (gameState.location.revelations && gameState.location.revelations.length > 0) {
    sections.push('Revealed Secrets:');
    gameState.location.revelations.forEach(rev => {
      sections.push(`- ${rev.text}`);
    });
  }
  sections.push('');
  
  // Add player character info
  sections.push('# Player Character');
  sections.push(`Name: ${gameState.character.name}`);
  sections.push(`Race: ${gameState.character.race}, Class: ${gameState.character.class}, Level: ${gameState.character.level}`);
  if (gameState.character.description) {
    sections.push(`Description: ${gameState.character.description}`);
  }
  if ((gameState.character as any).backstory) {
    sections.push(`Backstory: ${(gameState.character as any).backstory.substring(0, 300)}...`);
  }
  if (gameState.character.revelations && gameState.character.revelations.length > 0) {
    sections.push('Revealed Secrets:');
    gameState.character.revelations.forEach(rev => {
      sections.push(`- ${rev.text}`);
    });
  }
  sections.push('');
  
  // Add companions
  if (gameState.companions.length > 0) {
    sections.push('# Party Members (Companions)');
    gameState.companions.forEach(comp => {
      sections.push(`- ${comp.name} (${comp.race} ${comp.class}, Level ${comp.level})`);
      if (comp.appearance) {
        sections.push(`  Appearance: ${comp.appearance}`);
      }
      if (comp.personality) {
        sections.push(`  Personality: ${comp.personality}`);
      }
      if (comp.backstory) {
        sections.push(`  Backstory: ${comp.backstory.substring(0, 200)}...`);
      }
      if (comp.revelations && comp.revelations.length > 0) {
        sections.push(`  Revealed Secrets: ${comp.revelations.map(r => r.text).join('; ')}`);
      }
    });
    sections.push('');
  }
  
  // Add encountered NPCs
  if (gameState.encounteredCharacters.length > 0) {
    sections.push('# Encountered NPCs');
    gameState.encounteredCharacters.forEach(npc => {
      sections.push(`- ${npc.name} (${npc.role}, ${npc.location}, Relationship: ${npc.relationship})`);
      if (npc.description) {
        sections.push(`  Description: ${npc.description}`);
      }
      if (npc.backstory) {
        sections.push(`  Backstory: ${npc.backstory.substring(0, 200)}...`);
      }
      if (npc.revelations && npc.revelations.length > 0) {
        sections.push(`  Revealed Secrets: ${npc.revelations.map(r => r.text).join('; ')}`);
      }
    });
    sections.push('');
  }
  
  // Add businesses
  if (gameState.businesses && gameState.businesses.length > 0) {
    sections.push('# Businesses');
    gameState.businesses.forEach(business => {
      sections.push(`- ${business.name}`);
      sections.push(`  Manager: ${business.manager}`);
      sections.push(`  Description: ${business.description}`);
      sections.push(`  Financials: Purchase ${business.purchaseCost}g, Weekly Income ${business.weeklyIncome}g, Running Cost ${business.runningCost}g`);
      if ((business as any).backstory) {
        sections.push(`  Backstory: ${(business as any).backstory.substring(0, 200)}...`);
      }
    });
    sections.push('');
  }
  
  // Add previous locations
  if (gameState.previousLocations && gameState.previousLocations.length > 0) {
    sections.push('# Previously Visited Locations');
    gameState.previousLocations.forEach(loc => {
      sections.push(`- ${loc.name} (${loc.type || 'Unknown type'})`);
      sections.push(`  Description: ${loc.description}`);
      if (loc.backstory) {
        sections.push(`  Backstory: ${loc.backstory.substring(0, 200)}...`);
      }
      if (loc.revelations && loc.revelations.length > 0) {
        sections.push(`  Revealed Secrets: ${loc.revelations.map(r => r.text).join('; ')}`);
      }
    });
    sections.push('');
  }
  
  // Add quests
  if (gameState.quests.length > 0) {
    sections.push('# Active Quests');
    gameState.quests.forEach(quest => {
      sections.push(`- ${quest.title} (${quest.type}): ${quest.description.substring(0, 100)}...`);
      if (quest.backstory) {
        sections.push(`  Backstory: ${quest.backstory.substring(0, 200)}...`);
      }
      if (quest.revelations && quest.revelations.length > 0) {
        sections.push(`  Revealed Secrets: ${quest.revelations.map(r => r.text).join('; ')}`);
      }
    });
    sections.push('');
  }
  
  // Add narrative history summary
  if (gameState.parsedRecaps.length > 0) {
    sections.push('# Recent Events (Parsed History)');
    const recentRecaps = gameState.parsedRecaps.slice(-5);
    sections.push(recentRecaps.join(' '));
    sections.push('');
  }
  
  return sections.join('\n');
}

export function needsBackstoryGeneration(
  entity: GameCharacter | Companion | EncounteredCharacter | Location | Quest
): boolean {
  // GameCharacter doesn't have backstory field, only other entity types do
  // Check for entity-specific required properties to determine type
  
  // Check for Companion (has required 'personality' field, unique to companions)
  if ('personality' in entity) {
    const companion = entity as Companion;
    return !companion.backstory;
  }
  
  // Check for EncounteredCharacter/NPC (has 'role' field, unique to NPCs)
  if ('role' in entity) {
    const npc = entity as EncounteredCharacter;
    return !npc.backstory;
  }
  
  // Check for Quest (has 'objectives' array, unique to quests)
  if ('objectives' in entity) {
    const quest = entity as Quest;
    return !quest.backstory;
  }
  
  // Check for Location (has name & description, but NOT personality/role/objectives/attributes)
  // Use process of elimination, but explicitly exclude GameCharacter (which has 'attributes')
  if ('name' in entity && 'description' in entity && 
      !('personality' in entity) && !('role' in entity) && !('objectives' in entity) && !('attributes' in entity)) {
    const location = entity as Location;
    return !location.backstory;
  }
  
  return false;
}
