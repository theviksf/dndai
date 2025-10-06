import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { fetchOpenRouterModels } from '@/lib/openrouter';
import { createDefaultConfig, migrateParserPrompt, migrateConfig } from '@/lib/game-state';
import { getSessionIdFromUrl, getSessionStorageKey, generateSessionId, setSessionIdInUrl, buildSessionUrl } from '@/lib/session';
import type { GameConfig, OpenRouterModel } from '@shared/schema';
import SettingsPage from '@/pages/settings';

export default function SettingsWrapper() {
  const [, setLocation] = useLocation();
  const [sessionId, setSessionId] = useState<string>(() => getSessionIdFromUrl() || '');
  const [isNewSession, setIsNewSession] = useState(false);
  
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
  }, [sessionId]);
  
  const [config, setConfig] = useState<GameConfig>(() => {
    const initialSessionId = getSessionIdFromUrl() || '';
    if (!initialSessionId) {
      return createDefaultConfig();
    }
    // Try to load config from session-scoped localStorage
    const savedConfig = localStorage.getItem(getSessionStorageKey('gameConfig', initialSessionId));
    if (!savedConfig) {
      setIsNewSession(true);
      return createDefaultConfig();
    }
    const loadedConfig = JSON.parse(savedConfig);
    const migratedConfig = migrateConfig(loadedConfig);
    return migrateParserPrompt(migratedConfig);
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

  // Fetch OpenRouter models
  const { data: models, refetch: refetchModels } = useQuery<OpenRouterModel[]>({
    queryKey: ['/api/models', config.openRouterApiKey],
    queryFn: () => fetchOpenRouterModels(config.openRouterApiKey),
    enabled: !!config.openRouterApiKey,
  });

  const handleConfigSave = (newConfig: GameConfig) => {
    setConfig(newConfig);
    const currentSessionId = sessionId || getSessionIdFromUrl();
    if (!currentSessionId) {
      console.error('No session ID available');
      return;
    }
    // Save to session-scoped localStorage
    localStorage.setItem(getSessionStorageKey('gameConfig', currentSessionId), JSON.stringify(newConfig));
    // Navigate back to home with session ID
    setLocation(buildSessionUrl('/', currentSessionId));
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
