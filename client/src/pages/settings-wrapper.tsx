import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { fetchOpenRouterModels } from '@/lib/openrouter';
import { createDefaultConfig, migrateParserPrompt } from '@/lib/game-state';
import type { GameConfig, OpenRouterModel } from '@shared/schema';
import SettingsPage from '@/pages/settings';

export default function SettingsWrapper() {
  const [, setLocation] = useLocation();
  const [config, setConfig] = useState<GameConfig>(() => {
    // Try to load config from localStorage
    const savedConfig = localStorage.getItem('gameConfig');
    const loadedConfig = savedConfig ? JSON.parse(savedConfig) : createDefaultConfig();
    return migrateParserPrompt(loadedConfig);
  });

  // Fetch OpenRouter models
  const { data: models, refetch: refetchModels } = useQuery<OpenRouterModel[]>({
    queryKey: ['/api/models', config.openRouterApiKey],
    queryFn: () => fetchOpenRouterModels(config.openRouterApiKey),
    enabled: !!config.openRouterApiKey,
  });

  const handleConfigSave = (newConfig: GameConfig) => {
    setConfig(newConfig);
    // Save to localStorage
    localStorage.setItem('gameConfig', JSON.stringify(newConfig));
    // Navigate back to home
    setLocation('/');
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
