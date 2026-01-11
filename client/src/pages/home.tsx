import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { fetchOpenRouterModels } from '@/lib/openrouter';
import { createDefaultGameState, createDefaultConfig, createDefaultCostTracker, migrateConfig, migrateCostTracker } from '@/lib/game-state';
import { getSessionIdFromUrl, setSessionIdInUrl, getSessionStorageKey, generateSessionId, buildSessionUrl } from '@/lib/session';
import type { GameStateData, GameConfig, CostTracker, OpenRouterModel, TurnSnapshot } from '@shared/schema';
import { db, getSessionData, saveSessionData, getStorageEstimate, deleteAllSessions, getAllSessions, type SessionData } from '@/lib/db';
import CharacterStatsBar from '@/components/character-stats-bar';
import NarrativePanel from '@/components/narrative-panel';
import DebugLogViewer from '@/components/debug-log-viewer';
import { IconRail, type PanelKey } from '@/components/icon-rail';
import { InfoDrawer } from '@/components/info-drawer';
import { EntityDetailSheet } from '@/components/entity-detail-sheet';
import type { Companion, EncounteredCharacter, PreviousLocation, Business, Quest } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Settings, Save, Terminal, Undo2, Download, Upload, PlusCircle, MoreVertical, Menu, Database, Trash2, FolderOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateEntityImage } from '@/lib/image-generation';

// Helper to get or create session ID
function getOrCreateSessionId(): string {
  const urlSessionId = getSessionIdFromUrl();
  if (!urlSessionId) {
    const newSessionId = generateSessionId();
    setSessionIdInUrl(newSessionId);
    return newSessionId;
  }
  return urlSessionId;
}

