import { apiRequest } from '@/lib/queryClient';
import type { GameCharacter, Companion, EncounteredCharacter, Location, Quest, GameConfig, DebugLogEntry, GameStateData } from '@shared/schema';
import { nanoid } from 'nanoid';

export interface BackstoryGenerationOptions {
  entityType: 'character' | 'companion' | 'npc' | 'location' | 'quest';
  entity: GameCharacter | Companion | EncounteredCharacter | Location | Quest;
  gameState: GameStateData;
  config: GameConfig;
}

export interface BackstoryGenerationResult {
  backstory: string | null;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
  debugLogEntry?: DebugLogEntry;
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
  
  try {
    // Build context for backstory generation
    const context = buildBackstoryContext(entityType, entity, gameState);
    
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
      
      const debugLogEntry: DebugLogEntry = {
        id,
        timestamp,
        type: 'backstory',
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
        backstory: null,
        debugLogEntry,
      };
    }

    const data = await response.json();
    
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
    
    return {
      backstory: data.backstory || null,
      usage: data.usage,
      model: data.model,
      debugLogEntry,
    };
  } catch (error: any) {
    console.error(`Failed to generate backstory for ${entityType}:`, error);
    
    const debugLogEntry: DebugLogEntry = {
      id,
      timestamp,
      type: 'backstory',
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
      backstory: null,
      debugLogEntry,
    };
  }
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

export interface BackstoryParserResult {
  entityUpdates: {
    npcs: Array<{
      id: string;
      updates: Partial<EncounteredCharacter>;
    }>;
    companions: Array<{
      id: string;
      updates: Partial<Companion>;
    }>;
    locations: Array<{
      id: string;
      updates: Partial<Location>;
    }>;
    quests: Array<{
      id: string;
      updates: Partial<Quest>;
    }>;
  };
  summary: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
  debugLogEntry?: DebugLogEntry;
}

export async function parseBackstoriesForEntityUpdates(
  gameState: GameStateData,
  config: GameConfig
): Promise<BackstoryParserResult> {
  const timestamp = Date.now();
  const id = `backstoryparser-${timestamp}-${nanoid(6)}`;
  const systemPrompt = config.backstoryParserPrompt;
  const model = config.backstoryParserLLM;
  
  try {
    // Build context with all backstories
    const context = buildBackstoryParserContext(gameState);
    
    const response = await apiRequest('POST', '/api/parse-backstories', {
      systemPrompt,
      context,
      gameState,
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
        type: 'backstoryparser',
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
        entityUpdates: { npcs: [], companions: [], locations: [], quests: [] },
        summary: 'Error parsing backstories',
        debugLogEntry,
      };
    }

    const data = await response.json();
    
    const debugLogEntry: DebugLogEntry = {
      id,
      timestamp,
      type: 'backstoryparser',
      prompt: data.fullPrompt || systemPrompt,
      response: data.rawResponse || JSON.stringify(data.entityUpdates, null, 2),
      model: data.model || model,
      tokens: data.usage,
    };
    
    return {
      entityUpdates: data.entityUpdates || { npcs: [], companions: [], locations: [], quests: [] },
      summary: data.summary || 'No updates extracted',
      usage: data.usage,
      model: data.model,
      debugLogEntry,
    };
  } catch (error: any) {
    console.error('Failed to parse backstories for entity updates:', error);
    
    const debugLogEntry: DebugLogEntry = {
      id,
      timestamp,
      type: 'backstoryparser',
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
      entityUpdates: { npcs: [], companions: [], locations: [], quests: [] },
      summary: 'Error parsing backstories',
      debugLogEntry,
    };
  }
}

