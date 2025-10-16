import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { fetchOpenRouterModels } from '@/lib/openrouter';
import { createDefaultConfig, migrateParserPrompt, migrateConfig, loadDefaultPromptsFromAPI } from '@/lib/game-state';
import { getSessionIdFromUrl, generateSessionId, setSessionIdInUrl, buildSessionUrl } from '@/lib/session';
import { getSessionData, saveSessionData } from '@/lib/db';
import type { GameConfig, OpenRouterModel } from '@shared/schema';
import SettingsPage from '@/pages/settings';
import { useToast } from '@/hooks/use-toast';

export default function SettingsWrapper() {
  const [, setLocation] = useLocation();
  const [sessionId, setSessionId] = useState<string>(() => getSessionIdFromUrl() || '');
  const [configLoaded, setConfigLoaded] = useState(false);
  const { toast } = useToast();
  
  // Ensure session ID exists - create one if missing
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
  
  const [config, setConfig] = useState<GameConfig>(createDefaultConfig);
  
  // Load config from IndexedDB when component mounts
  useEffect(() => {
    const loadConfig = async () => {
      const currentSessionId = getSessionIdFromUrl();
      if (!currentSessionId) return;
      
      console.log('[SETTINGS] Loading config for session:', currentSessionId);
      
      try {
        // Load from IndexedDB (same as home page)
        const sessionData = await getSessionData(currentSessionId);
        
        if (sessionData && sessionData.gameConfig) {
          console.log('[SETTINGS] Loaded config from IndexedDB');
          const migratedConfig = await migrateConfig(sessionData.gameConfig);
          const finalConfig = await migrateParserPrompt(migratedConfig);
          console.log('[SETTINGS] Config primaryLLM:', finalConfig.primaryLLM);
          setConfig(finalConfig);
          setConfigLoaded(true);
        } else {
          // No saved config - this is a new session, load defaults from API
          console.log('[SETTINGS] No saved config, loading defaults from API');
          const defaults = await loadDefaultPromptsFromAPI();
          if (defaults) {
            setConfig(prev => ({
              ...prev,
              dmSystemPrompt: defaults.primary,
              parserSystemPrompt: defaults.parser,
              characterImagePrompt: defaults.imageCharacter,
              locationImagePrompt: defaults.imageLocation,
              backstorySystemPrompt: defaults.backstory,
              revelationsSystemPrompt: defaults.revelations,
              loreSystemPrompt: defaults.lore,
            }));
          }
          setConfigLoaded(true);
        }
      } catch (error) {
        console.error('Failed to load config from IndexedDB:', error);
        setConfigLoaded(true);
      }
    };
    
    loadConfig();
  }, []); // Run only on mount

  const [llmModels, setLlmModels] = useState<OpenRouterModel[]>([]);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const models = await fetchOpenRouterModels();
        setLlmModels(models);
      } catch (error) {
        console.error('Failed to load LLM models:', error);
        toast({
          title: "Failed to load models",
          description: "Could not fetch available LLM models",
          variant: "destructive",
        });
      }
    };
    loadModels();
  }, [toast]);

  const handleSave = async (newConfig: GameConfig) => {
    if (!sessionId) {
      console.error('[SETTINGS] No session ID available for saving');
      return;
    }
    
    try {
      // Load current session data from IndexedDB
      const sessionData = await getSessionData(sessionId);
      
      if (sessionData) {
        // Update config in existing session data
        console.log('[SETTINGS] Updating config in IndexedDB for session:', sessionId);
        await saveSessionData({
          ...sessionData,
          gameConfig: newConfig,
          lastUpdated: Date.now(),
        });
      } else {
        // This shouldn't happen, but create new session data if needed
        console.log('[SETTINGS] Creating new session data with config');
        const { createDefaultGameState, createDefaultCostTracker } = await import('@/lib/game-state');
        await saveSessionData({
          sessionId,
          gameState: createDefaultGameState(),
          gameConfig: newConfig,
          costTracker: createDefaultCostTracker(),
          turnSnapshots: [],
          isGameStarted: false,
          lastUpdated: Date.now(),
        });
      }
      
      setConfig(newConfig);
      console.log('[SETTINGS] Config saved successfully to IndexedDB');
      
      // Navigate to home
      const homeUrl = buildSessionUrl('/', sessionId);
      window.location.href = homeUrl;
    } catch (error) {
      console.error('[SETTINGS] Failed to save config:', error);
      toast({
        title: "Save failed",
        description: "Could not save settings",
        variant: "destructive",
      });
    }
  };

  const handleRefreshModels = async () => {
    try {
      const models = await fetchOpenRouterModels();
      setLlmModels(models);
      toast({
        title: "Models refreshed",
        description: "Successfully loaded latest models from OpenRouter",
      });
    } catch (error) {
      console.error('Failed to refresh models:', error);
      toast({
        title: "Refresh failed",
        description: "Could not refresh LLM models",
        variant: "destructive",
      });
    }
  };

  // Show loading while config is being loaded
  if (!configLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <SettingsPage 
      config={config} 
      models={llmModels} 
      onSave={handleSave}
      onRefreshModels={handleRefreshModels}
    />
  );
}
