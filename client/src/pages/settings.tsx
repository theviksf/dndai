import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { GameConfig, OpenRouterModel } from '@shared/schema';
import { RECOMMENDED_CONFIGS, estimateTurnCost } from '@/lib/openrouter';
import { getSessionIdFromUrl } from '@/lib/session';
import { Cpu, Key, Settings2, Sparkles, Scale, DollarSign, FlaskConical, FileText, RefreshCw, ArrowLeft, RotateCcw, Eye, EyeOff, Database, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { analyzeStorageBreakdown, type StorageBreakdown } from '@/lib/db';

interface SettingsPageProps {
  config: GameConfig;
  onSave: (config: GameConfig) => void;
  models: OpenRouterModel[];
  onRefreshModels: () => void;
}

export default function SettingsPage({ config, onSave, models, onRefreshModels }: SettingsPageProps) {
  const [, setLocation] = useLocation();
  const [localConfig, setLocalConfig] = useState<GameConfig>(config);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [showApiKey, setShowApiKey] = useState(false);
  const [useDevKey, setUseDevKey] = useState(!config.openRouterApiKey);
  const [modelSortBy, setModelSortBy] = useState<'date' | 'name'>('date');
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [storageBreakdown, setStorageBreakdown] = useState<StorageBreakdown | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [storageExpanded, setStorageExpanded] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  // Auto-load missing prompts for existing sessions
  useEffect(() => {
    const loadMissingPrompts = async () => {
      // Check if any prompts are empty
      if (!config.backstorySystemPrompt || !config.revelationsSystemPrompt || !config.loreSystemPrompt) {
        console.log('[SETTINGS] Loading missing prompts for existing session');
        const defaults = await loadDefaultPrompts();
        if (defaults) {
          setLocalConfig(prev => ({
            ...prev,
            backstorySystemPrompt: prev.backstorySystemPrompt || defaults.backstory,
            revelationsSystemPrompt: prev.revelationsSystemPrompt || defaults.revelations,
            loreSystemPrompt: prev.loreSystemPrompt || defaults.lore,
          }));
          // Auto-save the updated config
          onSave({
            ...config,
            backstorySystemPrompt: config.backstorySystemPrompt || defaults.backstory,
            revelationsSystemPrompt: config.revelationsSystemPrompt || defaults.revelations,
            loreSystemPrompt: config.loreSystemPrompt || defaults.lore,
          });
        }
      }
    };
    loadMissingPrompts();
  }, [config.backstorySystemPrompt, config.revelationsSystemPrompt, config.loreSystemPrompt]);

  // Apply UI scale immediately when changed (preview)
  useEffect(() => {
    const scale = localConfig.uiScale === 'compact' ? '80%' : '100%';
    document.documentElement.style.fontSize = scale;
  }, [localConfig.uiScale]);

  const loadDefaultPrompts = async () => {
    try {
      const response = await fetch('/api/prompts/defaults');
      if (!response.ok) throw new Error('Failed to load defaults');
      const defaults = await response.json();
      return defaults;
    } catch (error) {
      toast({
        title: "Error loading defaults",
        description: "Could not load default prompts from server.",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleResetPrompt = async (promptType: 'primary' | 'parser' | 'imageCharacter' | 'imageLocation' | 'backstory' | 'backstoryparser' | 'revelations' | 'lore') => {
    const defaults = await loadDefaultPrompts();
    if (!defaults) return;

    const fieldMap = {
      primary: 'dmSystemPrompt',
      parser: 'parserSystemPrompt',
      imageCharacter: 'characterImagePrompt',
      imageLocation: 'locationImagePrompt',
      backstory: 'backstorySystemPrompt',
      backstoryparser: 'backstoryParserPrompt',
      revelations: 'revelationsSystemPrompt',
      lore: 'loreSystemPrompt',
    };

    const field = fieldMap[promptType] as keyof GameConfig;
    setLocalConfig(prev => ({
      ...prev,
      [field]: defaults[promptType],
    }));

    toast({
      title: "Prompt reset",
      description: "The prompt has been reset to its default value.",
    });
  };

  useEffect(() => {
    if (models.length > 0) {
      const primaryModel = models.find(m => m.id === localConfig.primaryLLM);
      const parserModel = models.find(m => m.id === localConfig.parserLLM);
      
      if (primaryModel && parserModel) {
        const cost = estimateTurnCost(primaryModel.pricing, parserModel.pricing);
        setEstimatedCost(cost);
      }
    }
  }, [localConfig.primaryLLM, localConfig.parserLLM, models]);

  const handlePresetConfig = (preset: keyof typeof RECOMMENDED_CONFIGS) => {
    const presetConfig = RECOMMENDED_CONFIGS[preset];
    setLocalConfig(prev => ({
      ...prev,
      primaryLLM: presetConfig.primary,
      parserLLM: presetConfig.parser,
    }));
  };

  const handleSave = () => {
    onSave(localConfig);
    const sessionId = getSessionIdFromUrl();
    setLocation(sessionId ? `/?session=${sessionId}` : '/');
  };

  const handleSaveApiKey = () => {
    onSave(localConfig);
    onRefreshModels();
  };

  const loadStorageBreakdown = async () => {
    const sessionId = getSessionIdFromUrl();
    if (!sessionId) {
      toast({
        title: "No session found",
        description: "Please start a game first to analyze storage.",
        variant: "destructive",
      });
      return;
    }

    setLoadingStorage(true);
    try {
      const breakdown = await analyzeStorageBreakdown(sessionId);
      setStorageBreakdown(breakdown);
      if (!breakdown) {
        toast({
          title: "No data found",
          description: "No game data found for this session.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error analyzing storage",
        description: "Could not analyze storage breakdown.",
        variant: "destructive",
      });
    } finally {
      setLoadingStorage(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b-2 border-border parchment-texture sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => {
                const sessionId = getSessionIdFromUrl();
                setLocation(sessionId ? `/?session=${sessionId}` : '/');
              }}
              variant="ghost"
              className="text-primary hover:bg-primary/10"
              data-testid="button-back-to-game"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Game
            </Button>
            <h1 className="text-3xl font-serif font-bold text-primary">Game Settings</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-card border-2 border-border ornate-border parchment-texture rounded-lg p-6">
          <Tabs defaultValue="api-key" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-muted/50 mb-6">
              <TabsTrigger value="api-key" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Key className="w-4 h-4 mr-2" />
                API Key
              </TabsTrigger>
              <TabsTrigger value="models" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Cpu className="w-4 h-4 mr-2" />
                Models
              </TabsTrigger>
              <TabsTrigger value="prompts" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <FileText className="w-4 h-4 mr-2" />
                Prompts
              </TabsTrigger>
              <TabsTrigger value="game" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Settings2 className="w-4 h-4 mr-2" />
                Game
              </TabsTrigger>
            </TabsList>

            {/* API Key Tab */}
            <TabsContent value="api-key" className="space-y-4">
              <div className="bg-muted/30 border border-border rounded-md p-6 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <label
                    htmlFor="use-dev-key"
                    className="text-sm font-medium leading-none"
                  >
                    Use default dev key (no personal API key needed)
                  </label>
                  <Switch
                    id="use-dev-key"
                    checked={useDevKey}
                    onCheckedChange={(checked) => {
                      setUseDevKey(checked);
                      if (checked) {
                        setLocalConfig(prev => ({ ...prev, openRouterApiKey: '' }));
                      }
                    }}
                    data-testid="switch-use-dev-key"
                  />
                </div>

                {!useDevKey && (
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-foreground">
                      OpenRouter API Key <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        type={showApiKey ? "text" : "password"}
                        value={localConfig.openRouterApiKey}
                        onChange={(e) => setLocalConfig(prev => ({ ...prev, openRouterApiKey: e.target.value }))}
                        placeholder="sk-or-v1-..."
                        className="font-mono text-sm bg-input border-border pr-10"
                        data-testid="input-api-key"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowApiKey(!showApiKey)}
                        data-testid="button-toggle-api-key-visibility"
                      >
                        {showApiKey ? (
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Get your API key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">openrouter.ai/keys</a>
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button 
                    onClick={handleSaveApiKey}
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                    data-testid="button-save-api-key"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Save & Load Models
                  </Button>
                </div>

                <div className="bg-accent/10 border border-accent rounded-md p-4 mt-4">
                  <p className="text-sm text-foreground">
                    <strong>Important:</strong> After configuring your API key settings, click "Save & Load Models" to fetch available models from OpenRouter.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Models Tab */}
            <TabsContent value="models" className="space-y-4">
              {models.length === 0 ? (
                <div className="bg-muted/30 border border-border rounded-md p-6 text-center space-y-4">
                  <p className="text-muted-foreground">No models loaded. Click "Save & Load Models" to fetch available models.</p>
                  <Button 
                    onClick={onRefreshModels}
                    variant="outline"
                    data-testid="button-refresh-models"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Models
                  </Button>
                </div>
              ) : (
                <>
                  {/* Model Search and Sort */}
                  <div className="bg-muted/30 border border-border rounded-md p-4 space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <Input
                          type="text"
                          placeholder="Search models by name..."
                          value={modelSearchQuery}
                          onChange={(e) => setModelSearchQuery(e.target.value)}
                          className="bg-input border-border"
                          data-testid="input-search-models"
                        />
                      </div>
                      <Select value={modelSortBy} onValueChange={(value: 'date' | 'name') => setModelSortBy(value)}>
                        <SelectTrigger className="w-[180px] bg-input border-border" data-testid="select-sort-models">
                          <SelectValue placeholder="Sort by..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="date">Sort by Date (Newest)</SelectItem>
                          <SelectItem value="name">Sort Alphabetically</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Primary LLM */}
                  <div className="bg-muted/30 border border-border rounded-md p-4 space-y-3">
                    <label className="block text-sm font-semibold text-foreground">
                      Primary LLM <span className="text-primary">(Narrative Generation)</span>
                    </label>
                    <Select 
                      value={localConfig.primaryLLM} 
                      onValueChange={(value) => setLocalConfig(prev => ({ ...prev, primaryLLM: value }))}
                    >
                      <SelectTrigger className="w-full bg-input border-border font-mono text-sm" data-testid="select-primary-llm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          let filteredModels = models.filter(model => 
                            model.name.toLowerCase().includes(modelSearchQuery.toLowerCase())
                          );
                          if (modelSortBy === 'name') {
                            filteredModels = [...filteredModels].sort((a, b) => a.name.localeCompare(b.name));
                          }
                          return filteredModels.map(model => (
                            <SelectItem key={model.id} value={model.id} className="font-mono text-sm">
                              {model.name} - ${estimateTurnCost(model.pricing, { prompt: '0', completion: '0' }).toFixed(4)}/turn
                            </SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Parser LLM */}
                  <div className="bg-muted/30 border border-border rounded-md p-4 space-y-3">
                    <label className="block text-sm font-semibold text-foreground">
                      Parser LLM <span className="text-primary">(State Extraction)</span>
                    </label>
                    <Select 
                      value={localConfig.parserLLM} 
                      onValueChange={(value) => setLocalConfig(prev => ({ ...prev, parserLLM: value }))}
                    >
                      <SelectTrigger className="w-full bg-input border-border font-mono text-sm" data-testid="select-parser-llm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          let filteredModels = models.filter(model => 
                            model.name.toLowerCase().includes(modelSearchQuery.toLowerCase())
                          );
                          if (modelSortBy === 'name') {
                            filteredModels = [...filteredModels].sort((a, b) => a.name.localeCompare(b.name));
                          }
                          return filteredModels.map(model => (
                            <SelectItem key={model.id} value={model.id} className="font-mono text-sm">
                              {model.name} - ${estimateTurnCost(model.pricing, { prompt: '0', completion: '0' }).toFixed(4)}/turn
                            </SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Backstory LLM */}
                  <div className="bg-muted/30 border border-border rounded-md p-4 space-y-3">
                    <label className="block text-sm font-semibold text-foreground">
                      Backstory LLM <span className="text-primary">(Backstory Generation)</span>
                    </label>
                    <Select 
                      value={localConfig.backstoryLLM} 
                      onValueChange={(value) => setLocalConfig(prev => ({ ...prev, backstoryLLM: value }))}
                    >
                      <SelectTrigger className="w-full bg-input border-border font-mono text-sm" data-testid="select-backstory-llm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          let filteredModels = models.filter(model => 
                            model.name.toLowerCase().includes(modelSearchQuery.toLowerCase())
                          );
                          if (modelSortBy === 'name') {
                            filteredModels = [...filteredModels].sort((a, b) => a.name.localeCompare(b.name));
                          }
                          return filteredModels.map(model => (
                            <SelectItem key={model.id} value={model.id} className="font-mono text-sm">
                              {model.name} - ${estimateTurnCost(model.pricing, { prompt: '0', completion: '0' }).toFixed(4)}/turn
                            </SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Backstory Parser LLM */}
                  <div className="bg-muted/30 border border-border rounded-md p-4 space-y-3">
                    <label className="block text-sm font-semibold text-foreground">
                      Backstory Parser LLM <span className="text-primary">(Entity Detail Extraction)</span>
                    </label>
                    <Select 
                      value={localConfig.backstoryParserLLM} 
                      onValueChange={(value) => setLocalConfig(prev => ({ ...prev, backstoryParserLLM: value }))}
                    >
                      <SelectTrigger className="w-full bg-input border-border font-mono text-sm" data-testid="select-backstory-parser-llm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          let filteredModels = models.filter(model => 
                            model.name.toLowerCase().includes(modelSearchQuery.toLowerCase())
                          );
                          if (modelSortBy === 'name') {
                            filteredModels = [...filteredModels].sort((a, b) => a.name.localeCompare(b.name));
                          }
                          return filteredModels.map(model => (
                            <SelectItem key={model.id} value={model.id} className="font-mono text-sm">
                              {model.name} - ${estimateTurnCost(model.pricing, { prompt: '0', completion: '0' }).toFixed(4)}/turn
                            </SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Revelations LLM */}
                  <div className="bg-muted/30 border border-border rounded-md p-4 space-y-3">
                    <label className="block text-sm font-semibold text-foreground">
                      Revelations LLM <span className="text-primary">(Backstory Revelation Tracking)</span>
                    </label>
                    <Select 
                      value={localConfig.revelationsLLM} 
                      onValueChange={(value) => setLocalConfig(prev => ({ ...prev, revelationsLLM: value }))}
                    >
                      <SelectTrigger className="w-full bg-input border-border font-mono text-sm" data-testid="select-revelations-llm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          let filteredModels = models.filter(model => 
                            model.name.toLowerCase().includes(modelSearchQuery.toLowerCase())
                          );
                          if (modelSortBy === 'name') {
                            filteredModels = [...filteredModels].sort((a, b) => a.name.localeCompare(b.name));
                          }
                          return filteredModels.map(model => (
                            <SelectItem key={model.id} value={model.id} className="font-mono text-sm">
                              {model.name} - ${estimateTurnCost(model.pricing, { prompt: '0', completion: '0' }).toFixed(4)}/turn
                            </SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Lore LLM */}
                  <div className="bg-muted/30 border border-border rounded-md p-4 space-y-3">
                    <label className="block text-sm font-semibold text-foreground">
                      Lore LLM <span className="text-primary">(World Lore Generation)</span>
                    </label>
                    <Select 
                      value={localConfig.loreLLM} 
                      onValueChange={(value) => setLocalConfig(prev => ({ ...prev, loreLLM: value }))}
                    >
                      <SelectTrigger className="w-full bg-input border-border font-mono text-sm" data-testid="select-lore-llm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          let filteredModels = models.filter(model => 
                            model.name.toLowerCase().includes(modelSearchQuery.toLowerCase())
                          );
                          if (modelSortBy === 'name') {
                            filteredModels = [...filteredModels].sort((a, b) => a.name.localeCompare(b.name));
                          }
                          return filteredModels.map(model => (
                            <SelectItem key={model.id} value={model.id} className="font-mono text-sm">
                              {model.name} - ${estimateTurnCost(model.pricing, { prompt: '0', completion: '0' }).toFixed(4)}/turn
                            </SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Cost Estimate */}
                  <div className="bg-accent/10 border-2 border-accent rounded-md p-4 glow-effect">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">Estimated Cost per Turn:</span>
                      <span className="text-2xl font-mono font-bold text-accent" data-testid="text-estimated-cost">
                        ${estimatedCost.toFixed(4)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Based on ~1500 prompt + 600 completion tokens</p>
                  </div>

                  {/* Presets */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">Quick Presets:</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <Button 
                        onClick={() => handlePresetConfig('premium')}
                        className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground h-auto py-3"
                        data-testid="button-preset-premium"
                      >
                        <Sparkles className="w-5 h-5 mr-2" />
                        <div className="text-left">
                          <div className="text-sm font-semibold">Premium</div>
                          <div className="text-xs opacity-80">Best quality</div>
                        </div>
                      </Button>

                      <Button 
                        onClick={() => handlePresetConfig('balanced')}
                        className="bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 text-accent-foreground h-auto py-3"
                        data-testid="button-preset-balanced"
                      >
                        <Scale className="w-5 h-5 mr-2" />
                        <div className="text-left">
                          <div className="text-sm font-semibold">Balanced</div>
                          <div className="text-xs opacity-80">Great value</div>
                        </div>
                      </Button>

                      <Button 
                        onClick={() => handlePresetConfig('budget')}
                        className="bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/90 hover:to-secondary/70 text-secondary-foreground h-auto py-3"
                        data-testid="button-preset-budget"
                      >
                        <DollarSign className="w-5 h-5 mr-2" />
                        <div className="text-left">
                          <div className="text-sm font-semibold">Budget</div>
                          <div className="text-xs opacity-80">Cost effective</div>
                        </div>
                      </Button>

                      <Button 
                        onClick={() => handlePresetConfig('experimental')}
                        className="bg-gradient-to-r from-muted to-muted/80 hover:from-muted/90 hover:to-muted/70 text-foreground h-auto py-3"
                        data-testid="button-preset-experimental"
                      >
                        <FlaskConical className="w-5 h-5 mr-2" />
                        <div className="text-left">
                          <div className="text-sm font-semibold">Experimental</div>
                          <div className="text-xs opacity-80">Open source</div>
                        </div>
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Prompts Tab */}
            <TabsContent value="prompts" className="space-y-4">
              {/* DM Prompt */}
              <div className="bg-muted/30 border border-border rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-foreground">
                    Dungeon Master Prompt <span className="text-primary">(Narrative Generation)</span>
                  </label>
                  <Button
                    onClick={() => handleResetPrompt('primary')}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    data-testid="button-reset-dm-prompt"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset to Default
                  </Button>
                </div>
                <Textarea
                  value={localConfig.dmSystemPrompt}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, dmSystemPrompt: e.target.value }))}
                  rows={10}
                  className="font-mono text-xs bg-input border-border"
                  data-testid="textarea-dm-prompt"
                />
              </div>

              {/* Parser Prompt */}
              <div className="bg-muted/30 border border-border rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-foreground">
                    Parser Prompt <span className="text-primary">(State Extraction)</span>
                  </label>
                  <Button
                    onClick={() => handleResetPrompt('parser')}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    data-testid="button-reset-parser-prompt"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset to Default
                  </Button>
                </div>
                <Textarea
                  value={localConfig.parserSystemPrompt}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, parserSystemPrompt: e.target.value }))}
                  rows={10}
                  className="font-mono text-xs bg-input border-border"
                  data-testid="textarea-parser-prompt"
                />
              </div>

              {/* Image Provider Selection */}
              <div className="bg-muted/30 border border-border rounded-md p-4 space-y-3">
                <label className="block text-sm font-semibold text-foreground">
                  Image Provider <span className="text-primary">(Image Generation)</span>
                </label>
                <Select
                  value={localConfig.imageProvider}
                  onValueChange={(value: 'flux' | 'gemini') => setLocalConfig(prev => ({ ...prev, imageProvider: value }))}
                >
                  <SelectTrigger className="w-full" data-testid="select-image-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flux" data-testid="option-flux">Flux 1.1 Schnell (RunPod) - 512x512 PNG</SelectItem>
                    <SelectItem value="gemini" data-testid="option-gemini">Gemini 2.5 Flash (OpenRouter) - Variable size</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose between Flux 1.1 Schnell (fast, consistent 512x512 PNG) or Gemini 2.5 Flash (variable resolution)
                </p>
              </div>

              {/* Character Image Prompt */}
              <div className="bg-muted/30 border border-border rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-foreground">
                    Character Image Prompt <span className="text-primary">(Image Generation)</span>
                  </label>
                  <Button
                    onClick={() => handleResetPrompt('imageCharacter')}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    data-testid="button-reset-character-image-prompt"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset to Default
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  JSON template for character images. Use placeholders: [age], [sex], [race], [class], [name]
                </p>
                <Textarea
                  value={localConfig.characterImagePrompt}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, characterImagePrompt: e.target.value }))}
                  rows={10}
                  className="font-mono text-xs bg-input border-border"
                  data-testid="textarea-character-image-prompt"
                />
              </div>

              {/* Location Image Prompt */}
              <div className="bg-muted/30 border border-border rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-foreground">
                    Location Image Prompt <span className="text-primary">(Image Generation)</span>
                  </label>
                  <Button
                    onClick={() => handleResetPrompt('imageLocation')}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    data-testid="button-reset-location-image-prompt"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset to Default
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  JSON template for location images. Use placeholders: [location_name], [location_description]
                </p>
                <Textarea
                  value={localConfig.locationImagePrompt}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, locationImagePrompt: e.target.value }))}
                  rows={10}
                  className="font-mono text-xs bg-input border-border"
                  data-testid="textarea-location-image-prompt"
                />
              </div>

              {/* Backstory Prompt */}
              <div className="bg-muted/30 border border-border rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-foreground">
                    Backstory Prompt <span className="text-primary">(Backstory Generation)</span>
                  </label>
                  <Button
                    onClick={() => handleResetPrompt('backstory')}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    data-testid="button-reset-backstory-prompt"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset to Default
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  System prompt for generating backstories for NPCs, companions, quests, and locations
                </p>
                <Textarea
                  value={localConfig.backstorySystemPrompt}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, backstorySystemPrompt: e.target.value }))}
                  rows={10}
                  className="font-mono text-xs bg-input border-border"
                  data-testid="textarea-backstory-prompt"
                />
              </div>

              {/* Backstory Parser Prompt */}
              <div className="bg-muted/30 border border-border rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-foreground">
                    Backstory Parser Prompt <span className="text-primary">(Entity Detail Extraction)</span>
                  </label>
                  <Button
                    onClick={() => handleResetPrompt('backstoryparser')}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    data-testid="button-reset-backstory-parser-prompt"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset to Default
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  System prompt for extracting entity details from generated backstories (updates NPC, companion, and location fields)
                </p>
                <Textarea
                  value={localConfig.backstoryParserPrompt}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, backstoryParserPrompt: e.target.value }))}
                  rows={10}
                  className="font-mono text-xs bg-input border-border"
                  data-testid="textarea-backstory-parser-prompt"
                />
              </div>

              {/* Revelations Prompt */}
              <div className="bg-muted/30 border border-border rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-foreground">
                    Revelations Prompt <span className="text-primary">(Backstory Revelation Tracking)</span>
                  </label>
                  <Button
                    onClick={() => handleResetPrompt('revelations')}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    data-testid="button-reset-revelations-prompt"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset to Default
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  System prompt for tracking when backstory elements are revealed during gameplay
                </p>
                <Textarea
                  value={localConfig.revelationsSystemPrompt}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, revelationsSystemPrompt: e.target.value }))}
                  rows={10}
                  className="font-mono text-xs bg-input border-border"
                  data-testid="textarea-revelations-prompt"
                />
              </div>

              {/* Lore Prompt */}
              <div className="bg-muted/30 border border-border rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-foreground">
                    Lore Prompt <span className="text-primary">(World Lore Generation)</span>
                  </label>
                  <Button
                    onClick={() => handleResetPrompt('lore')}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    data-testid="button-reset-lore-prompt"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset to Default
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  System prompt for generating comprehensive world lore with geography, history, factions, and relationships
                </p>
                <Textarea
                  value={localConfig.loreSystemPrompt}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, loreSystemPrompt: e.target.value }))}
                  rows={10}
                  className="font-mono text-xs bg-input border-border"
                  data-testid="textarea-lore-prompt"
                />
              </div>
            </TabsContent>

            {/* Game Settings Tab */}
            <TabsContent value="game" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">Difficulty</label>
                  <Select 
                    value={localConfig.difficulty} 
                    onValueChange={(value: any) => setLocalConfig(prev => ({ ...prev, difficulty: value }))}
                  >
                    <SelectTrigger className="w-full bg-input border-border" data-testid="select-difficulty">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                      <SelectItem value="deadly">Deadly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">Narrative Style</label>
                  <Select 
                    value={localConfig.narrativeStyle} 
                    onValueChange={(value: any) => setLocalConfig(prev => ({ ...prev, narrativeStyle: value }))}
                  >
                    <SelectTrigger className="w-full bg-input border-border" data-testid="select-narrative-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="concise">Concise</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="detailed">Detailed</SelectItem>
                      <SelectItem value="verbose">Verbose</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">UI Scale</label>
                  <Select 
                    value={localConfig.uiScale} 
                    onValueChange={(value: any) => setLocalConfig(prev => ({ ...prev, uiScale: value }))}
                  >
                    <SelectTrigger className="w-full bg-input border-border" data-testid="select-ui-scale">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compact">Compact (80%)</SelectItem>
                      <SelectItem value="comfortable">Comfortable (100%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between bg-muted/30 border border-border rounded-md p-4">
                <div>
                  <div className="text-sm font-medium text-foreground">Auto-save</div>
                  <div className="text-xs text-muted-foreground">Save game state every 5 turns</div>
                </div>
                <Switch 
                  checked={localConfig.autoSave} 
                  onCheckedChange={(checked) => setLocalConfig(prev => ({ ...prev, autoSave: checked }))}
                  data-testid="switch-autosave"
                />
              </div>

              <div className="flex items-center justify-between bg-muted/30 border border-border rounded-md p-4">
                <div>
                  <div className="text-sm font-medium text-foreground">Auto-generate Images</div>
                  <div className="text-xs text-muted-foreground">Automatically create images for characters and locations using AI</div>
                </div>
                <Switch 
                  checked={localConfig.autoGenerateImages} 
                  onCheckedChange={(checked) => setLocalConfig(prev => ({ ...prev, autoGenerateImages: checked }))}
                  data-testid="switch-auto-generate-images"
                />
              </div>

              <div className="flex items-center justify-between bg-muted/30 border border-border rounded-md p-4">
                <div>
                  <div className="text-sm font-medium text-foreground">Auto-generate Backstories</div>
                  <div className="text-xs text-muted-foreground">Automatically create rich backstories for NPCs, companions, quests, and locations</div>
                </div>
                <Switch 
                  checked={localConfig.autoGenerateBackstories} 
                  onCheckedChange={(checked) => setLocalConfig(prev => ({ ...prev, autoGenerateBackstories: checked }))}
                  data-testid="switch-auto-generate-backstories"
                />
              </div>

              <div className="flex items-center justify-between bg-muted/30 border border-border rounded-md p-4">
                <div>
                  <div className="text-sm font-medium text-foreground">Auto-track Revelations</div>
                  <div className="text-xs text-muted-foreground">Automatically detect and record backstory revelations from narrative</div>
                </div>
                <Switch 
                  checked={localConfig.autoGenerateRevelations} 
                  onCheckedChange={(checked) => setLocalConfig(prev => ({ ...prev, autoGenerateRevelations: checked }))}
                  data-testid="switch-auto-track-revelations"
                />
              </div>

              <div className="flex items-center justify-between bg-muted/30 border border-border rounded-md p-4">
                <div>
                  <div className="text-sm font-medium text-foreground">Auto-generate World Lore</div>
                  <div className="text-xs text-muted-foreground">Automatically generate comprehensive world lore after visiting first location</div>
                </div>
                <Switch 
                  checked={localConfig.autoGenerateLore} 
                  onCheckedChange={(checked) => setLocalConfig(prev => ({ ...prev, autoGenerateLore: checked }))}
                  data-testid="switch-auto-generate-lore"
                />
              </div>

              {/* Storage Analysis */}
              <div className="bg-accent/10 border-2 border-accent rounded-md p-4 glow-effect">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-accent" />
                    <span className="text-sm font-semibold text-foreground">Storage Analysis</span>
                  </div>
                  <Button
                    onClick={loadStorageBreakdown}
                    disabled={loadingStorage}
                    variant="outline"
                    size="sm"
                    data-testid="button-analyze-storage"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loadingStorage ? 'animate-spin' : ''}`} />
                    {loadingStorage ? 'Analyzing...' : 'Analyze Storage'}
                  </Button>
                </div>

                {storageBreakdown && (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="bg-background/50 rounded p-3">
                        <div className="text-xs text-muted-foreground">Uncompressed</div>
                        <div className="text-lg font-bold text-accent" data-testid="text-storage-uncompressed">
                          {formatBytes(storageBreakdown.totalUncompressed)}
                        </div>
                      </div>
                      <div className="bg-background/50 rounded p-3">
                        <div className="text-xs text-muted-foreground">Compressed</div>
                        <div className="text-lg font-bold text-accent" data-testid="text-storage-compressed">
                          {formatBytes(storageBreakdown.totalCompressed)}
                        </div>
                      </div>
                      <div className="bg-background/50 rounded p-3">
                        <div className="text-xs text-muted-foreground">Compression</div>
                        <div className="text-lg font-bold text-accent" data-testid="text-storage-compression">
                          {storageBreakdown.compressionRatio.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {/* Detailed Breakdown */}
                    <Collapsible open={storageExpanded} onOpenChange={setStorageExpanded}>
                      <CollapsibleTrigger className="w-full" data-testid="button-toggle-storage-details">
                        <div className="flex items-center justify-between p-2 bg-background/30 rounded hover:bg-background/50 transition-colors">
                          <span className="text-sm font-medium">Detailed Breakdown</span>
                          <ChevronDown className={`w-4 h-4 transition-transform ${storageExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-3">
                        {/* Game State Breakdown */}
                        <div className="bg-background/30 rounded p-3">
                          <div className="text-sm font-medium mb-2 flex items-center justify-between">
                            <span>Game State</span>
                            <span className="text-accent">{formatBytes(storageBreakdown.components.gameState.total)}</span>
                          </div>
                          <div className="space-y-1 text-xs">
                            {Object.entries(storageBreakdown.components.gameState).map(([key, value]) => {
                              if (key === 'total') return null;
                              return (
                                <div key={key} className="flex justify-between text-muted-foreground" data-testid={`text-storage-gamestate-${key}`}>
                                  <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                  <span>{formatBytes(value)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Other Components */}
                        <div className="bg-background/30 rounded p-3">
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between" data-testid="text-storage-config">
                              <span className="text-muted-foreground">Game Config</span>
                              <span className="text-accent">{formatBytes(storageBreakdown.components.gameConfig)}</span>
                            </div>
                            <div className="flex justify-between" data-testid="text-storage-cost">
                              <span className="text-muted-foreground">Cost Tracker</span>
                              <span className="text-accent">{formatBytes(storageBreakdown.components.costTracker)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Snapshots */}
                        <div className="bg-background/30 rounded p-3">
                          <div className="text-sm font-medium mb-2 flex items-center justify-between">
                            <span>Turn Snapshots ({storageBreakdown.components.turnSnapshots.count})</span>
                            <span className="text-accent">{formatBytes(storageBreakdown.components.turnSnapshots.total)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            Average: {formatBytes(storageBreakdown.components.turnSnapshots.averageSize)}
                          </div>
                          {storageBreakdown.components.turnSnapshots.breakdown.length > 0 && (
                            <div className="space-y-1 text-xs max-h-40 overflow-y-auto">
                              {storageBreakdown.components.turnSnapshots.breakdown.map((snapshot, idx) => (
                                <div key={idx} className="flex justify-between text-muted-foreground" data-testid={`text-storage-snapshot-${idx}`}>
                                  <span>{snapshot.turn} turns ago</span>
                                  <span>{formatBytes(snapshot.size)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}

                {!storageBreakdown && !loadingStorage && (
                  <p className="text-xs text-muted-foreground text-center">
                    Click "Analyze Storage" to see detailed breakdown of your game's storage usage
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6 mt-6 border-t border-border">
            <Button 
              onClick={handleSave} 
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              data-testid="button-save-settings"
            >
              Save & Return to Game
            </Button>
            <Button 
              onClick={() => setLocation('/')} 
              variant="outline"
              className="bg-muted hover:bg-muted/80"
              data-testid="button-cancel-settings"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
