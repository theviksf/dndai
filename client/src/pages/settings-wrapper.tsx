import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { fetchOpenRouterModels } from '@/lib/openrouter';
import { createDefaultConfig, migrateParserPrompt, migrateConfig, loadDefaultPromptsFromAPI } from '@/lib/game-state';
import { getSessionIdFromUrl, getSessionStorageKey, generateSessionId, setSessionIdInUrl, buildSessionUrl } from '@/lib/session';
import type { GameConfig, OpenRouterModel } from '@shared/schema';
import SettingsPage from '@/pages/settings';
import { useToast } from '@/hooks/use-toast';

export default function SettingsWrapper() {
  const [, setLocation] = useLocation();
  const [sessionId, setSessionId] = useState<string>(() => getSessionIdFromUrl() || '');
  const [isNewSession, setIsNewSession] = useState(false);
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
  
  // Load config from localStorage when component mounts
  useEffect(() => {
    const loadConfig = async () => {
      const currentSessionId = getSessionIdFromUrl();
      if (!currentSessionId) return;
      
      console.log('[SETTINGS] Loading config for session:', currentSessionId);
      
      try {
        const storageKey = getSessionStorageKey('gameConfig', currentSessionId);
        const savedConfig = localStorage.getItem(storageKey);
        console.log('[SETTINGS] Loaded from localStorage key:', storageKey, 'value exists:', !!savedConfig);
        
        if (savedConfig) {
          const loadedConfig = JSON.parse(savedConfig);
          console.log('[SETTINGS] Loaded config primaryLLM:', loadedConfig.primaryLLM);
          const migratedConfig = await migrateConfig(loadedConfig);
          const finalConfig = await migrateParserPrompt(migratedConfig);
          console.log('[SETTINGS] Final config primaryLLM:', finalConfig.primaryLLM);
          setConfig(finalConfig);
          setConfigLoaded(true);
        } else {
          // No saved config - this is a new session, load defaults from API
          setIsNewSession(true);
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
        console.error('Failed to reload config from localStorage:', error);
        setConfigLoaded(true);
      }
    };
    
    loadConfig();
  }, []); // Run only on mount

  // Fetch default prompts from .md files for new sessions (fallback)
  const { data: defaultPrompts } = useQuery({
    queryKey: ['/api/prompts/defaults'],
    queryFn: async () => {
      const response = await fetch('/api/prompts/defaults');
      if (!response.ok) throw new Error('Failed to fetch default prompts');
      return response.json();
    },
    enabled: isNewSession && !configLoaded,
  });

  // Update config with prompts from .md files when they're loaded for new sessions
  useEffect(() => {
    if (isNewSession && defaultPrompts && !configLoaded) {
      setConfig(prev => ({
        ...prev,
        dmSystemPrompt: defaultPrompts.primary,
        parserSystemPrompt: defaultPrompts.parser,
        characterImagePrompt: defaultPrompts.imageCharacter,
        locationImagePrompt: defaultPrompts.imageLocation,
        backstorySystemPrompt: defaultPrompts.backstory,
        revelationsSystemPrompt: defaultPrompts.revelations,
        loreSystemPrompt: defaultPrompts.lore,
      }));
      setConfigLoaded(true);
      setIsNewSession(false);
    }
  }, [isNewSession, defaultPrompts, configLoaded]);

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

  const handleSave = (newConfig: GameConfig) => {
    if (!sessionId) {
      console.error('[SETTINGS] No session ID available for saving');
      return;
    }
    
    setConfig(newConfig);
    const storageKey = getSessionStorageKey('gameConfig', sessionId);
    localStorage.setItem(storageKey, JSON.stringify(newConfig));
    console.log('[SETTINGS] Saved config to localStorage key:', storageKey);
    
    // Use browser navigation to go to home instead of wouter (avoids re-render issues)
    const homeUrl = buildSessionUrl('/', sessionId);
    window.location.href = homeUrl;
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
