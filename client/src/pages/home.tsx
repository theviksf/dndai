import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { fetchOpenRouterModels } from '@/lib/openrouter';
import { createDefaultGameState, createDefaultConfig, createDefaultCostTracker, migrateParserPrompt } from '@/lib/game-state';
import type { GameStateData, GameConfig, CostTracker, OpenRouterModel } from '@shared/schema';
import CharacterStatsBar from '@/components/character-stats-bar';
import NarrativePanel from '@/components/narrative-panel';
import GameInfoTabs from '@/components/game-info-tabs';
import DebugLogViewer from '@/components/debug-log-viewer';
import { Button } from '@/components/ui/button';
import { Settings, Save, Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameStateData>(() => {
    const defaultState = createDefaultGameState();
    // Load character from localStorage if exists
    const savedCharacter = localStorage.getItem('gameCharacter');
    if (savedCharacter) {
      defaultState.character = JSON.parse(savedCharacter);
    }
    return defaultState;
  });
  const [config, setConfig] = useState<GameConfig>(() => {
    // Load config from localStorage
    const savedConfig = localStorage.getItem('gameConfig');
    const loadedConfig = savedConfig ? JSON.parse(savedConfig) : createDefaultConfig();
    return migrateParserPrompt(loadedConfig);
  });
  const [costTracker, setCostTracker] = useState<CostTracker>(createDefaultCostTracker());
  const [isGameStarted, setIsGameStarted] = useState(() => {
    return localStorage.getItem('isGameStarted') === 'true';
  });
  const [isDebugLogOpen, setIsDebugLogOpen] = useState(false);

  // Fetch OpenRouter models
  const { data: models, refetch: refetchModels } = useQuery<OpenRouterModel[]>({
    queryKey: ['/api/models', config.openRouterApiKey],
    queryFn: () => fetchOpenRouterModels(config.openRouterApiKey),
    enabled: !!config.openRouterApiKey,
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
        const savedConfig = localStorage.getItem('gameConfig');
        const savedCharacter = localStorage.getItem('gameCharacter');
        const gameStarted = localStorage.getItem('isGameStarted');
        
        if (savedConfig) {
          const loadedConfig = JSON.parse(savedConfig);
          setConfig(migrateParserPrompt(loadedConfig));
        }
        if (savedCharacter) {
          setGameState(prev => ({
            ...prev,
            character: JSON.parse(savedCharacter)
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
              <div className="hidden md:flex items-center gap-2 bg-accent/10 border border-accent rounded-md px-4 py-2">
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
              
              {/* Game Actions */}
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
                onClick={() => setIsDebugLogOpen(true)}
                variant="outline"
                className="bg-muted hover:bg-muted/80"
                data-testid="button-view-log"
              >
                <Terminal className="w-4 h-4 mr-2" />
                <span className="hidden md:inline">View Log</span>
              </Button>
              
              <Button
                onClick={() => setLocation('/settings')}
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
      />

      {/* Main Content */}
      <div className="flex-1 max-w-[1920px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 h-full">
          <div className="lg:col-span-8">
            <NarrativePanel 
              gameState={gameState}
              setGameState={setGameState}
              config={config}
              costTracker={costTracker}
              setCostTracker={setCostTracker}
              models={models || []}
            />
          </div>
          <div className="lg:col-span-4">
            <GameInfoTabs 
              inventory={gameState.inventory} 
              quests={gameState.quests} 
              companions={gameState.companions || []} 
              encounteredCharacters={gameState.encounteredCharacters || []} 
              history={gameState.parsedRecaps || []} 
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
    </div>
  );
}
