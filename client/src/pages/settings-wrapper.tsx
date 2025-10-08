import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { fetchOpenRouterModels } from '@/lib/openrouter';
import { createDefaultConfig, migrateParserPrompt, migrateConfig } from '@/lib/game-state';
import { getSessionIdFromUrl, getSessionStorageKey, generateSessionId, setSessionIdInUrl, buildSessionUrl } from '@/lib/session';
import type { GameConfig, OpenRouterModel } from '@shared/schema';
import SettingsPage from '@/pages/settings';
import { useToast } from '@/hooks/use-toast';

export default function SettingsWrapper() {
  const [, setLocation] = useLocation();
  const [sessionId, setSessionId] = useState<string>(() => getSessionIdFromUrl() || '');
  const [isNewSession, setIsNewSession] = useState(false);
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
  
  const [config, setConfig] = useState<GameConfig>(() => {
    const initialSessionId = getSessionIdFromUrl() || '';
    if (!initialSessionId) {
      return createDefaultConfig();
    }
    
    try {
      // Try to load config from session-scoped localStorage
      const savedConfig = localStorage.getItem(getSessionStorageKey('gameConfig', initialSessionId));
      if (!savedConfig) {
        setIsNewSession(true);
        return createDefaultConfig();
      }
      const loadedConfig = JSON.parse(savedConfig);
      const migratedConfig = migrateConfig(loadedConfig);
      return migrateParserPrompt(migratedConfig);
    } catch (error) {
      console.error('Failed to load config from localStorage:', error);
      // If loading fails, return default config
      setIsNewSession(true);
      return createDefaultConfig();
    }
  });

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

  // Fetch OpenRouter models (always enabled - backend will use fallback key if needed)
  const { data: models, refetch: refetchModels } = useQuery<OpenRouterModel[]>({
    queryKey: ['/api/models', config.openRouterApiKey],
    queryFn: () => fetchOpenRouterModels(config.openRouterApiKey),
  });

  const handleConfigSave = (newConfig: GameConfig) => {
    setConfig(newConfig);
    const currentSessionId = sessionId || getSessionIdFromUrl();
    if (!currentSessionId) {
      console.error('No session ID available');
      toast({
        title: "Error saving settings",
        description: "No active session found. Please refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Save to session-scoped localStorage
      localStorage.setItem(getSessionStorageKey('gameConfig', currentSessionId), JSON.stringify(newConfig));
      
      toast({
        title: "Settings saved",
        description: "Your settings have been updated successfully.",
      });
      
      // Navigate back to home with session ID
      setLocation(buildSessionUrl('/', currentSessionId));
    } catch (error) {
      // Handle localStorage quota exceeded error
      if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        toast({
          title: "Storage quota exceeded",
          description: "Your browser storage is full. Try clearing old game sessions or starting a new session with the 'New Game' button.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error saving settings",
          description: "Failed to save settings. Please try again.",
          variant: "destructive",
        });
      }
      console.error('Failed to save config:', error);
    }
  };

  return (
    <SettingsPage
      config={config}
      onSave={handleConfigSave}
      models={models || []}
      onRefreshModels={() => refetchModels()}
    />
  );
}
