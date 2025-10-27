import { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import type { GameStateData, GameConfig, CostTracker, OpenRouterModel } from '@shared/schema';
import { callLLM, callLLMStream } from '@/lib/openrouter';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { generateEntityImage, needsImageGeneration, hasCharacterAppearanceChanged } from '@/lib/image-generation';
import { generateEntityBackstory, needsBackstoryGeneration, parseBackstoriesForEntityUpdates } from '@/lib/backstory-generation';
import { trackRevelations } from '@/lib/revelations-tracking';
import { generateWorldLore, needsWorldLoreGeneration } from '@/lib/lore-generation';

interface NarrativePanelProps {
  gameState: GameStateData;
  setGameState: (state: GameStateData | ((prev: GameStateData) => GameStateData)) => void;
  saveGameState: () => void;
  config: GameConfig;
  costTracker: CostTracker;
  setCostTracker: (tracker: CostTracker | ((prev: CostTracker) => CostTracker)) => void;
  models: OpenRouterModel[];
  createSnapshot: () => void;
  sessionId: string;
}

// Robust JSON parsing helper
function sanitizeJSON(jsonString: string): string {
  // Remove BOM
  let cleaned = jsonString.replace(/^\uFEFF/, '');
  
  // Normalize curly quotes to straight quotes using unicode ranges
  cleaned = cleaned.replace(/[\u201C\u201D]/g, '"'); // " " to "
  cleaned = cleaned.replace(/[\u2018\u2019]/g, "'"); // ' ' to '
  
  // Remove trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  
  return cleaned.trim();
}

function extractAndParseJSON(content: string): any {
  const rawContent = content.trim();
  
  // Strategy 1: Try to extract from code fences
  const allFences = rawContent.matchAll(/```([a-zA-Z]*)\s*([\s\S]*?)\s*```/g);
  const fencedBlocks = Array.from(allFences);
  
  for (const match of fencedBlocks) {
    const candidate = match[2].trim();
    if (candidate.startsWith('{') || candidate.startsWith('[')) {
      try {
        const sanitized = sanitizeJSON(candidate);
        const parsed = JSON.parse(sanitized);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      } catch (e) {
        continue;
      }
    }
  }
  
  // Strategy 2: Try raw content if it looks like JSON
  if (rawContent.startsWith('{') || rawContent.startsWith('[')) {
    try {
      const sanitized = sanitizeJSON(rawContent);
      const parsed = JSON.parse(sanitized);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (e) {
      // Continue to next strategy
    }
  }
  
  // Strategy 3: Try to find the first balanced JSON object using brace counting
  let braceCount = 0;
  let startIndex = -1;
  
  for (let i = 0; i < rawContent.length; i++) {
    if (rawContent[i] === '{') {
      if (braceCount === 0) startIndex = i;
      braceCount++;
    } else if (rawContent[i] === '}') {
      braceCount--;
      if (braceCount === 0 && startIndex !== -1) {
        try {
          const candidate = rawContent.substring(startIndex, i + 1);
          const sanitized = sanitizeJSON(candidate);
          const parsed = JSON.parse(sanitized);
          if (parsed && typeof parsed === 'object') {
            return parsed;
          }
        } catch (e) {
          // Continue searching
        }
        startIndex = -1;
      }
    }
  }
  
  throw new Error('No valid JSON found in parser response');
}

function validateAndCoerceParserData(data: any, characterName: string = 'Unknown'): any {
  if (!data || typeof data !== 'object') {
    throw new Error('Parser data is not an object');
  }
  
  // Must have at least recap or stateUpdates
  if (!data.recap && !data.stateUpdates) {
    throw new Error('Parser data missing both recap and stateUpdates');
  }
  
  const result: any = {};
  
  // Copy recap as-is if present
  if (data.recap) {
    result.recap = String(data.recap);
  }
  
  // Process and coerce stateUpdates if present
  if (data.stateUpdates) {
    const updates = data.stateUpdates;
    result.stateUpdates = {};
    
    // Handle both flat and nested structures (parser sometimes returns nested character object)
    const char = updates.character || updates;
    
    // Coerce string fields from character (nested or flat)
    if (char.name !== undefined) result.stateUpdates.name = String(char.name);
    if (char.race !== undefined) result.stateUpdates.race = String(char.race);
    if (char.class !== undefined) result.stateUpdates.class = String(char.class);
    if (char.age !== undefined) result.stateUpdates.age = String(char.age);
    if (char.sex !== undefined) result.stateUpdates.sex = String(char.sex);
    if (char.hairColor !== undefined) result.stateUpdates.hairColor = String(char.hairColor);
    if (char.outfit !== undefined) result.stateUpdates.outfit = String(char.outfit);
    
    // Coerce numeric fields with finite check
    if (char.level !== undefined) {
      const level = Number(char.level);
      if (Number.isFinite(level) && level >= 1) {
        result.stateUpdates.level = Math.floor(level);
      }
    }
    if (char.hp !== undefined) {
      const hp = Number(char.hp);
      if (Number.isFinite(hp) && hp >= 0) {
        result.stateUpdates.hp = Math.floor(hp);
      }
    }
    if (char.maxHp !== undefined) {
      const maxHp = Number(char.maxHp);
      if (Number.isFinite(maxHp) && maxHp >= 1) {
        result.stateUpdates.maxHp = Math.floor(maxHp);
      }
    }
    if (char.gold !== undefined) {
      const gold = Number(char.gold);
      if (Number.isFinite(gold) && gold >= 0) {
        result.stateUpdates.gold = Math.floor(gold);
      }
    }
    if (char.xp !== undefined) {
      const xp = Number(char.xp);
      if (Number.isFinite(xp) && xp >= 0) {
        result.stateUpdates.xp = Math.floor(xp);
      }
    }
    if (char.nextLevelXp !== undefined) {
      const nextLevelXp = Number(char.nextLevelXp);
      if (Number.isFinite(nextLevelXp) && nextLevelXp >= 1) {
        result.stateUpdates.nextLevelXp = Math.floor(nextLevelXp);
      }
    }
    
    // Handle attributes from nested or flat structure
    const attrs = char.attributes || updates.attributes;
    if (attrs !== undefined) result.stateUpdates.attributes = attrs;
    
    // Copy complex fields as-is (always at top level of stateUpdates)
    if (updates.location !== undefined) result.stateUpdates.location = updates.location;
    if (updates.statusEffects !== undefined) {
      result.stateUpdates.statusEffects = Array.isArray(updates.statusEffects) 
        ? updates.statusEffects 
        : [updates.statusEffects];
    }
    if (updates.inventory !== undefined) {
      result.stateUpdates.inventory = Array.isArray(updates.inventory) 
        ? updates.inventory 
        : [updates.inventory];
    }
    if (updates.spells !== undefined) {
      let spellsList = Array.isArray(updates.spells) ? updates.spells : [updates.spells];
      
      // Normalize spells - parser sometimes returns grouped structure
      // Check if first item has cantrips/1stLevel/etc instead of proper spell objects
      if (spellsList.length > 0 && spellsList[0].cantrips !== undefined) {
        console.warn('Parser returned grouped spell structure, flattening to individual spells');
        const grouped = spellsList[0];
        const flatSpells: any[] = [];
        
        // Extract cantrips (level 0)
        if (grouped.cantrips) {
          grouped.cantrips.forEach((name: string, idx: number) => {
            flatSpells.push({
              id: `cantrip-${name.toLowerCase().replace(/\s+/g, '-')}`,
              name,
              level: 0,
              school: 'Evocation',
              description: `Cantrip: ${name}`,
              icon: '✨'
            });
          });
        }
        
        // Extract leveled spells
        ['1stLevel', '2ndLevel', '3rdLevel', '4thLevel', '5thLevel', '6thLevel', '7thLevel', '8thLevel', '9thLevel'].forEach((key, levelIdx) => {
          const level = levelIdx + 1;
          if (grouped[key]) {
            grouped[key].forEach((name: string) => {
              flatSpells.push({
                id: `spell-${name.toLowerCase().replace(/\s+/g, '-')}`,
                name,
                level,
                school: 'Evocation',
                description: `Level ${level} spell: ${name}`,
                icon: level <= 3 ? '✨' : level <= 6 ? '🔮' : '⚡'
              });
            });
          }
        });
        
        result.stateUpdates.spells = flatSpells;
      } else {
        result.stateUpdates.spells = spellsList;
      }
    }
    if (updates.racialAbilities !== undefined) {
      result.stateUpdates.racialAbilities = Array.isArray(updates.racialAbilities) 
        ? updates.racialAbilities 
        : [updates.racialAbilities];
    }
    if (updates.classFeatures !== undefined) {
      result.stateUpdates.classFeatures = Array.isArray(updates.classFeatures) 
        ? updates.classFeatures 
        : [updates.classFeatures];
    }
    if (updates.classPowers !== undefined) {
      result.stateUpdates.classPowers = Array.isArray(updates.classPowers) 
        ? updates.classPowers 
        : [updates.classPowers];
    }
    if (updates.quests !== undefined) {
      result.stateUpdates.quests = Array.isArray(updates.quests) 
        ? updates.quests 
        : [updates.quests];
    }
    if (updates.companions !== undefined) {
      // Normalize companions - ensure they have required fields
      const companionsList = Array.isArray(updates.companions) ? updates.companions : [updates.companions];
      result.stateUpdates.companions = companionsList.map((c: any, idx: number) => ({
        id: c.id || `companion-${Date.now()}-${idx}`,
        name: c.name || 'Unknown',
        race: c.race || 'Unknown',
        age: c.age || 'Unknown',
        sex: c.sex || 'Unknown',
        hairColor: c.hairColor,
        outfit: c.outfit,
        class: c.class || c.role || 'Unknown',
        level: typeof c.level === 'number' ? c.level : 1,
        appearance: c.appearance || c.description || 'No description',
        personality: c.personality || 'Unknown',
        criticalMemories: c.criticalMemories || '',
        feelingsTowardsPlayer: c.feelingsTowardsPlayer || 'Neutral',
        relationship: c.relationship || 'Ally'
      }));
    }
    if (updates.encounteredCharacters !== undefined) {
      // Normalize encountered characters - ensure they have required fields
      const encounterList = Array.isArray(updates.encounteredCharacters) ? updates.encounteredCharacters : [updates.encounteredCharacters];
      result.stateUpdates.encounteredCharacters = encounterList.map((e: any, idx: number) => {
        let relationship = 0;
        if (e.relationship !== undefined) {
          const rel = Number(e.relationship);
          if (Number.isFinite(rel)) {
            relationship = Math.max(-3, Math.min(3, Math.floor(rel)));
          }
        }
        return {
          id: e.id || `encounter-${Date.now()}-${idx}`,
          name: e.name || 'Unknown',
          age: e.age || 'Unknown',
          sex: e.sex || 'Unknown',
          hairColor: e.hairColor,
          outfit: e.outfit,
          role: e.role || 'NPC',
          location: e.location || 'Unknown',
          appearance: e.appearance || e.description || 'No description',
          description: e.description || e.appearance || 'No description',
          status: e.status || 'alive',
          relationship
        };
      });
    }
    if (updates.businesses !== undefined) {
      // Normalize businesses - ensure they have required fields
      const businessList = Array.isArray(updates.businesses) ? updates.businesses : [updates.businesses];
      result.stateUpdates.businesses = businessList.map((b: any, idx: number) => ({
        id: b.id || `business-${Date.now()}-${idx}`,
        name: b.name || 'Unknown Business',
        weeklyIncome: typeof b.weeklyIncome === 'number' ? b.weeklyIncome : 0,
        purchaseCost: typeof b.purchaseCost === 'number' ? b.purchaseCost : 0,
        manager: b.manager || 'Unknown',
        owner: b.owner || characterName,
        runningCost: typeof b.runningCost === 'number' ? b.runningCost : 0,
        description: b.description || 'No description'
      }));
    }
    
    // Handle inventoryChanges (non-standard field) and convert to inventory
    if (updates.inventoryChanges !== undefined) {
      // Parser sometimes returns inventoryChanges instead of inventory
      // This is a non-standard format, but we'll handle it gracefully
      console.warn('Parser returned inventoryChanges instead of inventory - converting');
      // For now, just ignore this and let the parser learn the correct format
      // Future: could process add/remove operations
    }
  }
  
  return result;
}

export default function NarrativePanel({ 
  gameState, 
  setGameState,
  saveGameState,
  config, 
  costTracker, 
  setCostTracker,
  models,
  createSnapshot,
  sessionId 
}: NarrativePanelProps) {
  const [actionInput, setActionInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const narrativeRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (narrativeRef.current) {
      narrativeRef.current.scrollTop = narrativeRef.current.scrollHeight;
    }
  }, [gameState.narrativeHistory, streamingContent]);

  const processAction = async (action: string) => {
    if (!action.trim() || isProcessing) return;

    // Create snapshot before any action is taken
    createSnapshot();

    setIsProcessing(true);

    try {
      const playerTimestamp = Date.now();
      
      // Add player message to history
      const playerMessage = {
        id: `player-${playerTimestamp}`,
        type: 'player' as const,
        content: action,
        timestamp: playerTimestamp,
      };

      setGameState(prev => ({
        ...prev,
        narrativeHistory: [...prev.narrativeHistory, playerMessage],
      }));

      // Call Primary LLM with COMPLETE context:
      // - World Lore (worldBackstory)
      // - All entity backstories & revelations (in companions, NPCs, locations, quests, businesses)
      // - Summarized history (parsedRecaps)
      // - Recent conversations (last 3 exchanges = 6 messages)
      // - Full game state (character, inventory, spells, etc.)
      const recentMessages = gameState.narrativeHistory.slice(-6);
      const context = {
        // World lore (generated after first turn)
        worldLore: gameState.worldBackstory || null,
        // Character stats
        character: gameState.character,
        // Current game state
        location: gameState.location,
        previousLocations: gameState.previousLocations || [],
        inventory: gameState.inventory,
        statusEffects: gameState.statusEffects,
        spells: gameState.spells || [],
        quests: gameState.quests,
        companions: gameState.companions || [],
        encounteredCharacters: gameState.encounteredCharacters || [],
        businesses: gameState.businesses || [],
        // Historical context (condensed)
        parsedHistory: gameState.parsedRecaps.join('\n\n'),
        // Recent conversation (last 3 back-and-forth exchanges = 6 messages)
        recentMessages: recentMessages,
        // Current action
        action,
      };

      // Stream Primary LLM response
      setIsStreaming(true);
      setStreamingContent('');
      
      const primaryResponse = await callLLMStream(
        config.primaryLLM,
        [{ role: 'user', content: JSON.stringify(context) }],
        config.dmSystemPrompt,
        1600,
        config.openRouterApiKey,
        (chunk) => {
          // Update state immediately - React will batch renders naturally
          setStreamingContent(prev => prev + chunk);
        }
      );

      setIsStreaming(false);

      // Now add the complete DM message to history and capture updated state for parser
      const dmMessage = {
        id: `dm-${Date.now()}`,
        type: 'dm' as const,
        content: primaryResponse.content,
        timestamp: Date.now(),
      };

      let updatedStateForParser = gameState;
      setGameState(prev => {
        const updated = {
          ...prev,
          narrativeHistory: [...prev.narrativeHistory, dmMessage],
        };
        updatedStateForParser = updated;
        return updated;
      });

      // Log primary LLM call to debug log
      // IMPORTANT: Strip all imageUrls from context to prevent localStorage bloat
      const contextForDebugLog = {
        ...context,
        character: context.character.imageUrl ? { ...context.character, imageUrl: '[removed]' } : context.character,
        location: context.location?.imageUrl ? { ...context.location, imageUrl: '[removed]' } : context.location,
        previousLocations: context.previousLocations?.map((loc: any) => 
          loc.imageUrl ? { ...loc, imageUrl: '[removed]' } : loc
        ),
        companions: context.companions?.map((c: any) => 
          c.imageUrl ? { ...c, imageUrl: '[removed]' } : c
        ),
        encounteredCharacters: context.encounteredCharacters?.map((npc: any) => 
          npc.imageUrl ? { ...npc, imageUrl: '[removed]' } : npc
        ),
        businesses: context.businesses?.map((b: any) => 
          b.imageUrl ? { ...b, imageUrl: '[removed]' } : b
        ),
      };
      
      const primaryLogEntry = {
        id: `primary-${Date.now()}`,
        timestamp: Date.now(),
        type: 'primary' as const,
        prompt: JSON.stringify({
          system: config.dmSystemPrompt,
          context: contextForDebugLog
        }, null, 2),
        response: primaryResponse.content,
        model: config.primaryLLM,
        tokens: {
          prompt: primaryResponse.usage?.prompt_tokens || 0,
          completion: primaryResponse.usage?.completion_tokens || 0,
        },
      };

      // Show parser progress
      setIsParsing(true);

      // Now call Parser LLM to extract state updates with ESSENTIAL state
      // Include last recap for context (e.g., "She hands back the amulet" needs to know who "she" is)
      // But exclude full narrativeHistory to keep token count low
      const parserPrompt = JSON.stringify({
        narrative: primaryResponse.content,
        currentState: {
          character: updatedStateForParser.character,
          location: updatedStateForParser.location,
          inventory: updatedStateForParser.inventory,
          statusEffects: updatedStateForParser.statusEffects,
          spells: updatedStateForParser.spells,
          quests: updatedStateForParser.quests,
          companions: updatedStateForParser.companions,
          encounteredCharacters: updatedStateForParser.encounteredCharacters,
        },
        // Include last recap for context, but exclude full conversation history
        recentContext: updatedStateForParser.parsedRecaps.slice(-1)[0] || 'Adventure just beginning',
      });
      
      const parserResponse = await callLLM(
        config.parserLLM,
        [{
          role: 'user',
          content: parserPrompt
        }],
        config.parserSystemPrompt,
        4000,  // Increased to 4000 to handle complex game states with many items, quests, companions, NPCs
        config.openRouterApiKey
      );

      // Log parser LLM call to debug log
      // IMPORTANT: Strip all imageUrls from parser input to prevent localStorage bloat
      const parserInput = JSON.parse(parserPrompt);
      const parserInputForDebugLog = {
        ...parserInput,
        currentState: {
          ...parserInput.currentState,
          character: parserInput.currentState.character?.imageUrl ? 
            { ...parserInput.currentState.character, imageUrl: '[removed]' } : 
            parserInput.currentState.character,
          location: parserInput.currentState.location?.imageUrl ? 
            { ...parserInput.currentState.location, imageUrl: '[removed]' } : 
            parserInput.currentState.location,
          companions: parserInput.currentState.companions?.map((c: any) => 
            c.imageUrl ? { ...c, imageUrl: '[removed]' } : c
          ),
          encounteredCharacters: parserInput.currentState.encounteredCharacters?.map((npc: any) => 
            npc.imageUrl ? { ...npc, imageUrl: '[removed]' } : npc
          ),
        }
      };
      
      const parserLogEntry = {
        id: `parser-${Date.now()}`,
        timestamp: Date.now(),
        type: 'parser' as const,
        prompt: JSON.stringify({
          system: config.parserSystemPrompt,
          input: parserInputForDebugLog
        }, null, 2),
        response: parserResponse.content,
        model: config.parserLLM,
        tokens: {
          prompt: parserResponse.usage?.prompt_tokens || 0,
          completion: parserResponse.usage?.completion_tokens || 0,
        },
      };

      // Parse and validate JSON with robust error handling
      let parsedData: any = null;
      let parsingFailed = false;
      try {
        const extracted = extractAndParseJSON(parserResponse.content);
        
        // Use the character name from the parser's extracted data (prioritize fresh data)
        // Fall back to old state only if parser didn't extract a name
        const characterName = extracted.stateUpdates?.name || 
                              extracted.stateUpdates?.character?.name || 
                              updatedStateForParser.character.name || 
                              'Unknown';
        
        console.log('[OWNER DEBUG] Character name for validation:', characterName);
        console.log('[OWNER DEBUG] Extracted businesses (before validation):', extracted.stateUpdates?.businesses);
        
        parsedData = validateAndCoerceParserData(extracted, characterName);
        
        // Debug: Log what we extracted
        console.log('[OWNER DEBUG] Validated businesses (after validation):', parsedData.stateUpdates?.businesses);
        console.log('Parser extracted:', parsedData.stateUpdates);
      } catch (error: any) {
        // Log the raw response for debugging with length info
        console.error('Failed to parse parser response:', error.message);
        console.log('Parser response length:', parserResponse.content.length);
        console.log('Parser response starts with:', parserResponse.content.substring(0, 100));
        console.log('Parser response ends with:', parserResponse.content.substring(Math.max(0, parserResponse.content.length - 100)));
        
        // Show non-destructive error toast
        toast({
          title: 'Parser Warning',
          description: 'Could not extract game state updates. Narrative will continue without state changes.',
          variant: 'default',
        });
        
        parsingFailed = true;
      }

      // Update game state (with or without parsed data)
      setGameState(prev => {
        const updated = { ...prev };
        const updatedTabsSet = new Set<string>(prev.updatedTabs || []);
        
        if (!parsingFailed && parsedData) {
          const stateUpdates = parsedData.stateUpdates || {};
          
          // Update character basic info
          if (stateUpdates.name !== undefined) {
            updated.character.name = stateUpdates.name;
          }
          if (stateUpdates.race !== undefined) {
            updated.character.race = stateUpdates.race;
          }
          if (stateUpdates.class !== undefined) {
            updated.character.class = stateUpdates.class;
          }
          if (stateUpdates.age !== undefined) {
            updated.character.age = stateUpdates.age;
          }
          if (stateUpdates.sex !== undefined) {
            updated.character.sex = stateUpdates.sex;
          }
          if (stateUpdates.level !== undefined) {
            updated.character.level = stateUpdates.level;
            
            // If level changed but nextLevelXp wasn't provided, compute it
            if (stateUpdates.nextLevelXp === undefined) {
              const levelXpTable: Record<number, number> = {
                1: 0, 2: 300, 3: 900, 4: 2700, 5: 6500, 6: 14000, 
                7: 23000, 8: 34000, 9: 48000, 10: 64000, 11: 85000,
                12: 100000, 13: 120000, 14: 140000, 15: 165000,
                16: 195000, 17: 225000, 18: 265000, 19: 305000, 20: 355000
              };
              const computedNextLevel = levelXpTable[stateUpdates.level + 1] || 355000;
              updated.character.nextLevelXp = computedNextLevel;
              console.log(`Level changed to ${stateUpdates.level}, auto-computed nextLevelXp to ${computedNextLevel}`);
            }
          }
          
          if (stateUpdates.nextLevelXp !== undefined) {
            updated.character.nextLevelXp = stateUpdates.nextLevelXp;
            console.log(`Setting nextLevelXp from parser: ${stateUpdates.nextLevelXp}`);
          }
          
          // Update character stats
          // Update maxHp first if provided, then hp
          if (stateUpdates.maxHp !== undefined) {
            updated.character.maxHp = stateUpdates.maxHp;
            
            // If maxHp increased but hp wasn't specified, heal to new max
            // (this handles level-up scenarios where HP increases)
            if (stateUpdates.hp === undefined && stateUpdates.maxHp > prev.character.hp) {
              updated.character.hp = stateUpdates.maxHp;
              console.log(`MaxHP increased to ${stateUpdates.maxHp}, healing HP to match`);
            }
          }
          if (stateUpdates.hp !== undefined) {
            // If new HP is higher than current maxHp, increase maxHp to match
            if (stateUpdates.hp > updated.character.maxHp) {
              updated.character.maxHp = stateUpdates.hp;
            }
            updated.character.hp = Math.max(0, Math.min(stateUpdates.hp, updated.character.maxHp));
          }
          if (stateUpdates.gold !== undefined) {
            updated.character.gold = stateUpdates.gold;
          }
          if (stateUpdates.xp !== undefined) {
            updated.character.xp = stateUpdates.xp;
          }
          if (stateUpdates.nextLevelXp !== undefined) {
            updated.character.nextLevelXp = stateUpdates.nextLevelXp;
          }
          
          // Update attributes if changed
          if (stateUpdates.attributes !== undefined) {
            updated.character.attributes = { ...updated.character.attributes, ...stateUpdates.attributes };
          }
          
          // Update location - merge to preserve imageUrl and other fields
          if (stateUpdates.location !== undefined) {
            // Track old location before updating
            if (stateUpdates.location.name && stateUpdates.location.name !== prev.location.name) {
              const oldLocationName = prev.location.name;
              const prevLocations = prev.previousLocations || [];
              const locationExists = prevLocations.some(loc => loc.name === oldLocationName);
              if (oldLocationName && !locationExists) {
                const oldLocationObject = {
                  id: `loc-${Date.now()}`,
                  name: oldLocationName,
                  description: prev.location.description || '',
                  imageUrl: prev.location.imageUrl,
                  lastVisited: Date.now(),
                  backstory: prev.location.backstory,
                  revelations: prev.location.revelations,
                };
                updated.previousLocations = [...prevLocations, oldLocationObject];
              }
            }
            // Merge location data, but clear imageUrl if location name changed
            const locationNameChanged = stateUpdates.location.name && stateUpdates.location.name !== prev.location.name;
            if (locationNameChanged) {
              // Don't preserve imageUrl/backstory/revelations for new location
              updated.location = { 
                ...stateUpdates.location,
                imageUrl: undefined,
                backstory: undefined,
                revelations: undefined,
              };
            } else {
              // Same location, preserve imageUrl and other fields
              updated.location = { ...prev.location, ...stateUpdates.location };
            }
          }
          
          // Update status effects
          if (stateUpdates.statusEffects !== undefined) {
            updated.statusEffects = stateUpdates.statusEffects;
          }
          
          // Update inventory
          if (stateUpdates.inventory !== undefined) {
            updated.inventory = stateUpdates.inventory;
            updatedTabsSet.add('inventory');
          }
          
          // Update spells
          if (stateUpdates.spells !== undefined) {
            updated.spells = stateUpdates.spells;
            updatedTabsSet.add('spells');
          }
          
          // Update racial abilities
          if (stateUpdates.racialAbilities !== undefined) {
            updated.racialAbilities = stateUpdates.racialAbilities;
            updatedTabsSet.add('spells');
          }
          
          // Update class features
          if (stateUpdates.classFeatures !== undefined) {
            updated.classFeatures = stateUpdates.classFeatures;
            updatedTabsSet.add('spells');
          }
          
          // Update class powers
          if (stateUpdates.classPowers !== undefined) {
            updated.classPowers = stateUpdates.classPowers;
            updatedTabsSet.add('spells');
          }
          
          // Update quests - merge to preserve backstory and other fields
          if (stateUpdates.quests !== undefined) {
            const existingQuests = prev.quests || [];
            const newQuests = stateUpdates.quests;
            
            // Merge quests - update existing ones or add new ones
            const mergedQuests = [...existingQuests];
            newQuests.forEach((newQuest: any) => {
              const existingIndex = mergedQuests.findIndex(q => q.id === newQuest.id);
              if (existingIndex >= 0) {
                // Update existing quest, preserving fields like backstory
                mergedQuests[existingIndex] = { ...mergedQuests[existingIndex], ...newQuest };
              } else {
                // Add new quest
                mergedQuests.push(newQuest);
              }
            });
            updated.quests = mergedQuests;
            updatedTabsSet.add('quests');
          }
          
          // Update companions - NEVER DELETE, only merge/add
          // Also migrate NPCs to companions when they join the party
          if (stateUpdates.companions !== undefined) {
            const existingCompanions = prev.companions || [];
            const newCompanions = stateUpdates.companions;
            const existingNPCs = prev.encounteredCharacters || [];
            const npcsToRemove: string[] = [];
            
            // Merge companions - update existing ones or add new ones
            const mergedCompanions = [...existingCompanions];
            newCompanions.forEach((newComp: any) => {
              const existingIndex = mergedCompanions.findIndex(comp => comp.id === newComp.id);
              if (existingIndex >= 0) {
                // Update existing companion, preserving fields like imageUrl, backstory, revelations
                mergedCompanions[existingIndex] = { ...mergedCompanions[existingIndex], ...newComp };
              } else {
                // Check if this companion was previously an NPC
                const matchingNPC = existingNPCs.find(npc => 
                  npc.name.toLowerCase() === newComp.name.toLowerCase() ||
                  npc.id === newComp.id
                );
                
                if (matchingNPC) {
                  // Migrate NPC data to companion, preserving important fields
                  const migratedCompanion = {
                    ...newComp,
                    id: matchingNPC.id, // Keep the same ID
                    imageUrl: matchingNPC.imageUrl || newComp.imageUrl,
                    backstory: matchingNPC.backstory || newComp.backstory,
                    revelations: matchingNPC.revelations || newComp.revelations,
                    // Map NPC fields to companion fields where appropriate
                    appearance: newComp.appearance || matchingNPC.appearance || matchingNPC.description,
                    class: newComp.class || matchingNPC.role || 'Unknown',
                    // Convert relationship number to string if needed
                    relationship: newComp.relationship || (
                      matchingNPC.relationship >= 2 ? 'Ally' :
                      matchingNPC.relationship >= 1 ? 'Friendly' :
                      matchingNPC.relationship <= -2 ? 'Hostile' :
                      matchingNPC.relationship <= -1 ? 'Unfriendly' :
                      'Neutral'
                    ),
                  };
                  mergedCompanions.push(migratedCompanion);
                  // Mark NPC for removal
                  npcsToRemove.push(matchingNPC.id);
                  console.log(`[MIGRATION] NPC "${matchingNPC.name}" migrated to companion, preserving imageUrl and backstory`);
                } else {
                  // Add new companion (not from NPC)
                  mergedCompanions.push(newComp);
                }
              }
            });
            
            updated.companions = mergedCompanions;
            
            // Remove migrated NPCs from encounteredCharacters
            if (npcsToRemove.length > 0) {
              updated.encounteredCharacters = existingNPCs.filter(npc => !npcsToRemove.includes(npc.id));
              console.log(`[MIGRATION] Removed ${npcsToRemove.length} NPC(s) from encounters after migration to companions`);
            }
            
            updatedTabsSet.add('companions');
          }
          
          // Update encountered characters - NEVER DELETE, only merge/add
          if (stateUpdates.encounteredCharacters !== undefined) {
            const existingNPCs = updated.encounteredCharacters || prev.encounteredCharacters || [];
            const newNPCs = stateUpdates.encounteredCharacters;
            const currentCompanions = updated.companions || prev.companions || [];
            
            // Merge NPCs - update existing ones or add new ones
            const mergedNPCs = [...existingNPCs];
            newNPCs.forEach((newNPC: any) => {
              // Try multiple matching strategies to prevent duplicates:
              // 1. Match by ID (exact)
              // 2. Match by name (case-insensitive) - catches NPCs whose names were revealed
              // 3. If name is generic (Unknown, Mysterious, etc.), match by role+location
              
              const npcNameLower = newNPC.name.toLowerCase();
              const isGenericName = npcNameLower.includes('unknown') || 
                                    npcNameLower.includes('mysterious') || 
                                    npcNameLower.includes('stranger');
              
              let existingIndex = mergedNPCs.findIndex(npc => npc.id === newNPC.id);
              
              // If no ID match, try matching by name (for NPCs whose identity was revealed)
              if (existingIndex < 0 && !isGenericName && newNPC.name !== 'Unknown') {
                existingIndex = mergedNPCs.findIndex(npc => 
                  npc.name.toLowerCase() === npcNameLower
                );
                if (existingIndex >= 0) {
                  console.log(`[NPC DEDUP] Matched "${newNPC.name}" by name (ID changed from "${mergedNPCs[existingIndex].id}" to "${newNPC.id}")`);
                }
              }
              
              // If still no match and name is generic, try matching by role+location
              if (existingIndex < 0 && isGenericName && newNPC.role && newNPC.location) {
                existingIndex = mergedNPCs.findIndex(npc => 
                  npc.name.toLowerCase().includes('unknown') &&
                  npc.role === newNPC.role &&
                  npc.location === newNPC.location
                );
                if (existingIndex >= 0) {
                  console.log(`[NPC DEDUP] Matched generic NPC by role+location: ${newNPC.role} at ${newNPC.location}`);
                }
              }
              
              // Check if this NPC is already a companion (prevent duplication)
              const isCompanion = currentCompanions.some(comp => 
                comp.id === newNPC.id || 
                comp.name.toLowerCase() === npcNameLower
              );
              
              if (isCompanion) {
                console.log(`[MIGRATION] Skipping NPC "${newNPC.name}" - already a companion`);
              } else if (existingIndex >= 0) {
                // Update existing NPC, preserving important fields like imageUrl, backstory, revelations
                mergedNPCs[existingIndex] = { 
                  ...mergedNPCs[existingIndex], 
                  ...newNPC,
                  // Preserve these fields if they exist in the old NPC
                  imageUrl: newNPC.imageUrl || mergedNPCs[existingIndex].imageUrl,
                  backstory: newNPC.backstory || mergedNPCs[existingIndex].backstory,
                  revelations: mergedNPCs[existingIndex].revelations || newNPC.revelations,
                };
                console.log(`[NPC UPDATE] Updated existing NPC "${newNPC.name}" (id: ${newNPC.id})`);
              } else {
                // Add new NPC
                mergedNPCs.push(newNPC);
                console.log(`[NPC ADD] Added new NPC "${newNPC.name}" (id: ${newNPC.id})`);
              }
            });
            updated.encounteredCharacters = mergedNPCs;
            updatedTabsSet.add('encounters');
          }
          
          // Update businesses - merge/add, never delete
          if (stateUpdates.businesses !== undefined) {
            const existingBusinesses = prev.businesses || [];
            const newBusinesses = stateUpdates.businesses;
            
            console.log('[BUSINESS DEBUG] Processing business updates:', newBusinesses);
            console.log('[BUSINESS DEBUG] Character name:', prev.character.name);
            
            // Merge businesses - update existing ones or add new ones
            const mergedBusinesses = [...existingBusinesses];
            newBusinesses.forEach((newBusiness: any) => {
              console.log('[BUSINESS DEBUG] Adding/updating business:', newBusiness.name, 'Owner:', newBusiness.owner);
              const existingIndex = mergedBusinesses.findIndex(b => b.id === newBusiness.id);
              if (existingIndex >= 0) {
                // Update existing business
                mergedBusinesses[existingIndex] = { ...mergedBusinesses[existingIndex], ...newBusiness };
                console.log('[BUSINESS DEBUG] Updated existing business, final owner:', mergedBusinesses[existingIndex].owner);
              } else {
                // Add new business
                mergedBusinesses.push(newBusiness);
                console.log('[BUSINESS DEBUG] Added new business, final owner:', newBusiness.owner);
              }
            });
            updated.businesses = mergedBusinesses;
            updatedTabsSet.add('businesses');
          }
          
          // Track if location history was added
          if (stateUpdates.location && stateUpdates.location.name !== prev.location.name) {
            updatedTabsSet.add('locations');
          }

          // Store parsed recap for future context
          if (parsedData.recap) {
            updated.parsedRecaps = [...updated.parsedRecaps, parsedData.recap];
            updatedTabsSet.add('history');
          }
        }

        updated.turnCount = prev.turnCount + 1;
        updated.updatedTabs = Array.from(updatedTabsSet);
        
        // Auto-collect business income every 15 turns
        const lastIncome = prev.lastIncomeCollectedTurn || 0;
        if (updated.turnCount - lastIncome >= 15 && updated.businesses && updated.businesses.length > 0) {
          let totalIncome = 0;
          updated.businesses.forEach(business => {
            const netProfit = business.weeklyIncome - business.runningCost;
            totalIncome += netProfit;
          });
          
          if (totalIncome > 0) {
            updated.character.gold += totalIncome;
            updated.lastIncomeCollectedTurn = updated.turnCount;
            
            // Add a system message about income collection
            const incomeMessage: typeof updated.narrativeHistory[0] = {
              id: `income-${updated.turnCount}`,
              type: 'dm',
              content: `**[Business Income]** You've collected ${totalIncome.toLocaleString()} gold from your businesses! (Net profit from ${updated.businesses.length} business${updated.businesses.length > 1 ? 'es' : ''})`,
              timestamp: Date.now(),
            };
            updated.narrativeHistory = [...updated.narrativeHistory, incomeMessage];
          }
        }

        // Add debug log entries
        updated.debugLog = [
          ...(prev.debugLog || []),
          primaryLogEntry,
          parserLogEntry,
        ];

        return updated;
      });

      // Trigger save and revelations after parser updates - use setTimeout to ensure setGameState completes first
      if (!parsingFailed && parsedData && parsedData.stateUpdates) {
        setTimeout(() => {
          // Save the current game state (which was just updated by parser's setGameState)
          saveGameState();
          
          // Track revelations with fresh state (after parser updates are committed)
          if (config.autoGenerateRevelations && primaryResponse?.content) {
            // Get fresh state by using functional update
            setGameState(freshState => {
              // Call revelations tracking with the committed state
              trackRevelations({
                narrative: primaryResponse.content,
                gameState: freshState,
                config,
              }).then(revelationsResult => {
                // Update cost tracker with revelations cost
                if (revelationsResult.usage) {
                  const revelationsModel = models.find(m => m.id === config.revelationsLLM);
                  if (revelationsModel) {
                    const revelationsCost = 
                      (revelationsResult.usage.prompt_tokens * parseFloat(revelationsModel.pricing.prompt)) +
                      (revelationsResult.usage.completion_tokens * parseFloat(revelationsModel.pricing.completion));
                    
                    setCostTracker(prev => ({
                      ...prev,
                      revelationsCost: (prev.revelationsCost || 0) + revelationsCost,
                      lastTurnRevelationsCost: revelationsCost,
                      sessionCost: prev.sessionCost + revelationsCost,
                    }));
                  }
                }

                // Add debug log
                if (revelationsResult.debugLogEntry) {
                  setGameState(prev => ({
                    ...prev,
                    debugLog: [...(prev.debugLog || []), revelationsResult.debugLogEntry!],
                  }));
                }

                // Update entities with revelations
                if (revelationsResult.revelations && revelationsResult.revelations.length > 0) {
                  setGameState(prev => {
                    const updated = { ...prev };
                    
                    revelationsResult.revelations.forEach(revelation => {
                      const { entityType, entityId, text } = revelation;
                      const newRevelation = {
                        text,
                        revealedAtTurn: updated.turnCount,
                      };

                      if (entityType === 'character') {
                        // Add to main character
                        const existingRevelations = updated.character.revelations || [];
                        updated.character = {
                          ...updated.character,
                          revelations: [...existingRevelations, newRevelation],
                        };
                      } else if (entityType === 'companion') {
                        // Find and update companion
                        updated.companions = updated.companions?.map(c =>
                          c.id === entityId ? {
                            ...c,
                            revelations: [...(c.revelations || []), newRevelation],
                          } : c
                        );
                      } else if (entityType === 'npc') {
                        // Find and update NPC
                        updated.encounteredCharacters = updated.encounteredCharacters?.map(npc =>
                          npc.id === entityId ? {
                            ...npc,
                            revelations: [...(npc.revelations || []), newRevelation],
                          } : npc
                        );
                      } else if (entityType === 'quest') {
                        // Find and update quest
                        updated.quests = updated.quests?.map(q =>
                          q.id === entityId ? {
                            ...q,
                            revelations: [...(q.revelations || []), newRevelation],
                          } : q
                        );
                      } else if (entityType === 'location') {
                        // Update current or previous location
                        // Check if it's for current location (by name or no entityId specified)
                        if (updated.location.name === revelation.entityName || !entityId) {
                          updated.location = {
                            ...updated.location,
                            revelations: [...(updated.location.revelations || []), newRevelation],
                          };
                        } else {
                          // Check previous locations by id
                          updated.previousLocations = updated.previousLocations?.map(loc =>
                            loc.id === entityId ? {
                              ...loc,
                              revelations: [...(loc.revelations || []), newRevelation],
                            } : loc
                          );
                        }
                      }
                    });

                    // Create friendly notification message for revealed backstories
                    const entityNames = revelationsResult.revelations.map(r => {
                      // Use entityName from result if available, otherwise look up in game state
                      if (r.entityName) return r.entityName;
                      
                      // Lookup entity name from game state by type and id
                      if (r.entityType === 'character') {
                        return updated.character.name;
                      } else if (r.entityType === 'companion') {
                        const companion = updated.companions?.find(c => c.id === r.entityId);
                        return companion?.name || 'a companion';
                      } else if (r.entityType === 'npc') {
                        const npc = updated.encounteredCharacters?.find(n => n.id === r.entityId);
                        return npc?.name || 'an NPC';
                      } else if (r.entityType === 'quest') {
                        const quest = updated.quests?.find(q => q.id === r.entityId);
                        return quest?.title || 'a quest';
                      } else if (r.entityType === 'location') {
                        return updated.location.name || 'this location';
                      }
                      return 'an entity';
                    });
                    const uniqueNames = Array.from(new Set(entityNames));
                    const count = revelationsResult.revelations.length;
                    
                    let notificationContent = '';
                    if (uniqueNames.length === 1) {
                      notificationContent = `✨ *You've uncovered ${count} ${count === 1 ? 'revelation' : 'revelations'} about ${uniqueNames[0]}! Check their details to learn more.*`;
                    } else if (uniqueNames.length === 2) {
                      notificationContent = `✨ *You've uncovered ${count} ${count === 1 ? 'revelation' : 'revelations'} about ${uniqueNames[0]} and ${uniqueNames[1]}! Check their details to learn more.*`;
                    } else {
                      const lastEntity = uniqueNames[uniqueNames.length - 1];
                      const otherEntities = uniqueNames.slice(0, -1).join(', ');
                      notificationContent = `✨ *You've uncovered ${count} revelations about ${otherEntities}, and ${lastEntity}! Check their details to learn more.*`;
                    }
                    
                    const notificationMessage = {
                      id: `revelation-notification-${Date.now()}`,
                      type: 'dm' as const,
                      content: notificationContent,
                      timestamp: Date.now(),
                    };
                    
                    updated.narrativeHistory = [...updated.narrativeHistory, notificationMessage];

                    return updated;
                  });

                  console.log(`[REVELATIONS] Added ${revelationsResult.revelations.length} revelations to game state`);
                }
              }).catch(error => {
                console.error('[REVELATIONS] Error tracking revelations:', error);
              });
              
              // Return state unchanged - revelations updates happen in nested setGameState calls
              return freshState;
            });
          }

          // Generate world lore if needed (first location visited)
          setGameState(freshState => {
            if (config.autoGenerateLore && needsWorldLoreGeneration(freshState)) {
              generateWorldLore({
                gameState: freshState,
                config,
              }).then(loreResult => {
                // Update cost tracker with lore cost
                if (loreResult.usage) {
                  const loreModel = models.find(m => m.id === config.loreLLM);
                  if (loreModel) {
                    const loreCost = 
                      (loreResult.usage.prompt_tokens * parseFloat(loreModel.pricing.prompt)) +
                      (loreResult.usage.completion_tokens * parseFloat(loreModel.pricing.completion));
                    
                    setCostTracker(prev => ({
                      ...prev,
                      loreCost: (prev.loreCost || 0) + loreCost,
                      sessionCost: prev.sessionCost + loreCost,
                    }));
                  }
                }

                // Add debug log
                if (loreResult.debugLogEntry) {
                  setGameState(prev => ({
                    ...prev,
                    debugLog: [...(prev.debugLog || []), loreResult.debugLogEntry!],
                  }));
                }

                // Update game state with world lore
                if (loreResult.worldLore) {
                  setGameState(prev => ({
                    ...prev,
                    worldBackstory: loreResult.worldLore || undefined,
                  }));

                  // Create notification about world lore generation
                  const notificationMessage = {
                    id: `lore-notification-${Date.now()}`,
                    type: 'dm' as const,
                    content: `🌍 *The world lore has been generated! Click the World Map button to explore the rich history and geography of this realm.*`,
                    timestamp: Date.now(),
                  };
                  
                  setGameState(prev => ({
                    ...prev,
                    narrativeHistory: [...prev.narrativeHistory, notificationMessage],
                  }));

                  console.log('[LORE] World lore generated and added to game state');
                }
              }).catch(error => {
                console.error('[LORE] Error generating world lore:', error);
              });
            }
            
            // Return state unchanged - lore updates happen in nested setGameState calls
            return freshState;
          });
        }, 10);
      }

      // Update cost tracker
      const primaryModel = models.find(m => m.id === config.primaryLLM);
      const parserModel = models.find(m => m.id === config.parserLLM);

      if (primaryModel && parserModel) {
        const primaryCost = 
          (primaryResponse.usage.prompt_tokens * parseFloat(primaryModel.pricing.prompt)) +
          (primaryResponse.usage.completion_tokens * parseFloat(primaryModel.pricing.completion));
        
        const parserCost = 
          (parserResponse.usage.prompt_tokens * parseFloat(parserModel.pricing.prompt)) +
          (parserResponse.usage.completion_tokens * parseFloat(parserModel.pricing.completion));

        setCostTracker(prev => ({
          ...prev,
          turnCount: prev.turnCount + 1,
          sessionCost: prev.sessionCost + primaryCost + parserCost,
          primaryTokens: {
            prompt: prev.primaryTokens.prompt + primaryResponse.usage.prompt_tokens,
            completion: prev.primaryTokens.completion + primaryResponse.usage.completion_tokens,
          },
          parserTokens: {
            prompt: prev.parserTokens.prompt + parserResponse.usage.prompt_tokens,
            completion: prev.parserTokens.completion + parserResponse.usage.completion_tokens,
          },
          primaryCost: prev.primaryCost + primaryCost,
          parserCost: prev.parserCost + parserCost,
          lastTurnPrimaryTokens: {
            prompt: primaryResponse.usage.prompt_tokens,
            completion: primaryResponse.usage.completion_tokens,
          },
          lastTurnParserTokens: {
            prompt: parserResponse.usage.prompt_tokens,
            completion: parserResponse.usage.completion_tokens,
          },
          lastTurnPrimaryCost: primaryCost,
          lastTurnParserCost: parserCost,
          lastTurnCost: primaryCost + parserCost,
        }));
      }

      setActionInput('');
      setIsParsing(false);
      setStreamingContent('');

      // Auto-generate images for new entities (async, non-blocking)
      setGameState(currentState => {
        // Track entities needing images
        const imagesToGenerate: Array<{
          entityType: 'character' | 'companion' | 'npc' | 'location' | 'business';
          entity: any;
          id: string;
        }> = [];

        // Check character
        if (needsImageGeneration(currentState.character)) {
          imagesToGenerate.push({
            entityType: 'character',
            entity: currentState.character,
            id: 'character',
          });
        }

        // Check companions
        currentState.companions?.forEach(companion => {
          if (needsImageGeneration(companion)) {
            imagesToGenerate.push({
              entityType: 'companion',
              entity: companion,
              id: companion.id,
            });
          }
        });

        // Check NPCs
        currentState.encounteredCharacters?.forEach(npc => {
          if (needsImageGeneration(npc)) {
            imagesToGenerate.push({
              entityType: 'npc',
              entity: npc,
              id: npc.id,
            });
          }
        });

        // Check businesses
        currentState.businesses?.forEach(business => {
          if (needsImageGeneration(business)) {
            imagesToGenerate.push({
              entityType: 'business',
              entity: business,
              id: business.id,
            });
          }
        });

        // Check location
        if (needsImageGeneration(currentState.location)) {
          imagesToGenerate.push({
            entityType: 'location',
            entity: currentState.location,
            id: 'current',
          });
        }

        // Generate images in the background
        if (imagesToGenerate.length > 0) {
          Promise.allSettled(
            imagesToGenerate.map(async ({ entityType, entity, id }) => {
              const result = await generateEntityImage({
                entityType,
                entity,
                config,
                sessionId,
              });
              return { entityType, id, result };
            })
          ).then(settledResults => {
            // Calculate total image generation cost and collect debug logs
            let totalImageCost = 0;
            const imageDebugLogs: any[] = [];
            
            // Update game state with generated images
            setGameState(prev => {
              const updated = { ...prev };
              
              settledResults.forEach((settledResult, index) => {
                if (settledResult.status === 'rejected') {
                  console.error('Image generation rejected:', settledResult.reason);
                  // Create a fallback debug entry for the rejected promise
                  const rejectedEntity = imagesToGenerate[index];
                  imageDebugLogs.push({
                    id: `image-rejected-${Date.now()}-${index}`,
                    timestamp: Date.now(),
                    type: 'image' as const,
                    prompt: 'Promise rejected before image generation could complete',
                    response: JSON.stringify({ 
                      error: settledResult.reason?.message || String(settledResult.reason),
                      stack: settledResult.reason?.stack 
                    }, null, 2),
                    model: 'google/gemini-2.5-flash-image-preview',
                    entityType: rejectedEntity.entityType,
                    imageUrl: null,
                    error: settledResult.reason?.message || 'Promise rejected',
                  });
                  return;
                }
                
                const { entityType, id, result } = settledResult.value;
                
                // Collect debug log entry (even for failed image generations)
                if (result.debugLogEntry) {
                  imageDebugLogs.push(result.debugLogEntry);
                }
                
                if (!result.imageUrl) return;

                // Calculate cost for this image generation
                if (result.usage) {
                  // Find the image model pricing (google/gemini-2.5-flash-image-preview)
                  const imageModel = models.find(m => m.id === 'google/gemini-2.5-flash-image-preview');
                  if (imageModel) {
                    const imageCost = 
                      (result.usage.prompt_tokens * parseFloat(imageModel.pricing.prompt)) +
                      (result.usage.completion_tokens * parseFloat(imageModel.pricing.completion));
                    totalImageCost += imageCost;
                  }
                }

                if (entityType === 'character') {
                  updated.character = { ...updated.character, imageUrl: result.imageUrl || undefined };
                } else if (entityType === 'companion') {
                  updated.companions = updated.companions?.map(c =>
                    c.id === id ? { ...c, imageUrl: result.imageUrl || undefined } : c
                  );
                } else if (entityType === 'npc') {
                  updated.encounteredCharacters = updated.encounteredCharacters?.map(npc =>
                    npc.id === id ? { ...npc, imageUrl: result.imageUrl || undefined } : npc
                  );
                } else if (entityType === 'business') {
                  updated.businesses = updated.businesses?.map(b =>
                    b.id === id ? { ...b, imageUrl: result.imageUrl || undefined } : b
                  );
                } else if (entityType === 'location') {
                  updated.location = { ...updated.location, imageUrl: result.imageUrl || undefined };
                }
              });
              
              // Add image debug logs to debugLog
              if (imageDebugLogs.length > 0) {
                updated.debugLog = [...(updated.debugLog || []), ...imageDebugLogs];
              }

              return updated;
            });

            // Update cost tracker with image generation costs
            if (totalImageCost > 0) {
              setCostTracker(prev => ({
                ...prev,
                imageCost: prev.imageCost + totalImageCost,
                lastTurnImageCost: (prev.lastTurnImageCost || 0) + totalImageCost,
                sessionCost: prev.sessionCost + totalImageCost,
              }));
            }
          });
        }

        // Auto-generate backstories for new entities (async, non-blocking)
        if (config.autoGenerateBackstories) {
          // Track entities needing backstories
          const backstoriesToGenerate: Array<{
            entityType: 'companion' | 'npc' | 'quest' | 'location';
            entity: any;
            id: string;
          }> = [];

          // Check companions
          currentState.companions?.forEach(companion => {
            if (needsBackstoryGeneration(companion)) {
              backstoriesToGenerate.push({
                entityType: 'companion',
                entity: companion,
                id: companion.id,
              });
            }
          });

          // Check NPCs
          currentState.encounteredCharacters?.forEach(npc => {
            if (needsBackstoryGeneration(npc)) {
              backstoriesToGenerate.push({
                entityType: 'npc',
                entity: npc,
                id: npc.id,
              });
            }
          });

          // Check quests
          currentState.quests?.forEach(quest => {
            if (needsBackstoryGeneration(quest)) {
              backstoriesToGenerate.push({
                entityType: 'quest',
                entity: quest,
                id: quest.id,
              });
            }
          });

          // Check location
          if (needsBackstoryGeneration(currentState.location)) {
            backstoriesToGenerate.push({
              entityType: 'location',
              entity: currentState.location,
              id: 'current',
            });
          }

          // Generate backstories in the background
          if (backstoriesToGenerate.length > 0) {
            Promise.allSettled(
              backstoriesToGenerate.map(async ({ entityType, entity, id }) => {
                const result = await generateEntityBackstory({
                  entityType,
                  entity,
                  gameState: currentState,
                  config,
                });
                return { entityType, id, result };
              })
            ).then(settledResults => {
              // Collect debug logs
              const backstoryDebugLogs: any[] = [];
              
              // Update game state with generated backstories
              setGameState(prev => {
                const updated = { ...prev };
                
                settledResults.forEach((settledResult, index) => {
                  if (settledResult.status === 'rejected') {
                    console.error('Backstory generation rejected:', settledResult.reason);
                    // Create a fallback debug entry for the rejected promise
                    const rejectedEntity = backstoriesToGenerate[index];
                    backstoryDebugLogs.push({
                      id: `backstory-rejected-${Date.now()}-${index}`,
                      timestamp: Date.now(),
                      type: 'backstory' as const,
                      prompt: 'Promise rejected before backstory generation could complete',
                      response: JSON.stringify({ 
                        error: settledResult.reason?.message || String(settledResult.reason),
                        stack: settledResult.reason?.stack 
                      }, null, 2),
                      model: config.backstoryLLM || 'unknown',
                      entityType: rejectedEntity.entityType,
                      error: settledResult.reason?.message || 'Promise rejected',
                    });
                    return;
                  }
                  
                  const { entityType, id, result } = settledResult.value;
                  
                  // Always collect debug log entry (for both successful and failed backstory generations)
                  if (result.debugLogEntry) {
                    backstoryDebugLogs.push(result.debugLogEntry);
                  }
                  
                  // Only update state if backstory was generated
                  if (!result.backstory) return;

                  // Clone arrays to ensure React detects state changes
                  if (entityType === 'companion') {
                    updated.companions = updated.companions?.map(c =>
                      c.id === id ? { ...c, backstory: result.backstory || undefined } : c
                    );
                  } else if (entityType === 'npc') {
                    updated.encounteredCharacters = updated.encounteredCharacters?.map(npc =>
                      npc.id === id ? { ...npc, backstory: result.backstory || undefined } : npc
                    );
                  } else if (entityType === 'quest') {
                    updated.quests = updated.quests?.map(q =>
                      q.id === id ? { ...q, backstory: result.backstory || undefined } : q
                    );
                  } else if (entityType === 'location') {
                    updated.location = { ...updated.location, backstory: result.backstory || undefined };
                  }
                });
                
                // Add backstory debug logs to debugLog
                if (backstoryDebugLogs.length > 0) {
                  updated.debugLog = [...(updated.debugLog || []), ...backstoryDebugLogs];
                }

                return updated;
              });
              
              // After all backstories are generated and state updated, parse backstories for entity updates
              // Only run if we actually generated backstories
              if (backstoriesToGenerate.length > 0) {
                setTimeout(() => {
                  console.log('[BACKSTORY PARSER] Starting parser for', backstoriesToGenerate.length, 'entities');
                  
                  // Call parser with current game state
                  setGameState(freshState => {
                    // Run parser asynchronously
                    parseBackstoriesForEntityUpdates(freshState, config)
                      .then(parserResult => {
                        console.log('[BACKSTORY PARSER] Received parser result:', parserResult.summary);
                        console.log('[BACKSTORY PARSER] Entity updates:', {
                          npcs: parserResult.entityUpdates.npcs.length,
                          companions: parserResult.entityUpdates.companions.length,
                          locations: parserResult.entityUpdates.locations.length,
                          quests: parserResult.entityUpdates.quests.length,
                        });
                        
                        // Apply entity updates to game state
                        setGameState(prev => {
                          const updated = { ...prev };
                          let updatesApplied = 0;
                          
                          // Update NPCs
                          if (parserResult.entityUpdates.npcs.length > 0) {
                            updated.encounteredCharacters = updated.encounteredCharacters.map(npc => {
                              const updateForNpc = parserResult.entityUpdates.npcs.find(u => u.id === npc.id);
                              if (updateForNpc) {
                                console.log('[BACKSTORY PARSER] Updating NPC:', npc.name, updateForNpc.updates);
                                updatesApplied++;
                                return { ...npc, ...updateForNpc.updates };
                              }
                              return npc;
                            });
                          }
                          
                          // Update companions
                          if (parserResult.entityUpdates.companions.length > 0) {
                            updated.companions = updated.companions.map(comp => {
                              const updateForComp = parserResult.entityUpdates.companions.find(u => u.id === comp.id);
                              if (updateForComp) {
                                console.log('[BACKSTORY PARSER] Updating companion:', comp.name, updateForComp.updates);
                                updatesApplied++;
                                return { ...comp, ...updateForComp.updates };
                              }
                              return comp;
                            });
                          }
                          
                          // Update locations (current and previous)
                          if (parserResult.entityUpdates.locations.length > 0) {
                            parserResult.entityUpdates.locations.forEach(locUpdate => {
                              if (locUpdate.id === 'current') {
                                console.log('[BACKSTORY PARSER] Updating current location:', updated.location.name, locUpdate.updates);
                                updated.location = { ...updated.location, ...locUpdate.updates };
                                updatesApplied++;
                              } else {
                                updated.previousLocations = updated.previousLocations?.map(loc =>
                                  (loc as any).id === locUpdate.id ? { ...loc, ...locUpdate.updates } : loc
                                ) || [];
                              }
                            });
                          }
                          
                          // Update quests
                          if (parserResult.entityUpdates.quests.length > 0) {
                            updated.quests = updated.quests?.map(quest => {
                              const updateForQuest = parserResult.entityUpdates.quests.find(u => u.id === quest.id);
                              if (updateForQuest) {
                                console.log('[BACKSTORY PARSER] Updating quest:', quest.title, updateForQuest.updates);
                                updatesApplied++;
                                return { ...quest, ...updateForQuest.updates };
                              }
                              return quest;
                            }) || [];
                          }
                          
                          // Add backstory parser debug log
                          if (parserResult.debugLogEntry) {
                            updated.debugLog = [...(updated.debugLog || []), parserResult.debugLogEntry];
                          }
                          
                          console.log('[BACKSTORY PARSER] Applied', updatesApplied, 'entity updates');
                          
                          return updated;
                        });
                      })
                      .catch(error => {
                        console.error('[BACKSTORY PARSER] Error parsing backstories:', error);
                        // Log error to debug log
                        setGameState(prev => ({
                          ...prev,
                          debugLog: [...(prev.debugLog || []), {
                            id: `backstoryparser-error-${Date.now()}`,
                            timestamp: Date.now(),
                            type: 'backstoryparser' as const,
                            prompt: 'Parser failed to execute',
                            response: JSON.stringify({ error: error.message, stack: error.stack }, null, 2),
                            error: error.message,
                          }],
                        }));
                      });
                    
                    // Return current state immediately
                    return freshState;
                  });
                }, 1000);
              }
            });
          }
        }

        return currentState;
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process action',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setIsStreaming(false);
      setIsParsing(false);
    }
  };

  const handleSubmit = () => {
    processAction(actionInput);
  };


  return (
    <main className="lg:col-span-6 flex flex-col space-y-4">
      {/* Narrative Display */}
      <div className="bg-card border-2 border-border rounded-lg ornate-border parchment-texture overflow-hidden flex flex-col h-[500px]">
        <div className="bg-gradient-to-b from-primary/20 to-transparent p-4 border-b border-border flex-shrink-0">
          <h2 className="text-xl font-serif font-semibold text-primary flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            The Tale Unfolds
          </h2>
        </div>

        <div 
          ref={narrativeRef}
          className="flex-1 overflow-y-auto p-6 space-y-4" 
          data-testid="narrative-container"
        >
          {gameState.narrativeHistory.length === 0 && !isStreaming ? (
            <div className="bg-muted/20 border-l-4 border-primary rounded-r-lg p-4 fade-in">
              <div className="text-foreground leading-relaxed prose prose-invert prose-sm max-w-none">
                <p>Your adventure begins here. What will you do?</p>
              </div>
            </div>
          ) : (
            <>
              {gameState.narrativeHistory.map((message) => (
                <div 
                  key={message.id} 
                  className={`fade-in ${message.type === 'player' ? 'flex justify-end' : ''}`}
                  data-testid={`message-${message.type}-${message.id}`}
                >
                  {message.type === 'dm' ? (
                    <div className="bg-muted/20 border-l-4 border-primary rounded-r-lg p-4">
                      <div className="text-foreground leading-relaxed prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-accent/20 border border-accent rounded-lg p-3 max-w-md">
                      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        You:
                      </div>
                      <p className="text-sm text-foreground">{message.content}</p>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Streaming content */}
              {isStreaming && (
                <div className="fade-in" data-testid="message-dm-streaming">
                  <div className="bg-muted/20 border-l-4 border-primary rounded-r-lg p-4">
                    <div className="text-foreground leading-relaxed prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {streamingContent || ''}
                      </ReactMarkdown>
                      <span className="inline-block w-1 h-4 ml-1 bg-primary animate-pulse" />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Parser Progress Indicator */}
      {isParsing && (
        <div className="bg-accent/10 border border-accent rounded-lg p-4 flex items-center gap-3" data-testid="parser-progress">
          <Loader2 className="w-5 h-5 text-accent animate-spin" />
          <div className="flex-1">
            <div className="text-sm font-medium text-accent mb-1">Analyzing narrative...</div>
            <Progress value={100} className="h-2" />
          </div>
        </div>
      )}

      {/* Action Input */}
      <div className="bg-card border-2 border-border rounded-lg ornate-border parchment-texture p-4">
        <h3 className="text-sm font-serif font-semibold text-primary mb-3">What do you do?</h3>

        {/* Custom Action */}
        <div className="flex gap-2">
          <Input
            value={actionInput}
            onChange={(e) => setActionInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Describe your action..."
            disabled={isProcessing}
            className="flex-1 bg-input border-border"
            data-testid="input-custom-action"
          />
          <Button
            onClick={handleSubmit}
            disabled={isProcessing || !actionInput.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            data-testid="button-submit-action"
          >
            <ArrowRight className="w-5 h-5 mr-2" />
            <span className="hidden sm:inline">Submit</span>
          </Button>
        </div>
      </div>

      {/* LLM Status */}
      <div className="bg-card border border-border rounded-lg p-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-accent rounded-full" />
            <span className="text-muted-foreground">Primary:</span>
            <span className="font-mono text-foreground" data-testid="text-primary-model">
              {config.primaryLLM.split('/').pop()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-accent rounded-full" />
            <span className="text-muted-foreground">Parser:</span>
            <span className="font-mono text-foreground" data-testid="text-parser-model">
              {config.parserLLM.split('/').pop()}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