function buildBackstoryParserContext(gameState: GameStateData): string {
  const sections: string[] = [];
  
  sections.push('# CURRENT GAME STATE');
  sections.push('');
  
  // Current location
  sections.push('## Current Location');
  sections.push(`Name: ${gameState.location.name}`);
  sections.push(`Type: ${gameState.location.type || 'Unknown'}`);
  sections.push(`Description: ${gameState.location.description}`);
  if (gameState.location.backstory) {
    sections.push('');
    sections.push('**Backstory:**');
    sections.push(gameState.location.backstory);
  }
  sections.push('');
  
  // NPCs
  if (gameState.encounteredCharacters.length > 0) {
    sections.push('## NPCs (Encountered Characters)');
    gameState.encounteredCharacters.forEach(npc => {
      sections.push('');
      sections.push(`### ${npc.name} (ID: ${npc.id})`);
      sections.push(`Age: ${npc.age}, Sex: ${npc.sex}`);
      if (npc.hairColor) sections.push(`Hair: ${npc.hairColor}`);
      if (npc.outfit) sections.push(`Outfit: ${npc.outfit}`);
      sections.push(`Role: ${npc.role}`);
      sections.push(`Location: ${npc.location}`);
      sections.push(`Appearance: ${npc.appearance}`);
      sections.push(`Status: ${npc.status}`);
      sections.push(`Relationship: ${npc.relationship}`);
      if (npc.backstory) {
        sections.push('');
        sections.push('**Backstory:**');
        sections.push(npc.backstory);
      }
    });
    sections.push('');
  }
  
  // Companions
  if (gameState.companions.length > 0) {
    sections.push('## Party Members (Companions)');
    gameState.companions.forEach(comp => {
      sections.push('');
      sections.push(`### ${comp.name} (ID: ${comp.id})`);
      sections.push(`${comp.race} ${comp.class}, Level ${comp.level}`);
      sections.push(`Age: ${comp.age}, Sex: ${comp.sex}`);
      if (comp.hairColor) sections.push(`Hair: ${comp.hairColor}`);
      if (comp.outfit) sections.push(`Outfit: ${comp.outfit}`);
      sections.push(`Appearance: ${comp.appearance}`);
      sections.push(`Personality: ${comp.personality}`);
      sections.push(`Feelings: ${comp.feelingsTowardsPlayer}`);
      sections.push(`Relationship: ${comp.relationship}`);
      if (comp.criticalMemories) sections.push(`Critical Memories: ${comp.criticalMemories}`);
      if (comp.backstory) {
        sections.push('');
        sections.push('**Backstory:**');
        sections.push(comp.backstory);
      }
    });
    sections.push('');
  }
  
  // Quests
  if (gameState.quests && gameState.quests.length > 0) {
    sections.push('## Quests');
    gameState.quests.forEach(quest => {
      sections.push('');
      sections.push(`### ${quest.title} (ID: ${quest.id})`);
      sections.push(`Type: ${quest.type}`);
      sections.push(`Status: ${quest.completed ? 'Completed' : 'Active'}`);
      if (quest.description) sections.push(`Description: ${quest.description}`);
      if (quest.objectives && quest.objectives.length > 0) {
        sections.push(`Objectives:`);
        quest.objectives.forEach((obj, idx) => {
          sections.push(`  ${idx + 1}. ${obj.text} ${obj.completed ? '✓' : '○'}`);
        });
      }
      if (quest.backstory) {
        sections.push('');
        sections.push('**Backstory:**');
        sections.push(quest.backstory);
      }
    });
    sections.push('');
  }
  
  // Previous locations
  if (gameState.previousLocations && gameState.previousLocations.length > 0) {
    sections.push('## Previous Locations');
    gameState.previousLocations.forEach(loc => {
      sections.push('');
      sections.push(`### ${loc.name} (ID: ${loc.id})`);
      sections.push(`Type: ${loc.type || 'Unknown'}`);
      sections.push(`Description: ${loc.description}`);
      if (loc.backstory) {
        sections.push('');
        sections.push('**Backstory:**');
        sections.push(loc.backstory);
      }
    });
    sections.push('');
  }
  
  // World lore
  if (gameState.worldBackstory) {
    sections.push('## World Lore');
    sections.push(gameState.worldBackstory);
    sections.push('');
  }
  
  // Recent narrative
  if (gameState.parsedRecaps.length > 0) {
    sections.push('## Recent Events');
    const recentRecaps = gameState.parsedRecaps.slice(-5);
    sections.push(recentRecaps.join(' '));
    sections.push('');
  }
  
  return sections.join('\n');
}
