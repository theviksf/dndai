import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { fetchOpenRouterModels } from '@/lib/openrouter';
import { createDefaultGameState, createDefaultConfig, createDefaultCostTracker } from '@/lib/game-state';
import type { GameStateData, GameConfig, CostTracker, OpenRouterModel } from '@shared/schema';
import SettingsModal from '@/components/settings-modal';
import CharacterCreationModal from '@/components/character-creation-modal';
import CharacterStats from '@/components/character-stats';
import NarrativePanel from '@/components/narrative-panel';
import InventoryQuestPanel from '@/components/inventory-quest-panel';
import { Button } from '@/components/ui/button';
import { Settings, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const { toast } = useToast();
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameStateData>(createDefaultGameState());
  const [config, setConfig] = useState<GameConfig>(createDefaultConfig());
  const [costTracker, setCostTracker] = useState<CostTracker>(createDefaultCostTracker());
  const [showSettings, setShowSettings] = useState(false);
  const [showCharacterCreation, setShowCharacterCreation] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(false);

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

  // Show settings on first load if no game started
  useEffect(() => {
    if (!isGameStarted) {
      setShowSettings(true);
    }
  }, []);

  const handleSaveGame = () => {
    saveMutation.mutate();
  };

  const handleConfigSave = (newConfig: GameConfig) => {
    setConfig(newConfig);
    setShowSettings(false);
    if (!isGameStarted) {
      setShowCharacterCreation(true);
    }
  };

  const handleCharacterCreated = (character: GameStateData['character']) => {
    setGameState(prev => ({
      ...prev,
      character,
    }));
    setShowCharacterCreation(false);
    setIsGameStarted(true);
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
                onClick={() => setShowSettings(true)}
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

      {/* Main Content */}
      <div className="flex-1 max-w-[1920px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 h-full">
          <CharacterStats character={gameState.character} statusEffects={gameState.statusEffects} location={gameState.location} />
          <NarrativePanel 
            gameState={gameState}
            setGameState={setGameState}
            config={config}
            costTracker={costTracker}
            setCostTracker={setCostTracker}
            models={models || []}
          />
          <InventoryQuestPanel inventory={gameState.inventory} quests={gameState.quests} />
        </div>
      </div>

      {/* Modals */}
      <SettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
        config={config}
        onSave={handleConfigSave}
        models={models || []}
      />
      
      <CharacterCreationModal
        open={showCharacterCreation}
        onOpenChange={setShowCharacterCreation}
        onComplete={handleCharacterCreated}
      />
    </div>
  );
}
