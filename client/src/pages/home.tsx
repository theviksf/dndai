import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { fetchOpenRouterModels } from '@/lib/openrouter';
import { createDefaultGameState, createDefaultConfig, createDefaultCostTracker, migrateParserPrompt, migrateConfig, migrateCostTracker } from '@/lib/game-state';
import { getSessionIdFromUrl, setSessionIdInUrl, getSessionStorageKey, generateSessionId, buildSessionUrl } from '@/lib/session';
import type { GameStateData, GameConfig, CostTracker, OpenRouterModel, TurnSnapshot } from '@shared/schema';
import CharacterStatsBar from '@/components/character-stats-bar';
import NarrativePanel from '@/components/narrative-panel';
import GameInfoTabs from '@/components/game-info-tabs';
import DebugLogViewer from '@/components/debug-log-viewer';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Settings, Save, Terminal, Undo2, Download, Upload, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateEntityImage } from '@/lib/image-generation';

export default function Home() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [gameId, setGameId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>(() => getSessionIdFromUrl() || '');
  const [isNewSession, setIsNewSession] = useState(false);
  
  // Ensure session ID exists in URL
  useEffect(() => {
    const urlSessionId = getSessionIdFromUrl();
    if (!urlSessionId) {
      const newSessionId = generateSessionId();
      setSessionIdInUrl(newSessionId);
      setSessionId(newSessionId);
    } else if (urlSessionId !== sessionId) {
      setSessionId(urlSessionId);
    }
  }, []);
  
  const [gameState, setGameState] = useState<GameStateData>(() => {
    const defaultState = createDefaultGameState();
    const initialSessionId = getSessionIdFromUrl() || generateSessionId();
    // Load character from session-scoped localStorage if exists
    const savedCharacter = localStorage.getItem(getSessionStorageKey('gameCharacter', initialSessionId));
    if (savedCharacter) {
      const loadedCharacter = JSON.parse(savedCharacter);
      // Ensure AC exists in attributes for old saves
      // Ensure sex exists for old saves
      defaultState.character = {
        ...loadedCharacter,
        sex: loadedCharacter.sex || '',
        attributes: {
          str: 10,
          dex: 10,
          con: 10,
          int: 10,
          wis: 10,
          cha: 10,
          ac: 10,
          ...loadedCharacter.attributes,
        }
      };
    }
    // Migrate companions and NPCs to add sex field for old saves
    if (defaultState.companions) {
      defaultState.companions = defaultState.companions.map(c => ({
        ...c,
        sex: c.sex || ''
      }));
    }
    if (defaultState.encounteredCharacters) {
      defaultState.encounteredCharacters = defaultState.encounteredCharacters.map(c => ({
        ...c,
        sex: c.sex || ''
      }));
    }
    // Migrate updatedTabs from Set (which becomes {}) to array
    if (defaultState.updatedTabs && !Array.isArray(defaultState.updatedTabs)) {
      defaultState.updatedTabs = [];
    }
    // Migrate previousLocations from string[] to PreviousLocation[]
    if (defaultState.previousLocations && defaultState.previousLocations.length > 0) {
      const firstLoc = defaultState.previousLocations[0];
      if (typeof firstLoc === 'string') {
        defaultState.previousLocations = (defaultState.previousLocations as any).map((locName: string, index: number) => ({
          id: `loc-migrated-${index}`,
          name: locName,
          description: '',
          lastVisited: Date.now() - (index * 60000), // Stagger times by 1 minute each
        }));
      }
    }
    return defaultState;
  });
  const [config, setConfig] = useState<GameConfig>(() => {
    const initialSessionId = getSessionIdFromUrl() || generateSessionId();
    // Load config from session-scoped localStorage
    const savedConfig = localStorage.getItem(getSessionStorageKey('gameConfig', initialSessionId));
    if (!savedConfig) {
      setIsNewSession(true);
      return createDefaultConfig();
    }
    const loadedConfig = JSON.parse(savedConfig);
    const migratedConfig = migrateConfig(loadedConfig);
    return migrateParserPrompt(migratedConfig);
  });
  const [costTracker, setCostTracker] = useState<CostTracker>(createDefaultCostTracker());

  // Fetch default prompts from .md files for new sessions
  const { data: defaultPrompts } = useQuery({
    queryKey: ['/api/prompts/defaults'],
    queryFn: async () => {
      const response = await fetch('/api/prompts/defaults');
      if (!response.ok) throw new Error('Failed to fetch default prompts');
      return response.json();
    },
    enabled: isNewSession,
  });

  // Update config with prompts from .md files when they're loaded for new sessions
  useEffect(() => {
    if (isNewSession && defaultPrompts) {
      setConfig(prev => ({
        ...prev,
        dmSystemPrompt: defaultPrompts.primary,
        parserSystemPrompt: defaultPrompts.parser,
        characterImagePrompt: defaultPrompts.imageCharacter,
        locationImagePrompt: defaultPrompts.imageLocation,
      }));
      setIsNewSession(false);
    }
  }, [isNewSession, defaultPrompts]);
  const [isGameStarted, setIsGameStarted] = useState(() => {
    const initialSessionId = getSessionIdFromUrl() || generateSessionId();
    return localStorage.getItem(getSessionStorageKey('isGameStarted', initialSessionId)) === 'true';
  });
  const [isDebugLogOpen, setIsDebugLogOpen] = useState(false);
  const [turnSnapshots, setTurnSnapshots] = useState<TurnSnapshot[]>(() => {
    const initialSessionId = getSessionIdFromUrl() || generateSessionId();
    const savedSnapshots = localStorage.getItem(getSessionStorageKey('turnSnapshots', initialSessionId));
    return savedSnapshots ? JSON.parse(savedSnapshots) : [];
  });
  const [showExportDialog, setShowExportDialog] = useState(false);
  const fileInputRef = useState<HTMLInputElement | null>(null)[0];

  // Fetch OpenRouter models (always enabled - backend will use fallback key if needed)
  const { data: models, refetch: refetchModels } = useQuery<OpenRouterModel[]>({
    queryKey: ['/api/models', config.openRouterApiKey],
    queryFn: () => fetchOpenRouterModels(config.openRouterApiKey),
  });

  // Save game mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!gameId) {
        const response = await apiRequest('POST', '/api/game', {
          state: gameState,
          config,
          costTracker,
        });
        const data = await response.json();
        setGameId(data.id);
        return data;
      } else {
        const response = await apiRequest('PATCH', `/api/game/${gameId}`, {
          state: gameState,
          config,
          costTracker,
        });
        return await response.json();
      }
    },
    onSuccess: () => {
      toast({
        title: 'Game Saved',
        description: 'Your progress has been saved successfully.',
      });
    },
  });

  // Show settings/character creation on first load based on state
  useEffect(() => {
    if (!gameState.character.name) {
      // No character exists - go to character creation
      setLocation('/character-creation');
    } else if (!config.openRouterApiKey && !isGameStarted) {
      // Character exists but no API key and game not started yet - go to settings
      setLocation('/settings');
    }
    // If character exists and game is started, stay on home page even without API key
    // (player will get error when trying to take action)
  }, []);

  // Reload config and character when page is visible again (returning from other pages)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const savedConfig = localStorage.getItem(getSessionStorageKey('gameConfig', sessionId));
        const savedCharacter = localStorage.getItem(getSessionStorageKey('gameCharacter', sessionId));
        const gameStarted = localStorage.getItem(getSessionStorageKey('isGameStarted', sessionId));
        
        if (savedConfig) {
          const loadedConfig = JSON.parse(savedConfig);
          setConfig(migrateParserPrompt(loadedConfig));
        }
        if (savedCharacter) {
          const loadedCharacter = JSON.parse(savedCharacter);
          setGameState(prev => ({
            ...prev,
            character: {
              ...loadedCharacter,
              sex: loadedCharacter.sex || '',
              attributes: {
                str: 10,
                dex: 10,
                con: 10,
                int: 10,
                wis: 10,
                cha: 10,
                ac: 10,
                ...loadedCharacter.attributes,
              }
            },
            previousLocations: prev.previousLocations || [],
            // Migrate companions and NPCs for old saves
            companions: (prev.companions || []).map(c => ({ ...c, sex: c.sex || '' })),
            encounteredCharacters: (prev.encounteredCharacters || []).map(c => ({ ...c, sex: c.sex || '' }))
          }));
        }
        if (gameStarted === 'true') {
          setIsGameStarted(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleSaveGame = () => {
    saveMutation.mutate();
  };

  const handleNewGame = () => {
    // Generate new session ID and force full page reload to reset all state
    const newSessionId = generateSessionId();
    window.location.href = buildSessionUrl('/', newSessionId);
  };

  const updateGameState = (updates: Partial<GameStateData>) => {
    setGameState(prev => {
      const newState = {
        ...prev,
        ...updates,
        character: updates.character ? { ...prev.character, ...updates.character } : prev.character,
      };
      
      // Track location changes - add old location to previousLocations if location changed
      if (updates.location && updates.location.name && updates.location.name !== prev.location.name) {
        const oldLocationName = prev.location.name;
        const oldLocationDesc = prev.location.description;
        const prevLocations = prev.previousLocations || [];
        
        // Check if location already exists by name
        const existingLoc = prevLocations.find((loc: any) => 
          typeof loc === 'string' ? loc === oldLocationName : loc.name === oldLocationName
        );
        
        if (oldLocationName && !existingLoc) {
          const newPrevLocation = {
            id: `loc-${Date.now()}`,
            name: oldLocationName,
            description: oldLocationDesc || '',
            imageUrl: prev.location.imageUrl,
            lastVisited: Date.now(),
          };
          newState.previousLocations = [...prevLocations, newPrevLocation];
        } else {
          newState.previousLocations = prevLocations;
        }
      } else if (!newState.previousLocations) {
        newState.previousLocations = [];
      }
      
      return newState;
    });
    
    if (updates.character) {
      localStorage.setItem(getSessionStorageKey('gameCharacter', sessionId), JSON.stringify({
        ...gameState.character,
        ...updates.character,
      }));
    }
  };

  const refreshEntityImage = async (
    entityType: 'character' | 'companion' | 'npc' | 'location' | 'business',
    entityId?: string
  ) => {
    try {
      let entity: any;
      
      if (entityType === 'character') {
        entity = gameState.character;
      } else if (entityType === 'companion') {
        entity = gameState.companions?.find(c => c.id === entityId);
      } else if (entityType === 'npc') {
        entity = gameState.encounteredCharacters?.find(npc => npc.id === entityId);
      } else if (entityType === 'business') {
        entity = gameState.businesses?.find(b => b.id === entityId);
      } else if (entityType === 'location') {
        if (entityId) {
          entity = gameState.previousLocations?.find(loc => loc.id === entityId) || gameState.location;
        } else {
          entity = gameState.location;
        }
      }

      if (!entity) {
        throw new Error('Entity not found');
      }

      const result = await generateEntityImage({
        entityType,
        entity,
        config,
        sessionId,
      });

      // Update game state with result and debug log
      setGameState(prev => {
        const updated = { ...prev };
        
        if (result.imageUrl) {
          if (entityType === 'character') {
            updated.character = { ...updated.character, imageUrl: result.imageUrl || undefined };
          } else if (entityType === 'companion') {
            updated.companions = updated.companions?.map(c =>
              c.id === entityId ? { ...c, imageUrl: result.imageUrl || undefined } : c
            );
          } else if (entityType === 'npc') {
            updated.encounteredCharacters = updated.encounteredCharacters?.map(npc =>
              npc.id === entityId ? { ...npc, imageUrl: result.imageUrl || undefined } : npc
            );
          } else if (entityType === 'business') {
            updated.businesses = updated.businesses?.map(b =>
              b.id === entityId ? { ...b, imageUrl: result.imageUrl || undefined } : b
            );
          } else if (entityType === 'location') {
            if (entityId) {
              // Update previous location
              updated.previousLocations = updated.previousLocations?.map(loc =>
                loc.id === entityId ? { ...loc, imageUrl: result.imageUrl || undefined } : loc
              );
            } else {
              // Update current location
              updated.location = { ...updated.location, imageUrl: result.imageUrl || undefined };
            }
          }
        }
        
        // Add debug log entry (even if image generation failed)
        if (result.debugLogEntry) {
          updated.debugLog = [...(updated.debugLog || []), result.debugLogEntry];
        }
        
        return updated;
      });

      if (result.imageUrl) {
        // Update cost tracker if usage data is available
        if (result.usage) {
          const imageModel = models?.find(m => m.id === 'google/gemini-2.5-flash-image-preview');
          if (imageModel) {
            const imageCost = 
              (result.usage.prompt_tokens * parseFloat(imageModel.pricing.prompt)) +
              (result.usage.completion_tokens * parseFloat(imageModel.pricing.completion));
            
            setCostTracker(prev => ({
              ...prev,
              imageCost: prev.imageCost + imageCost,
              sessionCost: prev.sessionCost + imageCost,
            }));
          }
        }

        toast({
          title: 'Image Generated',
          description: 'New image has been generated successfully.',
        });
      } else {
        toast({
          title: 'Image Generation Failed',
          description: 'Could not generate image. Check debug logs for details.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Image Generation Failed',
        description: error.message || 'Failed to generate image',
        variant: 'destructive',
      });
    }
  };

  const createSnapshot = () => {
    // Deep copy of game state to ensure nested objects are captured
    // Exclude turnSnapshots from the snapshot to avoid circular reference
    const { turnSnapshots: _, ...stateToSave } = gameState;
    
    // Create a copy without images to save localStorage space
    // (base64 images can be 100KB+ each and quickly exceed quota)
    const stateWithoutImages = JSON.parse(JSON.stringify(stateToSave));
    
    // Remove imageUrl from character
    if (stateWithoutImages.character?.imageUrl) {
      delete stateWithoutImages.character.imageUrl;
    }
    
    // Remove imageUrl from companions
    if (stateWithoutImages.companions) {
      stateWithoutImages.companions = stateWithoutImages.companions.map((c: any) => {
        const { imageUrl, ...rest } = c;
        return rest;
      });
    }
    
    // Remove imageUrl from NPCs
    if (stateWithoutImages.encounteredCharacters) {
      stateWithoutImages.encounteredCharacters = stateWithoutImages.encounteredCharacters.map((npc: any) => {
        const { imageUrl, ...rest } = npc;
        return rest;
      });
    }
    
    // Remove imageUrl from location
    if (stateWithoutImages.location?.imageUrl) {
      delete stateWithoutImages.location.imageUrl;
    }
    
    // Limit debug log to last 30 entries and remove base64 images from image logs
    if (stateWithoutImages.debugLog && Array.isArray(stateWithoutImages.debugLog)) {
      stateWithoutImages.debugLog = stateWithoutImages.debugLog
        .slice(-30)
        .map((log: any) => {
          // For image logs, remove the base64 data from imageUrl to save space
          if (log.type === 'image' && log.imageUrl?.startsWith('data:image')) {
            return {
              ...log,
              imageUrl: '[base64 image removed from snapshot]'
            };
          }
          return log;
        });
    }
    
    const snapshot: TurnSnapshot = {
      state: stateWithoutImages,
      costTracker: JSON.parse(JSON.stringify(costTracker)),
      timestamp: Date.now(),
    };
    
    setTurnSnapshots(prev => {
      // Keep only the last 10 snapshots to prevent unbounded growth
      const newSnapshots = [...prev, snapshot].slice(-10);
      
      try {
        localStorage.setItem(getSessionStorageKey('turnSnapshots', sessionId), JSON.stringify(newSnapshots));
      } catch (e: any) {
        if (e.name === 'QuotaExceededError') {
          console.warn('localStorage quota exceeded, clearing old snapshots');
          // If quota exceeded, keep only the last 3 snapshots and try again
          const minimalSnapshots = newSnapshots.slice(-3);
          try {
            localStorage.setItem(getSessionStorageKey('turnSnapshots', sessionId), JSON.stringify(minimalSnapshots));
            return minimalSnapshots;
          } catch (e2) {
            // If still failing, clear all snapshots and continue without undo
            console.error('Failed to save snapshots even after cleanup, disabling undo');
            localStorage.removeItem(getSessionStorageKey('turnSnapshots', sessionId));
            return [];
          }
        }
        console.error('Error saving snapshots:', e);
      }
      
      return newSnapshots;
    });
  };

  const handleUndo = () => {
    if (turnSnapshots.length === 0) {
      toast({
        title: "Nothing to undo",
        description: "No previous turns to restore",
        variant: "default",
      });
      return;
    }

    // Pop the latest snapshot
    const latestSnapshot = turnSnapshots[turnSnapshots.length - 1];
    const remainingSnapshots = turnSnapshots.slice(0, -1);

    // Restore state from snapshot (add back turnSnapshots field)
    const restoredState = {
      ...latestSnapshot.state,
      turnSnapshots: [],  // Will be managed by setTurnSnapshots below
    };
    
    // Migrate updatedTabs from Set (which becomes {}) to array
    if (restoredState.updatedTabs && !Array.isArray(restoredState.updatedTabs)) {
      restoredState.updatedTabs = [];
    }
    
    setGameState(restoredState);

    // Restore cost tracker (with migration for backwards compatibility)
    setCostTracker(migrateCostTracker(latestSnapshot.costTracker));

    // Update snapshots array
    setTurnSnapshots(remainingSnapshots);

    // Update session-scoped localStorage with restored data
    localStorage.setItem(getSessionStorageKey('gameCharacter', sessionId), JSON.stringify(restoredState.character));
    localStorage.setItem(getSessionStorageKey('turnSnapshots', sessionId), JSON.stringify(remainingSnapshots));

    toast({
      title: "Turn undone",
      description: "Restored to previous state",
    });
  };

  const handleExport = (includeApiKey: boolean) => {
    try {
      // Deep clone all game data to prevent mutation leaks
      const exportData = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        gameState: JSON.parse(JSON.stringify(gameState)),
        config: includeApiKey ? JSON.parse(JSON.stringify(config)) : { ...JSON.parse(JSON.stringify(config)), openRouterApiKey: '' },
        costTracker: JSON.parse(JSON.stringify(costTracker)),
        turnSnapshots: JSON.parse(JSON.stringify(turnSnapshots)),
      };

      // Convert to JSON
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // Generate filename: CharName-Level-Date-Time.ogl
      const charName = gameState.character.name || 'Character';
      const level = gameState.character.level || 1;
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
      const filename = `${charName}-L${level}-${dateStr}-${timeStr}.ogl`;
      
      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Game Exported",
        description: `Save file downloaded as ${filename}`,
      });
      
      setShowExportDialog(false);
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export game data",
        variant: "destructive",
      });
    }
  };

  // Helper function to migrate game state data with deep merging
  const migrateGameState = (stateData: any): GameStateData => {
    const defaultState = createDefaultGameState();
    
    return {
      ...defaultState,
      ...stateData,
      // Deep merge character with defaults
      character: {
        ...defaultState.character,
        ...stateData.character,
        attributes: {
          str: 10,
          dex: 10,
          con: 10,
          int: 10,
          wis: 10,
          cha: 10,
          ac: 10,
          ...stateData.character?.attributes,
        }
      },
      // Deep merge location with defaults
      location: {
        ...defaultState.location,
        ...stateData.location,
      },
      // Ensure all arrays exist with defaults
      previousLocations: stateData.previousLocations || [],
      inventory: stateData.inventory || [],
      quests: stateData.quests || [],
      spells: stateData.spells || [],
      companions: stateData.companions || [],
      encounteredCharacters: stateData.encounteredCharacters || [],
      businesses: stateData.businesses || [],
      statusEffects: stateData.statusEffects || [],
      narrativeHistory: stateData.narrativeHistory || [],
      parsedRecaps: stateData.parsedRecaps || [],
      debugLog: stateData.debugLog || [],
      updatedTabs: Array.isArray(stateData.updatedTabs) ? stateData.updatedTabs : [],
      // Explicitly exclude turnSnapshots field from imported state (managed separately)
      turnSnapshots: [],
    };
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ogl,.json';
    input.onchange = async (e: any) => {
      try {
        const file = e.target.files[0];
        if (!file) return;
        
        const text = await file.text();
        const importData = JSON.parse(text);
        
        // Validate import data
        if (!importData.gameState || !importData.config) {
          throw new Error('Invalid save file format');
        }
        
        // Migrate main game state
        const migratedState = migrateGameState(importData.gameState);
        
        // Migrate config (parser prompt migration)
        const migratedConfig = migrateParserPrompt(importData.config);
        
        // Migrate cost tracker
        const migratedCostTracker = importData.costTracker 
          ? migrateCostTracker(importData.costTracker)
          : createDefaultCostTracker();
        
        // Migrate turn snapshots - migrate BOTH state and costTracker in each snapshot
        const migratedSnapshots = (importData.turnSnapshots || []).map((snapshot: TurnSnapshot) => ({
          ...snapshot,
          state: migrateGameState(snapshot.state),
          costTracker: migrateCostTracker(snapshot.costTracker),
        }));
        
        // Restore all data with migrations applied
        setGameState(migratedState);
        setConfig(migratedConfig);
        setCostTracker(migratedCostTracker);
        setTurnSnapshots(migratedSnapshots);
        
        // Update session-scoped localStorage with migrated data
        localStorage.setItem(getSessionStorageKey('gameCharacter', sessionId), JSON.stringify(migratedState.character));
        localStorage.setItem(getSessionStorageKey('gameConfig', sessionId), JSON.stringify(migratedConfig));
        localStorage.setItem(getSessionStorageKey('turnSnapshots', sessionId), JSON.stringify(migratedSnapshots));
        localStorage.setItem(getSessionStorageKey('isGameStarted', sessionId), 'true');
        setIsGameStarted(true);
        
        toast({
          title: "Game Loaded",
          description: `Successfully imported ${file.name}`,
        });
      } catch (error: any) {
        toast({
          title: "Import Failed",
          description: error.message || "Failed to load save file",
          variant: "destructive",
        });
      }
    };
    input.click();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card border-b-2 border-border parchment-texture sticky top-0 z-40">
        <div className="max-w-[1920px] mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-primary">D&D Adventure</h1>
              <span className="hidden md:inline-block text-xs text-muted-foreground border-l border-border pl-4">
                Powered by OpenRouter
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Cost Tracker */}
              <HoverCard>
                <HoverCardTrigger asChild>
                  <div className="hidden md:flex items-center gap-2 bg-accent/10 border border-accent rounded-md px-4 py-2 cursor-pointer hover:bg-accent/20 transition-colors">
                    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm">
                      <span className="font-mono font-semibold text-accent">${costTracker.sessionCost.toFixed(4)}</span>
                      <span className="text-muted-foreground text-xs ml-1">
                        ({costTracker.turnCount} turns)
                      </span>
                    </div>
                  </div>
                </HoverCardTrigger>
                <HoverCardContent className="w-80 bg-card/95 backdrop-blur-sm" align="end">
                  <div className="space-y-4">
                    {/* This Turn */}
                    <div>
                      <h4 className="text-sm font-semibold text-primary mb-2 border-b border-border pb-1">This Turn</h4>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Input Tokens (Primary):</span>
                          <span className="font-mono text-foreground">{costTracker.lastTurnPrimaryTokens.prompt.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Output Tokens (Primary):</span>
                          <span className="font-mono text-foreground">{costTracker.lastTurnPrimaryTokens.completion.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cost:</span>
                          <span className="font-mono text-foreground">${costTracker.lastTurnPrimaryCost.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between pt-1">
                          <span className="text-muted-foreground">Input Tokens (Parser):</span>
                          <span className="font-mono text-foreground">{costTracker.lastTurnParserTokens.prompt.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Output Tokens (Parser):</span>
                          <span className="font-mono text-foreground">{costTracker.lastTurnParserTokens.completion.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cost:</span>
                          <span className="font-mono text-foreground">${costTracker.lastTurnParserCost.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-border/50">
                          <span className="text-muted-foreground font-semibold">Cost Total:</span>
                          <span className="font-mono text-accent font-semibold">${costTracker.lastTurnCost.toFixed(4)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Total */}
                    <div>
                      <h4 className="text-sm font-semibold text-primary mb-2 border-b border-border pb-1">Total (Session)</h4>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Input Tokens (Primary):</span>
                          <span className="font-mono text-foreground">{costTracker.primaryTokens.prompt.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Output Tokens (Primary):</span>
                          <span className="font-mono text-foreground">{costTracker.primaryTokens.completion.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cost:</span>
                          <span className="font-mono text-foreground">${costTracker.primaryCost.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between pt-1">
                          <span className="text-muted-foreground">Input Tokens (Parser):</span>
                          <span className="font-mono text-foreground">{costTracker.parserTokens.prompt.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Output Tokens (Parser):</span>
                          <span className="font-mono text-foreground">{costTracker.parserTokens.completion.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cost:</span>
                          <span className="font-mono text-foreground">${costTracker.parserCost.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between pt-1">
                          <span className="text-muted-foreground">Image Generation:</span>
                          <span className="font-mono text-foreground">${(costTracker.imageCost || 0).toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-border/50">
                          <span className="text-muted-foreground font-semibold">Cost Total:</span>
                          <span className="font-mono text-accent font-semibold">${costTracker.sessionCost.toFixed(4)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
              
              {/* Game Actions */}
              <Button
                onClick={handleUndo}
                disabled={turnSnapshots.length === 0}
                variant="outline"
                className="bg-muted hover:bg-muted/80"
                data-testid="button-undo"
              >
                <Undo2 className="w-4 h-4 mr-2" />
                <span className="hidden md:inline">Undo</span>
              </Button>
              
              <Button
                onClick={handleSaveGame}
                disabled={saveMutation.isPending}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
                data-testid="button-save-game"
              >
                <Save className="w-4 h-4 mr-2" />
                <span className="hidden md:inline">Save</span>
              </Button>
              
              <Button
                onClick={handleNewGame}
                variant="outline"
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                data-testid="button-new-game"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                <span className="hidden md:inline">New Game</span>
              </Button>
              
              <Button
                onClick={() => setShowExportDialog(true)}
                variant="outline"
                className="bg-muted hover:bg-muted/80"
                data-testid="button-export-game"
              >
                <Download className="w-4 h-4 mr-2" />
                <span className="hidden md:inline">Export</span>
              </Button>
              
              <Button
                onClick={handleImport}
                variant="outline"
                className="bg-muted hover:bg-muted/80"
                data-testid="button-import-game"
              >
                <Upload className="w-4 h-4 mr-2" />
                <span className="hidden md:inline">Import</span>
              </Button>
              
              <Button
                onClick={() => setIsDebugLogOpen(true)}
                variant="outline"
                className="bg-muted hover:bg-muted/80"
                data-testid="button-view-log"
              >
                <Terminal className="w-4 h-4 mr-2" />
                <span className="hidden md:inline">View Log</span>
              </Button>
              
              <Button
                onClick={() => setLocation(`/settings?session=${sessionId}`)}
                variant="outline"
                className="bg-muted hover:bg-muted/80"
                data-testid="button-settings"
              >
                <Settings className="w-4 h-4 mr-2" />
                <span className="hidden md:inline">Settings</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Character Stats Bar */}
      <CharacterStatsBar 
        character={gameState.character}
        statusEffects={gameState.statusEffects}
        location={gameState.location}
        turnCount={gameState.turnCount}
        businesses={gameState.businesses || []}
        onUpdate={updateGameState}
        onRefreshImage={refreshEntityImage}
      />

      {/* Main Content */}
      <div className="flex-1 max-w-[1920px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 h-full">
          <div className="lg:col-span-7">
            <NarrativePanel 
              gameState={gameState}
              setGameState={setGameState}
              config={config}
              costTracker={costTracker}
              setCostTracker={setCostTracker}
              models={models || []}
              createSnapshot={createSnapshot}
              sessionId={sessionId}
            />
          </div>
          <div className="lg:col-span-5">
            <GameInfoTabs 
              inventory={gameState.inventory} 
              quests={gameState.quests} 
              spells={gameState.spells || []}
              companions={gameState.companions || []} 
              encounteredCharacters={gameState.encounteredCharacters || []} 
              businesses={gameState.businesses || []}
              history={gameState.parsedRecaps || []} 
              previousLocations={gameState.previousLocations || []}
              updatedTabs={gameState.updatedTabs}
              onUpdate={updateGameState}
              onTabChange={(tabId) => {
                setGameState(prev => ({
                  ...prev,
                  updatedTabs: (prev.updatedTabs || []).filter(tab => tab !== tabId)
                }));
              }}
              onRefreshImage={refreshEntityImage}
            />
          </div>
        </div>
      </div>

      {/* Debug Log Viewer */}
      <DebugLogViewer
        debugLog={gameState.debugLog || []}
        isOpen={isDebugLogOpen}
        onClose={() => setIsDebugLogOpen(false)}
      />

      {/* Export Dialog */}
      <AlertDialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export Game Save</AlertDialogTitle>
            <AlertDialogDescription>
              Your game will be exported as a .ogl file containing all game data, including character stats, inventory, quests, companions, conversation history, and settings.
              <br /><br />
              Would you like to include your OpenRouter API key in the export?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => handleExport(false)}
              data-testid="button-export-without-key"
            >
              Export Without API Key
            </Button>
            <AlertDialogAction onClick={() => handleExport(true)} data-testid="button-export-with-key">
              Export With API Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
