import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GameStateData, GameConfig, CostTracker, OpenRouterModel } from '@shared/schema';
import { callLLM } from '@/lib/openrouter';
import { DM_SYSTEM_PROMPT, PARSER_SYSTEM_PROMPT } from '@/lib/game-state';
import { ArrowRight, Search, MessageCircle, Sword, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NarrativePanelProps {
  gameState: GameStateData;
  setGameState: (state: GameStateData | ((prev: GameStateData) => GameStateData)) => void;
  config: GameConfig;
  costTracker: CostTracker;
  setCostTracker: (tracker: CostTracker | ((prev: CostTracker) => CostTracker)) => void;
  models: OpenRouterModel[];
}

const QUICK_ACTIONS = [
  { id: 'investigate', label: 'Investigate', description: 'Examine surroundings', icon: Search },
  { id: 'talk', label: 'Talk', description: 'Speak to someone', icon: MessageCircle },
  { id: 'attack', label: 'Attack', description: 'Ready your weapon', icon: Sword },
  { id: 'use', label: 'Use Item', description: 'Access inventory', icon: Package },
];

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

function validateAndCoerceParserData(data: any): any {
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
    
    // Coerce string fields
    if (updates.name !== undefined) result.stateUpdates.name = String(updates.name);
    if (updates.class !== undefined) result.stateUpdates.class = String(updates.class);
    if (updates.age !== undefined) result.stateUpdates.age = String(updates.age);
    
    // Coerce numeric fields with finite check
    if (updates.level !== undefined) {
      const level = Number(updates.level);
      if (Number.isFinite(level) && level >= 1) {
        result.stateUpdates.level = Math.floor(level);
      }
    }
    if (updates.hp !== undefined) {
      const hp = Number(updates.hp);
      if (Number.isFinite(hp) && hp >= 0) {
        result.stateUpdates.hp = Math.floor(hp);
      }
    }
    if (updates.gold !== undefined) {
      const gold = Number(updates.gold);
      if (Number.isFinite(gold) && gold >= 0) {
        result.stateUpdates.gold = Math.floor(gold);
      }
    }
    if (updates.xp !== undefined) {
      const xp = Number(updates.xp);
      if (Number.isFinite(xp) && xp >= 0) {
        result.stateUpdates.xp = Math.floor(xp);
      }
    }
    
    // Copy complex fields as-is
    if (updates.attributes !== undefined) result.stateUpdates.attributes = updates.attributes;
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
      result.stateUpdates.spells = Array.isArray(updates.spells) 
        ? updates.spells 
        : [updates.spells];
    }
    if (updates.quests !== undefined) {
      result.stateUpdates.quests = Array.isArray(updates.quests) 
        ? updates.quests 
        : [updates.quests];
    }
    if (updates.companions !== undefined) {
      result.stateUpdates.companions = Array.isArray(updates.companions) 
        ? updates.companions 
        : [updates.companions];
    }
    if (updates.encounteredCharacters !== undefined) {
      result.stateUpdates.encounteredCharacters = Array.isArray(updates.encounteredCharacters) 
        ? updates.encounteredCharacters 
        : [updates.encounteredCharacters];
    }
  }
  
  return result;
}