export default function Home() {
  const { toast} = useToast();
  const [, setLocation] = useLocation();
  const [gameId, setGameId] = useState<string | null>(null);
  // Use consistent session ID across all initializers
  const [sessionId] = useState<string>(getOrCreateSessionId);
  const [isNewSession, setIsNewSession] = useState(false);
  
  // Ref to always have latest gameState (avoids stale closures)
  const gameStateRef = useRef<GameStateData | null>(null);
  
  // Debounce timer ref for save operations
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize with defaults - will load from DB asynchronously
  const [gameState, setGameState] = useState<GameStateData>(createDefaultGameState);
  const [config, setConfig] = useState<GameConfig>(createDefaultConfig);
  const [costTracker, setCostTracker] = useState<CostTracker>(createDefaultCostTracker);
  const [dbLoaded, setDbLoaded] = useState(false);
  
  // Load Game dialog state
  const [isLoadGameOpen, setIsLoadGameOpen] = useState(false);
  const [savedSessions, setSavedSessions] = useState<SessionData[]>([]);
  
  // New UI state - icon rail and drawer
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);
  const [detailEntity, setDetailEntity] = useState<Companion | EncounteredCharacter | PreviousLocation | Business | Quest | null>(null);
  const [detailEntityType, setDetailEntityType] = useState<'companion' | 'npc' | 'location' | 'business' | 'quest'>('companion');
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [isRefreshingImage, setIsRefreshingImage] = useState(false);

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
      const newConfig = {
        ...config,
        dmSystemPrompt: defaultPrompts.primary,
        parserSystemPrompt: defaultPrompts.parser,
        characterImagePrompt: defaultPrompts.imageCharacter,
        locationImagePrompt: defaultPrompts.imageLocation,
        backstorySystemPrompt: defaultPrompts.backstory,
        revelationsSystemPrompt: defaultPrompts.revelations,
        loreSystemPrompt: defaultPrompts.lore,
        checkerSystemPrompt: defaultPrompts.checker,
      };
      setConfig(newConfig);
      setIsNewSession(false);
    }
  }, [isNewSession, defaultPrompts, config]);

  // Apply UI scale based on config
  useEffect(() => {
    const scale = config.uiScale === 'compact' ? '80%' : '100%';
    document.documentElement.style.fontSize = scale;
    
    // Cleanup function to reset on unmount
    return () => {
      document.documentElement.style.fontSize = '';
    };
  }, [config.uiScale]);

  // Load data from IndexedDB on mount, with automatic localStorage migration
  useEffect(() => {
    const loadFromDB = async () => {
      try {
        console.log('[DB] Loading from IndexedDB for session:', sessionId);
        
        // Try to load from IndexedDB first
        const sessionData = await getSessionData(sessionId);
        
        if (sessionData) {
          console.log('[DB] Found data in IndexedDB');
          // Apply migrations to loaded data
          const migratedState = sessionData.gameState;
          if (migratedState.character) {
            migratedState.character.sex = migratedState.character.sex || '';
            migratedState.character.attributes = {
              str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ac: 10,
              ...migratedState.character.attributes,
            };
          }
          if (migratedState.companions) {
            migratedState.companions = migratedState.companions.map((c: any) => ({ ...c, sex: c.sex || '' }));
          }
          if (migratedState.encounteredCharacters) {
            migratedState.encounteredCharacters = migratedState.encounteredCharacters.map((c: any) => ({ ...c, sex: c.sex || '' }));
          }
          if (!Array.isArray(migratedState.updatedTabs)) {
            migratedState.updatedTabs = [];
          }
          if (!migratedState.debugLog) {
            migratedState.debugLog = [];
          }
          
          // Clean up any base64 images from debug logs (initial load cleanup)
          if (migratedState.debugLog && Array.isArray(migratedState.debugLog)) {
            let hadBase64 = false;
            migratedState.debugLog = migratedState.debugLog.map((log: any) => {
              if (log.imageUrl && typeof log.imageUrl === 'string' && log.imageUrl.startsWith('data:image')) {
                hadBase64 = true;
                return { ...log, imageUrl: null };
              }
              if (log.response && typeof log.response === 'string' && log.response.includes('data:image')) {
                hadBase64 = true;
                return { ...log, response: log.response.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '[Base64 image data removed]') };
              }
              return log;
            });
            if (hadBase64) {
              console.log('[DB] Cleaned up base64 images from debug logs on initial load');
            }
          }
          
          // Set turnSnapshots both in state and in gameState
          const snapshotsFromDB = sessionData.turnSnapshots || [];
          migratedState.turnSnapshots = snapshotsFromDB;
          
          setGameState(migratedState);
          const migratedConfig = await migrateConfig(sessionData.gameConfig);
          setConfig(migratedConfig);
          setCostTracker(sessionData.costTracker || createDefaultCostTracker());
          setTurnSnapshots(snapshotsFromDB);
          setIsGameStarted(sessionData.isGameStarted);
          setDbLoaded(true);
        } else {
          // Migrate from localStorage if IndexedDB is empty
          console.log('[DB] No IndexedDB data, checking localStorage for migration');
          const savedGameState = localStorage.getItem(getSessionStorageKey('gameState', sessionId));
          const savedConfig = localStorage.getItem(getSessionStorageKey('gameConfig', sessionId));
          const savedSnapshots = localStorage.getItem(getSessionStorageKey('turnSnapshots', sessionId));
          const savedGameStarted = localStorage.getItem(getSessionStorageKey('isGameStarted', sessionId));
          
          if (savedGameState || savedConfig) {
            console.log('[DB] Migrating data from localStorage to IndexedDB');
            let migratedState = createDefaultGameState();
            let migratedConfig = createDefaultConfig();
            let migratedSnapshots: TurnSnapshot[] = [];
            let migratedGameStarted = false;
            
            if (savedGameState) {
              try {
                const loadedState = JSON.parse(savedGameState);
                if (loadedState.character) {
                  loadedState.character.sex = loadedState.character.sex || '';
                  loadedState.character.attributes = {
                    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ac: 10,
                    ...loadedState.character.attributes,
                  };
                }
                if (loadedState.companions) {
                  loadedState.companions = loadedState.companions.map((c: any) => ({ ...c, sex: c.sex || '' }));
                }
                if (loadedState.encounteredCharacters) {
                  loadedState.encounteredCharacters = loadedState.encounteredCharacters.map((c: any) => ({ ...c, sex: c.sex || '' }));
                }
                if (!Array.isArray(loadedState.updatedTabs)) {
                  loadedState.updatedTabs = [];
                }
                if (!loadedState.debugLog) {
                  loadedState.debugLog = [];
                }
                
                // Clean up any base64 images from debug logs during migration
                if (loadedState.debugLog && Array.isArray(loadedState.debugLog)) {
                  let hadBase64 = false;
                  loadedState.debugLog = loadedState.debugLog.map((log: any) => {
                    if (log.imageUrl && typeof log.imageUrl === 'string' && log.imageUrl.startsWith('data:image')) {
                      hadBase64 = true;
                      return { ...log, imageUrl: null };
                    }
                    if (log.response && typeof log.response === 'string' && log.response.includes('data:image')) {
                      hadBase64 = true;
                      return { ...log, response: log.response.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '[Base64 image data removed]') };
                    }
                    return log;
                  });
                  if (hadBase64) {
                    console.log('[DB] Cleaned up base64 images during localStorage migration');
                  }
                }
                
                migratedState = loadedState;
              } catch (error) {
                console.error('[DB] Failed to parse localStorage gameState:', error);
              }
            }
            
            if (savedConfig) {
              try {
                const parsedConfig = JSON.parse(savedConfig);
                migratedConfig = await migrateConfig(parsedConfig);
              } catch (error) {
                console.error('[DB] Failed to parse localStorage config:', error);
              }
            } else {
              setIsNewSession(true);
            }
            
            if (savedSnapshots) {
              try {
                migratedSnapshots = JSON.parse(savedSnapshots);
              } catch (error) {
                console.error('[DB] Failed to parse localStorage snapshots:', error);
              }
            }
            
            if (savedGameStarted === 'true') {
              migratedGameStarted = true;
            }
            
            // Save migrated data to IndexedDB
            await saveSessionData({
              sessionId,
              gameState: migratedState,
              gameConfig: migratedConfig,
              costTracker: createDefaultCostTracker(),
              turnSnapshots: migratedSnapshots,
              isGameStarted: migratedGameStarted,
              lastUpdated: Date.now(),
            });
            
            setGameState(migratedState);
            setConfig(migratedConfig);
            setTurnSnapshots(migratedSnapshots);
            setIsGameStarted(migratedGameStarted);
            console.log('[DB] Migration complete');
          } else {
            console.log('[DB] No existing data found, starting fresh');
            // For new sessions, still need to load default prompts
            const freshConfig = await migrateConfig(createDefaultConfig());
            setConfig(freshConfig);
            setIsNewSession(true);
          }
          
          setDbLoaded(true);
        }
      } catch (error) {
        console.error('[DB] Error loading from IndexedDB:', error);
        setDbLoaded(true); // Still mark as loaded to not block UI
      }
    };
    
    loadFromDB();
  }, [sessionId]);

  // Keep ref in sync with latest gameState
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Track if we're loading to prevent auto-save during load
  const [isLoadingState, setIsLoadingState] = useState(false);

  // Reload gameState from IndexedDB when returning from other pages (like settings)
  const [location] = useLocation();
  useEffect(() => {
    // Only reload if we're on the home page, have a session ID, and DB is loaded
    if ((location === '/' || location.startsWith('/?session=')) && dbLoaded) {
      const currentSessionId = getSessionIdFromUrl();
      if (currentSessionId) {
        const reloadFromDB = async () => {
          try {
            setIsLoadingState(true);
            const sessionData = await getSessionData(currentSessionId);
            if (sessionData) {
              console.log('[DB] Reloading gameState from IndexedDB');
              const loadedState = sessionData.gameState;
              console.log('[DB] narrativeHistory length:', loadedState.narrativeHistory?.length || 0);
              console.log('[DB] Character imageUrl present:', !!loadedState.character?.imageUrl);
              console.log('[DB] Location imageUrl present:', !!loadedState.location?.imageUrl);
              console.log('[DB] Debug log entries:', loadedState.debugLog?.length || 0);
              console.log('[DB] Companions:', loadedState.companions?.length || 0);
              console.log('[DB] NPCs:', loadedState.encounteredCharacters?.length || 0);
              
              // Apply migrations
              if (loadedState.character) {
                loadedState.character.sex = loadedState.character.sex || '';
                loadedState.character.attributes = {
                  str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ac: 10,
                  ...loadedState.character.attributes,
                };
              }
              if (loadedState.companions) {
                loadedState.companions = loadedState.companions.map((c: any) => ({ ...c, sex: c.sex || '' }));
              }
              if (loadedState.encounteredCharacters) {
                loadedState.encounteredCharacters = loadedState.encounteredCharacters.map((c: any) => ({ ...c, sex: c.sex || '' }));
              }
              if (!Array.isArray(loadedState.updatedTabs)) {
                loadedState.updatedTabs = [];
              }
              if (!loadedState.debugLog) {
                loadedState.debugLog = [];
              }
              
              // Clean up any base64 images from debug logs (one-time cleanup on load)
              if (loadedState.debugLog && Array.isArray(loadedState.debugLog)) {
                let hadBase64 = false;
                loadedState.debugLog = loadedState.debugLog.map((log: any) => {
                  if (log.imageUrl && typeof log.imageUrl === 'string' && log.imageUrl.startsWith('data:image')) {
                    hadBase64 = true;
                    return { ...log, imageUrl: null };
                  }
                  if (log.response && typeof log.response === 'string' && log.response.includes('data:image')) {
                    hadBase64 = true;
                    return { ...log, response: log.response.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '[Base64 image data removed]') };
                  }
                  return log;
                });
                if (hadBase64) {
                  console.log('[DB] Cleaned up base64 images from debug logs on load');
                }
              }
              
              setGameState(loadedState);
              setConfig(sessionData.gameConfig);
              setCostTracker(sessionData.costTracker || createDefaultCostTracker());
            }
            setTimeout(() => setIsLoadingState(false), 50);
          } catch (error) {
            console.error('[DB] Failed to reload from IndexedDB:', error);
            setIsLoadingState(false);
          }
        };
        
        reloadFromDB();
      }
    }
  }, [location, dbLoaded]);

  // Auto-save conversation history and debug logs whenever they change (but not during load)
  useEffect(() => {
    if (!isLoadingState && (gameState.narrativeHistory.length > 0 || (gameState.debugLog && gameState.debugLog.length > 0))) {
      console.log('[HOME] Auto-saving game state');
      console.log('[HOME] - narrativeHistory length:', gameState.narrativeHistory.length);
      console.log('[HOME] - debugLog length:', gameState.debugLog?.length || 0);
      saveGameStateToStorage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.narrativeHistory, gameState.debugLog, isLoadingState]);

  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isDebugLogOpen, setIsDebugLogOpen] = useState(false);
  const [turnSnapshots, setTurnSnapshots] = useState<TurnSnapshot[]>([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showSnapshotDialog, setShowSnapshotDialog] = useState(false);
  const fileInputRef = useState<HTMLInputElement | null>(null)[0];

  // Fetch OpenRouter models (always enabled - backend will use fallback key if needed)
  const { data: models, refetch: refetchModels } = useQuery<OpenRouterModel[]>({
    queryKey: ['/api/models', config.openRouterApiKey],
    queryFn: () => fetchOpenRouterModels(config.openRouterApiKey),
  });

  // Calculate badges for icon rail
  const badges = useMemo<Record<PanelKey, boolean>>(() => {
    const updatedTabs = gameState.updatedTabs || [];
    return {
      inventory: updatedTabs.includes('inventory'),
      spells: updatedTabs.includes('spells'),
      locations: updatedTabs.includes('locations'),
      businesses: updatedTabs.includes('businesses'),
      quests: updatedTabs.includes('quests'),
      companions: updatedTabs.includes('companions'),
      npcs: updatedTabs.includes('encounters'),
      history: updatedTabs.includes('history'),
    };
  }, [gameState.updatedTabs]);

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

  //Check for active session from IndexedDB
  const [hasActiveSession, setHasActiveSession] = useState<boolean | null>(null);
  
  useEffect(() => {
    const checkSession = async () => {
      const sessionData = await getSessionData(sessionId);
      setHasActiveSession(!!sessionData);
    };
    checkSession();
  }, [sessionId]);
  
  // Show settings/character creation ONLY on very first page load (not when returning from other pages)
  useEffect(() => {
    // Wait for session check to complete
    if (hasActiveSession === null) return;
    
    // Only redirect if this is a fresh load with no active session
    if (!hasActiveSession) {
      if (!gameState.character.name) {
        // No character exists - go to character creation
        setLocation('/character-creation');
      } else if (!config.openRouterApiKey && !isGameStarted) {
        // Character exists but no API key and game not started yet - go to settings
        setLocation('/settings');
      }
    }
    // If character exists and game is started, stay on home page even without API key
    // (player will get error when trying to take action)
  }, []);

  // Note: We no longer reload from IndexedDB on visibility change.
  // The game state is already in memory, and reloading caused UI freezes.
  // Data is only loaded on initial page load and saved when changes occur.

  const handleSaveGame = () => {
    saveMutation.mutate();
  };

  const handleNewGame = () => {
    // Generate new session ID and navigate to it
    // Old session data is preserved in IndexedDB for future access
    const newSessionId = generateSessionId();
    window.location.href = buildSessionUrl('/', newSessionId);
  };

  const handleClearAllSaves = async () => {
    try {
      // Clear IndexedDB
      await deleteAllSessions();
      
      // Clear all localStorage keys for game configs
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('gameConfig_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log('[CLEAR ALL] Removed', keysToRemove.length, 'localStorage configs');
      
      toast({
        title: "All saves cleared",
        description: "All saved game sessions have been deleted from storage.",
      });
      // Reload page with new session ID
      const newSessionId = generateSessionId();
      window.location.href = buildSessionUrl('/', newSessionId);
    } catch (error) {
      console.error('[CLEAR ALL] Failed to delete all sessions:', error);
      toast({
        title: "Error",
        description: "Failed to clear all saves. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLoadGame = async () => {
    try {
      const sessions = await getAllSessions();
      setSavedSessions(sessions);
      setIsLoadGameOpen(true);
    } catch (error) {
      console.error('[LOAD GAME] Failed to load sessions:', error);
      toast({
        title: "Error",
        description: "Failed to load saved games. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSelectSession = (selectedSessionId: string) => {
    if (selectedSessionId === sessionId) {
      toast({
        title: "Already loaded",
        description: "This is the current game session.",
      });
      setIsLoadGameOpen(false);
      return;
    }
    
    // Navigate to the selected session
    window.location.href = buildSessionUrl('/', selectedSessionId);
  };

  // Calculate IndexedDB and localStorage sizes
  const [storageStats, setStorageStats] = useState({ indexedDB: 0, localStorage: 0, quota: 0, currentSession: 0, totalSessions: 0 });
  
  useEffect(() => {
    const updateStorageStats = async () => {
      // Get total storage estimate for quota
      const estimate = await getStorageEstimate();
      
      // Calculate current session size accurately
      let currentSessionSize = 0;
      const sessionData = await getSessionData(sessionId);
      if (sessionData) {
        const jsonString = JSON.stringify(sessionData);
        currentSessionSize = new Blob([jsonString]).size;
      }
      
      // Get all sessions and calculate ACTUAL IndexedDB size (compressed)
      const allSessions = await db.sessions.toArray();
      const totalSessionsCount = allSessions.length;
      
      // Calculate actual IndexedDB size by summing compressed session data
      let totalIndexedDBSize = 0;
      allSessions.forEach((session: any) => {
        if (session.compressedData) {
          // Size of the compressed data string
          totalIndexedDBSize += new Blob([session.compressedData]).size;
        }
        // Add overhead for sessionId and lastUpdated
        totalIndexedDBSize += new Blob([session.sessionId]).size;
        totalIndexedDBSize += 8; // lastUpdated is a number (8 bytes)
      });
      
      // Get localStorage size for comparison (legacy data)
      let localSize = 0;
      const keys = [
        getSessionStorageKey('gameState', sessionId),
        getSessionStorageKey('gameCharacter', sessionId),
        getSessionStorageKey('gameConfig', sessionId),
        getSessionStorageKey('turnSnapshots', sessionId),
        getSessionStorageKey('isGameStarted', sessionId),
      ];
      
      keys.forEach(key => {
        const item = localStorage.getItem(key);
        if (item) {
          localSize += item.length * 2; // UTF-16 encoding
        }
      });
      
      setStorageStats({
        indexedDB: totalIndexedDBSize, // Now shows ONLY IndexedDB session data
        localStorage: localSize,
        quota: estimate.quota,
        currentSession: currentSessionSize,
        totalSessions: totalSessionsCount,
      });
    };
    
    updateStorageStats();
  }, [gameState, config, turnSnapshots, sessionId]);

  // Format bytes to human-readable format
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    if (bytes < k) return bytes.toFixed(0) + ' B';
    if (bytes < k * k) return (bytes / k).toFixed(1) + ' KB';
    return (bytes / (k * k)).toFixed(2) + ' MB';
  };

  // Helper to sanitize game state before saving (removes base64 images)
  const sanitizeGameState = (state: GameStateData): GameStateData => {
    const sanitized = { ...state };
    
    // Sanitize debug logs - remove base64 images from imageUrl fields
    if (sanitized.debugLog && Array.isArray(sanitized.debugLog)) {
      sanitized.debugLog = sanitized.debugLog.map((log: any) => {
        // If imageUrl contains base64 data, replace with placeholder
        if (log.imageUrl && typeof log.imageUrl === 'string' && log.imageUrl.startsWith('data:image')) {
          return {
            ...log,
            imageUrl: null, // Remove base64 - only R2 URLs should be stored
          };
        }
        
        // Also sanitize response field in case it contains base64
        if (log.response && typeof log.response === 'string' && log.response.includes('data:image')) {
          return {
            ...log,
            response: log.response.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '[Base64 image data removed]'),
          };
        }
        
        return log;
      });
    }
    
    return sanitized;
  };

  // Helper to save game state to IndexedDB (without updating state)
  const saveGameStateToStorage = async (stateToSave?: GameStateData) => {
    // Use provided state or fall back to current state
    const currentGameState = stateToSave || gameStateRef.current || gameState;
    
    // Sanitize state to remove any base64 images before saving
    const sanitizedState = sanitizeGameState(currentGameState);
    
    try {
      console.log('[DB] Saving to IndexedDB, narrativeHistory length:', sanitizedState.narrativeHistory?.length || 0);
      console.log('[DB] Character imageUrl present:', !!sanitizedState.character.imageUrl);
      console.log('[DB] Location imageUrl present:', !!sanitizedState.location?.imageUrl);
      console.log('[DB] Debug log entries:', sanitizedState.debugLog?.length || 0);
      console.log('[DB] Companions:', sanitizedState.companions?.length || 0);
      console.log('[DB] NPCs:', sanitizedState.encounteredCharacters?.length || 0);
      
      // Save to IndexedDB (use gameState.turnSnapshots, not the separate state variable)
      await saveSessionData({
        sessionId,
        gameState: sanitizedState,
        gameConfig: config,
        costTracker,
        turnSnapshots: sanitizedState.turnSnapshots || [],
        isGameStarted,
        lastUpdated: Date.now(),
      });
      
      console.log('[DB] Save complete');
    } catch (error) {
      console.error('[DB] Failed to save to IndexedDB:', error);
      toast({
        title: "Save failed",
        description: "Failed to save game data. Your progress may not be saved.",
        variant: "destructive",
      });
    }
  };
  
  // Debounced version for entity edits (prevents UI freezes)
  const debouncedSave = (stateToSave?: GameStateData) => {
    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    
    // Set new timer to save after 500ms of no changes
    saveTimerRef.current = setTimeout(() => {
      saveGameStateToStorage(stateToSave);
      saveTimerRef.current = null;
    }, 500);
  };
  
  // Flush pending saves on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveGameStateToStorage();
      }
    };
  }, []);

  const updateGameState = (updates: Partial<GameStateData>) => {
    let updatedState!: GameStateData; // Definite assignment assertion - will be set in callback
    
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
            backstory: prev.location.backstory,
            revelations: prev.location.revelations,
          };
          newState.previousLocations = [...prevLocations, newPrevLocation];
        } else {
          newState.previousLocations = prevLocations;
        }
      } else if (!newState.previousLocations) {
        newState.previousLocations = [];
      }
      
      updatedState = newState;
      return newState;
    });
    
    // Save after state update using debounced save to prevent UI freezes
    // Only debounce for entity edits - immediate narrative/debugLog saves handled by useEffect
    if (updates.character || updates.inventory || updates.quests || updates.companions || updates.encounteredCharacters || updates.location) {
      debouncedSave(updatedState);
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
        
        // Add debug log entry (even if image generation failed) - limit to last 100 entries
        if (result.debugLogEntry) {
          updated.debugLog = [...(updated.debugLog || []), result.debugLogEntry].slice(-100);
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

  // Handler for opening entity detail sheet
  const handleEntityClick = (entity: any, type: 'companion' | 'npc' | 'location' | 'business' | 'quest') => {
    setDetailEntity(entity);
    setDetailEntityType(type);
    setDetailSheetOpen(true);
  };

  // Handler for panel change - clear badge when panel is opened
  const handlePanelChange = (panel: PanelKey | null) => {
    setActivePanel(panel);
    
    if (panel) {
      // Clear badge for the selected panel
      const badgeMapping: Record<PanelKey, string> = {
        inventory: 'inventory',
        spells: 'spells',
        locations: 'locations',
        businesses: 'businesses',
        quests: 'quests',
        companions: 'companions',
        npcs: 'encounters',
        history: 'history',
      };
      
      const tabId = badgeMapping[panel];
      if (tabId) {
        setGameState(prev => ({
          ...prev,
          updatedTabs: (prev.updatedTabs || []).filter(tab => tab !== tabId)
        }));
      }
    }
  };

  // Handler for refreshing image from entity detail sheet
  const handleDetailRefreshImage = async () => {
    if (!detailEntity || detailEntityType === 'quest') return;
    setIsRefreshingImage(true);
    try {
      const entityId = 'id' in detailEntity ? detailEntity.id : undefined;
      await refreshEntityImage(detailEntityType, entityId);
    } finally {
      setIsRefreshingImage(false);
    }
  };

  // Sync detailEntity with updated props when sheet is open
  useEffect(() => {
    if (!detailSheetOpen || !detailEntity) return;
    
    // Find and update the entity from the latest game state
    if (detailEntityType === 'companion') {
      const updated = gameState.companions.find(c => c.id === (detailEntity as Companion).id);
      if (updated && updated.imageUrl !== (detailEntity as Companion).imageUrl) {
        setDetailEntity(updated);
      }
    } else if (detailEntityType === 'npc') {
      const updated = gameState.encounteredCharacters.find(c => c.id === (detailEntity as EncounteredCharacter).id);
      if (updated && updated.imageUrl !== (detailEntity as EncounteredCharacter).imageUrl) {
        setDetailEntity(updated);
      }
    } else if (detailEntityType === 'location') {
      const updated = gameState.previousLocations.find(loc => loc.id === (detailEntity as PreviousLocation).id);
      if (updated && updated.imageUrl !== (detailEntity as PreviousLocation).imageUrl) {
        setDetailEntity(updated);
      }
    } else if (detailEntityType === 'business') {
      const updated = gameState.businesses.find(b => b.id === (detailEntity as Business).id);
      if (updated && updated.imageUrl !== (detailEntity as Business).imageUrl) {
        setDetailEntity(updated);
      }
    }
  }, [detailSheetOpen, gameState.companions, gameState.encounteredCharacters, gameState.previousLocations, gameState.businesses, detailEntity, detailEntityType]);

  // Handler for updating entity from detail sheet
  const handleDetailUpdate = (updates: Partial<Companion | EncounteredCharacter | Business>) => {
    if (!detailEntity) return;
    
    if (detailEntityType === 'companion') {
      const index = gameState.companions.findIndex(c => c.id === (detailEntity as Companion).id);
      if (index !== -1) {
        const updated = [...gameState.companions];
        updated[index] = { ...updated[index], ...updates } as Companion;
        updateGameState({ companions: updated });
        setDetailEntity(updated[index]);
      }
    } else if (detailEntityType === 'npc') {
      const index = gameState.encounteredCharacters.findIndex(c => c.id === (detailEntity as EncounteredCharacter).id);
      if (index !== -1) {
        const updated = [...gameState.encounteredCharacters];
        updated[index] = { ...updated[index], ...updates } as EncounteredCharacter;
        updateGameState({ encounteredCharacters: updated });
        setDetailEntity(updated[index]);
      }
    } else if (detailEntityType === 'business') {
      const index = gameState.businesses.findIndex(b => b.id === (detailEntity as Business).id);
      if (index !== -1) {
        const updated = [...gameState.businesses];
        updated[index] = { ...updated[index], ...updates } as Business;
        updateGameState({ businesses: updated });
        setDetailEntity(updated[index]);
      }
    }
  };

  const createSnapshot = () => {
    // Deep copy of game state to ensure nested objects are captured
    // Exclude turnSnapshots from the snapshot to avoid circular reference
    const { turnSnapshots: _, ...stateToSave } = gameState;
    
    // Create a copy without images to save storage space
    // Only R2 URLs should be stored, not base64 images
    const stateWithoutImages = JSON.parse(JSON.stringify(stateToSave));
    
    // Remove imageUrl from all entities (will be preserved in main game state, just not in snapshots)
    if (stateWithoutImages.character?.imageUrl) {
      delete stateWithoutImages.character.imageUrl;
    }
    
    if (stateWithoutImages.companions) {
      stateWithoutImages.companions = stateWithoutImages.companions.map((c: any) => {
        const { imageUrl, ...rest } = c;
        return rest;
      });
    }
    
    if (stateWithoutImages.encounteredCharacters) {
      stateWithoutImages.encounteredCharacters = stateWithoutImages.encounteredCharacters.map((npc: any) => {
        const { imageUrl, ...rest } = npc;
        return rest;
      });
    }
    
    if (stateWithoutImages.location?.imageUrl) {
      delete stateWithoutImages.location.imageUrl;
    }
    
    if (stateWithoutImages.businesses) {
      stateWithoutImages.businesses = stateWithoutImages.businesses.map((b: any) => {
        const { imageUrl, ...rest } = b;
        return rest;
      });
    }
    
    if (stateWithoutImages.previousLocations) {
      stateWithoutImages.previousLocations = stateWithoutImages.previousLocations.map((loc: any) => {
        const { imageUrl, ...rest } = loc;
        return rest;
      });
    }
    
    // Limit debug log to last 30 entries
    if (stateWithoutImages.debugLog && Array.isArray(stateWithoutImages.debugLog)) {
      stateWithoutImages.debugLog = stateWithoutImages.debugLog.slice(-30);
    }
    
    const snapshot: TurnSnapshot = {
      state: stateWithoutImages,
      costTracker: JSON.parse(JSON.stringify(costTracker)),
      timestamp: Date.now(),
    };
    
    // Update both the separate state AND gameState.turnSnapshots
    setTurnSnapshots(prev => {
      const newSnapshots = [...prev, snapshot].slice(-10);
      return newSnapshots;
    });
    
    // Also update gameState.turnSnapshots so it gets saved to IndexedDB
    setGameState(prev => ({
      ...prev,
      turnSnapshots: [...prev.turnSnapshots, snapshot].slice(-10),
    }));
    
    const snapshotTurn = stateWithoutImages.turnCount || 0;
    console.log(`[SNAPSHOT] Created snapshot for Turn ${snapshotTurn}, total snapshots:`, Math.min((gameState.turnSnapshots?.length || 0) + 1, 10));
  };

  // Calculate snapshot size in bytes
  const getSnapshotSize = (snapshot: TurnSnapshot): number => {
    return new Blob([JSON.stringify(snapshot)]).size;
  };

  // Get narrative label for snapshot
  const getSnapshotLabel = (snapshot: TurnSnapshot): string => {
    const history = snapshot.state.narrativeHistory;
    if (!history || history.length === 0) return 'Game Start';
    
    // Find the last DM message
    const lastDMMessage = [...history].reverse().find(msg => msg.type === 'dm');
    if (lastDMMessage) {
      // Take first 80 characters of the narrative
      const text = lastDMMessage.content.substring(0, 80);
      return text + (lastDMMessage.content.length > 80 ? '...' : '');
    }
    
    return 'Turn ' + history.length;
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

    // Open snapshot selection dialog
    setShowSnapshotDialog(true);
  };

  const restoreToSnapshot = (snapshotIndex: number) => {
    if (snapshotIndex < 0 || snapshotIndex >= turnSnapshots.length) return;

    const selectedSnapshot = turnSnapshots[snapshotIndex];
    const remainingSnapshots = turnSnapshots.slice(0, snapshotIndex);
    
    console.log(`[SNAPSHOT RESTORE] Restoring snapshot at index ${snapshotIndex} (Turn ${selectedSnapshot.state.turnCount})`);
    console.log(`[SNAPSHOT RESTORE] Current turn: ${gameState.turnCount}, Target turn: ${selectedSnapshot.state.turnCount}`);
    console.log(`[SNAPSHOT RESTORE] Total snapshots before: ${turnSnapshots.length}, Remaining after: ${remainingSnapshots.length}`);

    // Restore state from snapshot, but preserve imageUrls from current state
    const restoredState = {
      ...selectedSnapshot.state,
      turnSnapshots: remainingSnapshots,
    };
    
    // Preserve imageUrls from current game state (they were removed from snapshots to save space)
    if (gameState.character?.imageUrl && restoredState.character) {
      restoredState.character = { ...restoredState.character, imageUrl: gameState.character.imageUrl };
    }
    
    // Preserve location imageUrl, but only if it's the same location (match by name since current location has no ID)
    if (restoredState.location) {
      if (gameState.location?.name === restoredState.location.name && gameState.location?.imageUrl) {
        // Same location - use current imageUrl
        restoredState.location = { ...restoredState.location, imageUrl: gameState.location.imageUrl };
      } else if (gameState.previousLocations) {
        // Different location - look for it in previousLocations (match by ID if available, then name)
        const matchingPrevLocation = gameState.previousLocations.find(
          loc => (loc.id && loc.id === (restoredState.location as any).id) || loc.name === restoredState.location.name
        );
        if (matchingPrevLocation?.imageUrl) {
          restoredState.location = { ...restoredState.location, imageUrl: matchingPrevLocation.imageUrl };
        }
      }
    }
    
    // Preserve companion imageUrls by ID
    if (restoredState.companions && gameState.companions) {
      restoredState.companions = restoredState.companions.map(companion => {
        const currentCompanion = gameState.companions.find(c => c.id === companion.id);
        return currentCompanion?.imageUrl 
          ? { ...companion, imageUrl: currentCompanion.imageUrl }
          : companion;
      });
    }
    
    // Preserve NPC imageUrls by ID
    if (restoredState.encounteredCharacters && gameState.encounteredCharacters) {
      restoredState.encounteredCharacters = restoredState.encounteredCharacters.map(npc => {
        const currentNpc = gameState.encounteredCharacters.find(n => n.id === npc.id);
        return currentNpc?.imageUrl 
          ? { ...npc, imageUrl: currentNpc.imageUrl }
          : npc;
      });
    }
    
    // Preserve business imageUrls by ID
    if (restoredState.businesses && gameState.businesses) {
      restoredState.businesses = restoredState.businesses.map(business => {
        const currentBusiness = gameState.businesses.find(b => b.id === business.id);
        return currentBusiness?.imageUrl 
          ? { ...business, imageUrl: currentBusiness.imageUrl }
          : business;
      });
    }
    
    // Preserve previous location imageUrls by name (since they might not have IDs)
    if (restoredState.previousLocations && gameState.previousLocations) {
      restoredState.previousLocations = restoredState.previousLocations.map(loc => {
        const currentLoc = gameState.previousLocations.find(l => l.name === loc.name);
        return currentLoc?.imageUrl 
          ? { ...loc, imageUrl: currentLoc.imageUrl }
          : loc;
      });
    }
    
    // Migrate updatedTabs from Set (which becomes {}) to array
    if (restoredState.updatedTabs && !Array.isArray(restoredState.updatedTabs)) {
      restoredState.updatedTabs = [];
    }
    
    setGameState(restoredState);

    // Restore cost tracker
    setCostTracker(migrateCostTracker(selectedSnapshot.costTracker));

    // Update snapshots array
    setTurnSnapshots(remainingSnapshots);

    // Save the restored state to IndexedDB
    saveGameStateToStorage(restoredState);
    
    // Close dialog
    setShowSnapshotDialog(false);
    
    const restoredTurn = selectedSnapshot.state.turnCount || 0;
    const currentTurn = gameState.turnCount || 0;
    const turnsUndone = currentTurn - restoredTurn;
    
    toast({
      title: "Restored to Turn " + restoredTurn,
      description: turnsUndone > 0 
        ? `Undid ${turnsUndone} turn${turnsUndone !== 1 ? 's' : ''}`
        : 'Game restored',
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
        isGameStarted: isGameStarted,
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
        
        // Migrate config
        const migratedConfig = await migrateConfig(importData.config);
        
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
        
        // Add snapshots to migrated state so they get saved to IndexedDB
        migratedState.turnSnapshots = migratedSnapshots;
        
        // Restore all data with migrations applied
        setGameState(migratedState);
        setConfig(migratedConfig);
        setCostTracker(migratedCostTracker);
        setTurnSnapshots(migratedSnapshots);
        setIsGameStarted(importData.isGameStarted ?? true);
        
        // Save to IndexedDB (no localStorage needed)
        await saveGameStateToStorage(migratedState);
        
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
            <div className="flex items-center">
              <img 
                src="/dp-logo.svg" 
                alt="D&D Adventure" 
                className="h-[60px] md:h-[75px]"
              />
            </div>
            
            <div className="flex items-center gap-3">
              {/* Version Number */}
              <div className="hidden md:flex items-center gap-2 bg-muted/30 border border-border rounded-lg px-3 py-1.5" data-testid="version-display">
                <span className="text-xs text-muted-foreground font-mono">v1.0.4</span>
              </div>
              
              {/* Cost Tracker */}
              <HoverCard>
                <HoverCardTrigger asChild>
                  <div className="hidden lg:flex items-center gap-2 bg-accent/10 border border-accent rounded-lg px-4 py-2 cursor-pointer hover:bg-accent/20 transition-colors">
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
              
              {/* Primary Actions */}
              <Button
                onClick={handleSaveGame}
                disabled={saveMutation.isPending}
                size="default"
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold shadow-sm"
                data-testid="button-save-game"
              >
                <Save className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Save Game</span>
                <span className="sm:hidden">Save</span>
              </Button>
              
              {/* Game Menu Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="default"
                    className="font-medium"
                    data-testid="button-game-menu"
                  >
                    <Menu className="w-4 h-4 mr-2" />
                    <span className="hidden md:inline">Game</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-semibold">Game Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleNewGame}
                    className="cursor-pointer"
                    data-testid="menu-new-game"
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    New Game
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleLoadGame}
                    className="cursor-pointer"
                    data-testid="menu-load-game"
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Load Game
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleUndo}
                    disabled={turnSnapshots.length === 0}
                    className="cursor-pointer"
                    data-testid="menu-undo"
                  >
                    <Undo2 className="w-4 h-4 mr-2" />
                    Undo Last Turn
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="font-semibold">Data Management</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setShowExportDialog(true)}
                    className="cursor-pointer"
                    data-testid="menu-export"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Save
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleImport}
                    className="cursor-pointer"
                    data-testid="menu-import"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Import Save
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleClearAllSaves}
                    className="cursor-pointer text-destructive focus:text-destructive"
                    data-testid="menu-clear-all-saves"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All Saves
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="cursor-default hover:bg-transparent"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Database className="w-4 h-4 mr-2 text-muted-foreground" />
                    <div className="flex flex-col gap-0.5 text-xs">
                      <div className="font-semibold text-primary">Session: {formatBytes(storageStats.currentSession)}</div>
                      <div className="text-[10px] text-muted-foreground">Sessions: {storageStats.totalSessions} | Total: {formatBytes(storageStats.indexedDB)}</div>
                    </div>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="font-semibold">System</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setIsDebugLogOpen(true)}
                    className="cursor-pointer"
                    data-testid="menu-view-log"
                  >
                    <Terminal className="w-4 h-4 mr-2" />
                    View Debug Log
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setLocation(`/settings?session=${sessionId}`)}
                    className="cursor-pointer"
                    data-testid="menu-settings"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
        worldBackstory={gameState.worldBackstory}
        onUpdate={updateGameState}
        onRefreshImage={refreshEntityImage}
      />

      {/* Main Content - New Layout with Icon Rail */}
      <div className="flex-1 max-w-[1920px] mx-auto w-full flex">
        {/* Chat Area (Narrative Panel) */}
        <div className="flex-1 p-4">
          <NarrativePanel 
            gameState={gameState}
            setGameState={setGameState}
            saveGameState={saveGameStateToStorage}
            config={config}
            costTracker={costTracker}
            setCostTracker={setCostTracker}
            models={models || []}
            createSnapshot={createSnapshot}
            sessionId={sessionId}
          />
        </div>

        {/* Info Drawer (Slides in from right) */}
        <InfoDrawer
          activePanel={activePanel}
          onClose={() => setActivePanel(null)}
          gameState={gameState}
          onUpdate={updateGameState}
          onEntityClick={handleEntityClick}
        />

        {/* Icon Rail (Always visible on right edge) */}
        <IconRail
          activePanel={activePanel}
          onPanelChange={handlePanelChange}
          badges={badges}
        />
      </div>

      {/* Entity Detail Sheet */}
      <EntityDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        entity={detailEntity}
        entityType={detailEntityType}
        onRefresh={handleDetailRefreshImage}
        isRefreshing={isRefreshingImage}
        onUpdate={handleDetailUpdate}
      />

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

      {/* Snapshot Selection Dialog */}
      <Dialog open={showSnapshotDialog} onOpenChange={setShowSnapshotDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Restore to Snapshot</DialogTitle>
            <DialogDescription>
              Select a snapshot to restore your game to that point. Newer snapshots are at the top.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {turnSnapshots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No snapshots available
              </div>
            ) : (
              // Reverse to show newest first
              [...turnSnapshots].reverse().map((snapshot, reverseIndex) => {
                const actualIndex = turnSnapshots.length - 1 - reverseIndex;
                const size = getSnapshotSize(snapshot);
                const label = getSnapshotLabel(snapshot);
                const timestamp = new Date(snapshot.timestamp);
                const snapshotTurn = snapshot.state.turnCount || 0;
                const currentTurn = gameState.turnCount || 0;
                const turnsAgo = currentTurn - snapshotTurn;
                
                return (
                  <Card 
                    key={actualIndex}
                    className="cursor-pointer transition-all hover:border-primary hover:bg-accent/50"
                    onClick={() => restoreToSnapshot(actualIndex)}
                    data-testid={`snapshot-card-${actualIndex}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base font-medium flex items-center gap-2">
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-semibold">
                              Turn {snapshotTurn}
                            </span>
                            {turnsAgo > 0 && (
                              <span className="text-xs text-muted-foreground">
                                ({turnsAgo} turn{turnsAgo !== 1 ? 's' : ''} ago)
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {timestamp.toLocaleTimeString()}
                            </span>
                          </CardTitle>
                          <CardDescription className="mt-2 line-clamp-2">
                            {label}
                          </CardDescription>
                        </div>
                        <div className="text-xs text-muted-foreground text-right whitespace-nowrap">
                          <div className="font-mono bg-muted px-2 py-1 rounded">
                            {formatBytes(size)}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowSnapshotDialog(false)} data-testid="button-cancel-snapshot">
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Load Game Dialog */}
      <Dialog open={isLoadGameOpen} onOpenChange={setIsLoadGameOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Load Game</DialogTitle>
            <DialogDescription>
              Select a saved game session to load. Your current game progress will be saved automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {savedSessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No saved games found
              </div>
            ) : (
              savedSessions.map((session) => {
                const isCurrentSession = session.sessionId === sessionId;
                const lastUpdatedDate = new Date(session.lastUpdated);
                const characterName = session.gameState?.character?.name || 'Unknown Character';
                const characterRace = session.gameState?.character?.race || '';
                const characterClass = session.gameState?.character?.class || '';
                const level = session.gameState?.character?.level || 1;
                const turnCount = session.gameState?.turnCount || 0;
                
                return (
                  <Card 
                    key={session.sessionId}
                    className={`cursor-pointer transition-all hover:border-primary ${isCurrentSession ? 'border-primary bg-accent' : ''}`}
                    onClick={() => handleSelectSession(session.sessionId)}
                    data-testid={`session-card-${session.sessionId}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">
                            {characterName}
                            {isCurrentSession && (
                              <span className="ml-2 text-sm text-primary font-normal">(Current)</span>
                            )}
                          </CardTitle>
                          <CardDescription>
                            Level {level} {characterRace} {characterClass}
                          </CardDescription>
                        </div>
                        <div className="text-xs text-muted-foreground text-right">
                          {lastUpdatedDate.toLocaleDateString()}
                          <br />
                          {lastUpdatedDate.toLocaleTimeString()}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <div>Turns: {turnCount}</div>
                        <div>Session: {session.sessionId.substring(0, 8)}...</div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