export default function NarrativePanel({ 
  gameState, 
  setGameState, 
  config, 
  costTracker, 
  setCostTracker,
  models 
}: NarrativePanelProps) {
  const [actionInput, setActionInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const narrativeRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (narrativeRef.current) {
      narrativeRef.current.scrollTop = narrativeRef.current.scrollHeight;
    }
  }, [gameState.narrativeHistory]);

  const processAction = async (action: string) => {
    if (!action.trim() || isProcessing) return;

    setIsProcessing(true);

    try {
      // Add player message to history
      const playerMessage = {
        id: Date.now().toString(),
        type: 'player' as const,
        content: action,
        timestamp: Date.now(),
      };

      setGameState(prev => ({
        ...prev,
        narrativeHistory: [...prev.narrativeHistory, playerMessage],
      }));

      // Call Primary LLM - send parsed recaps + 3 most recent messages + all stats for context
      // Include the just-submitted player message in recent context
      const updatedHistory = [...gameState.narrativeHistory, playerMessage];
      const recentMessages = updatedHistory.slice(-3);
      const context = {
        // Character stats
        character: gameState.character,
        // Current game state
        location: gameState.location,
        inventory: gameState.inventory,
        statusEffects: gameState.statusEffects,
        quests: gameState.quests,
        // Historical context (condensed)
        parsedHistory: gameState.parsedRecaps.join('\n\n'),
        // Recent conversation (last 3 messages including current player message)
        recentMessages: recentMessages,
        // Current action
        action,
      };

      const primaryResponse = await callLLM(
        config.primaryLLM,
        [{ role: 'user', content: JSON.stringify(context) }],
        config.dmSystemPrompt,
        800,
        config.openRouterApiKey
      );

      // Display DM response immediately
      const dmMessage = {
        id: Date.now().toString(),
        type: 'dm' as const,
        content: primaryResponse.content,
        timestamp: Date.now(),
      };

      setGameState(prev => ({
        ...prev,
        narrativeHistory: [...prev.narrativeHistory, dmMessage],
      }));

      // Build fresh current state for parser (includes DM message)
      const freshCurrentState = {
        ...gameState,
        narrativeHistory: [...gameState.narrativeHistory, playerMessage, dmMessage],
      };

      // Now call Parser LLM to extract state updates
      const parserResponse = await callLLM(
        config.parserLLM,
        [{
          role: 'user',
          content: JSON.stringify({
            narrative: primaryResponse.content,
            currentState: freshCurrentState,
          })
        }],
        config.parserSystemPrompt,
        500,
        config.openRouterApiKey
      );

      // Parse and validate JSON with robust error handling
      let parsedData: any = null;
      let parsingFailed = false;
      try {
        const extracted = extractAndParseJSON(parserResponse.content);
        parsedData = validateAndCoerceParserData(extracted);
      } catch (error: any) {
        // Log the raw response for debugging
        console.error('Failed to parse parser response:', error.message);
        console.debug('Raw parser response:', parserResponse.content);
        
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
        
        if (!parsingFailed && parsedData) {
          const stateUpdates = parsedData.stateUpdates || {};
          
          // Update character basic info
          if (stateUpdates.name !== undefined) {
            updated.character.name = stateUpdates.name;
          }
          if (stateUpdates.class !== undefined) {
            updated.character.class = stateUpdates.class;
          }
          if (stateUpdates.age !== undefined) {
            updated.character.age = stateUpdates.age;
          }
          if (stateUpdates.level !== undefined) {
            updated.character.level = stateUpdates.level;
          }
          
          // Update character stats
          if (stateUpdates.hp !== undefined) {
            updated.character.hp = Math.max(0, Math.min(stateUpdates.hp, prev.character.maxHp));
          }
          if (stateUpdates.gold !== undefined) {
            updated.character.gold = stateUpdates.gold;
          }
          if (stateUpdates.xp !== undefined) {
            updated.character.xp = stateUpdates.xp;
          }
          
          // Update attributes if changed
          if (stateUpdates.attributes !== undefined) {
            updated.character.attributes = { ...updated.character.attributes, ...stateUpdates.attributes };
          }
          
          // Update location
          if (stateUpdates.location !== undefined) {
            updated.location = stateUpdates.location;
          }
          
          // Update status effects
          if (stateUpdates.statusEffects !== undefined) {
            updated.statusEffects = stateUpdates.statusEffects;
          }
          
          // Update inventory
          if (stateUpdates.inventory !== undefined) {
            updated.inventory = stateUpdates.inventory;
          }
          
          // Update spells
          if (stateUpdates.spells !== undefined) {
            updated.spells = stateUpdates.spells;
          }
          
          // Update quests
          if (stateUpdates.quests !== undefined) {
            updated.quests = stateUpdates.quests;
          }
          
          // Update companions
          if (stateUpdates.companions !== undefined) {
            updated.companions = stateUpdates.companions;
          }
          
          // Update encountered characters
          if (stateUpdates.encounteredCharacters !== undefined) {
            updated.encounteredCharacters = stateUpdates.encounteredCharacters;
          }

          // Store parsed recap for future context
          if (parsedData.recap) {
            updated.parsedRecaps = [...updated.parsedRecaps, parsedData.recap];
          }
        }

        updated.turnCount = prev.turnCount + 1;

        return updated;
      });

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
        }));
      }

      setActionInput('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process action',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = () => {
    processAction(actionInput);
  };

  const handleQuickAction = (actionId: string) => {
    const templates: Record<string, string> = {
      investigate: 'I carefully examine my surroundings, looking for clues or anything unusual.',
      talk: 'I approach and try to start a conversation.',
      attack: 'I ready my weapon and prepare to attack.',
      use: 'I search through my inventory for something useful.',
    };
    
    processAction(templates[actionId] || actionId);
  };

  return (
    <main className="lg:col-span-6 flex flex-col space-y-4">
      {/* Narrative Display */}
      <div className="flex-1 bg-card border-2 border-border rounded-lg ornate-border parchment-texture overflow-hidden flex flex-col min-h-[400px]">
        <div className="bg-gradient-to-b from-primary/20 to-transparent p-4 border-b border-border">
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
          {gameState.narrativeHistory.length === 0 ? (
            <div className="bg-muted/20 border-l-4 border-primary rounded-r-lg p-4 fade-in">
              <p className="text-foreground leading-relaxed">
                Your adventure begins here. What will you do?
              </p>
            </div>
          ) : (
            gameState.narrativeHistory.map((message) => (
              <div 
                key={message.id} 
                className={`fade-in ${message.type === 'player' ? 'flex justify-end' : ''}`}
                data-testid={`message-${message.type}-${message.id}`}
              >
                {message.type === 'dm' ? (
                  <div className="bg-muted/20 border-l-4 border-primary rounded-r-lg p-4">
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap">{message.content}</p>
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
            ))
          )}
        </div>
      </div>

      {/* Action Input */}
      <div className="bg-card border-2 border-border rounded-lg ornate-border parchment-texture p-4">
        <h3 className="text-sm font-serif font-semibold text-primary mb-3">What do you do?</h3>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {QUICK_ACTIONS.map(action => {
            const Icon = action.icon;
            return (
              <Button
                key={action.id}
                onClick={() => handleQuickAction(action.id)}
                disabled={isProcessing}
                variant="outline"
                className="bg-muted hover:bg-muted/80 border-border hover:border-primary justify-start h-auto py-3"
                data-testid={`button-quick-${action.id}`}
              >
                <Icon className="w-5 h-5 mr-2" />
                <div className="text-left">
                  <div className="text-sm font-medium">{action.label}</div>
                  <div className="text-xs text-muted-foreground">{action.description}</div>
                </div>
              </Button>
            );
          })}
        </div>

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
            <div className="w-2 h-2 bg-accent rounded-full pulse-effect" />
            <span className="text-muted-foreground">Primary:</span>
            <span className="font-mono text-foreground" data-testid="text-primary-model">
              {config.primaryLLM.split('/').pop()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-accent rounded-full pulse-effect" />
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
