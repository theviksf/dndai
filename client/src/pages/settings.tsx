import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { GameConfig, OpenRouterModel } from '@shared/schema';
import { RECOMMENDED_CONFIGS, estimateTurnCost } from '@/lib/openrouter';
import { Cpu, Key, Settings2, Sparkles, Scale, DollarSign, FlaskConical, FileText, RefreshCw, ArrowLeft } from 'lucide-react';

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
  
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

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
    setLocation('/');
  };

  const handleSaveApiKey = () => {
    onSave(localConfig);
    onRefreshModels();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b-2 border-border parchment-texture sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setLocation('/')}
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
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-foreground">
                    OpenRouter API Key <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="password"
                    value={localConfig.openRouterApiKey}
                    onChange={(e) => setLocalConfig(prev => ({ ...prev, openRouterApiKey: e.target.value }))}
                    placeholder="sk-or-v1-..."
                    className="font-mono text-sm bg-input border-border"
                    data-testid="input-api-key"
                  />
                  <p className="text-xs text-muted-foreground">
                    Get your API key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">openrouter.ai/keys</a>
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button 
                    onClick={handleSaveApiKey}
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                    data-testid="button-save-api-key"
                    disabled={!localConfig.openRouterApiKey}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Save & Load Models
                  </Button>
                </div>

                <div className="bg-accent/10 border border-accent rounded-md p-4 mt-4">
                  <p className="text-sm text-foreground">
                    <strong>Important:</strong> After entering your API key, click "Save & Load Models" to fetch available models from OpenRouter.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Models Tab */}
            <TabsContent value="models" className="space-y-4">
              {models.length === 0 ? (
                <div className="bg-muted/30 border border-border rounded-md p-6 text-center space-y-4">
                  <p className="text-muted-foreground">No models loaded. Please enter your API key in the API Key tab first.</p>
                  <Button 
                    onClick={onRefreshModels}
                    variant="outline"
                    disabled={!localConfig.openRouterApiKey}
                    data-testid="button-refresh-models"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Models
                  </Button>
                </div>
              ) : (
                <>
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
                        {models.map(model => (
                          <SelectItem key={model.id} value={model.id} className="font-mono text-sm">
                            {model.name} - ${estimateTurnCost(model.pricing, { prompt: '0', completion: '0' }).toFixed(4)}/turn
                          </SelectItem>
                        ))}
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
                        {models.map(model => (
                          <SelectItem key={model.id} value={model.id} className="font-mono text-sm">
                            {model.name} - ${estimateTurnCost(model.pricing, { prompt: '0', completion: '0' }).toFixed(4)}/turn
                          </SelectItem>
                        ))}
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
                <label className="block text-sm font-semibold text-foreground">
                  Dungeon Master Prompt <span className="text-primary">(Narrative Generation)</span>
                </label>
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
                <label className="block text-sm font-semibold text-foreground">
                  Parser Prompt <span className="text-primary">(State Extraction)</span>
                </label>
                <Textarea
                  value={localConfig.parserSystemPrompt}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, parserSystemPrompt: e.target.value }))}
                  rows={10}
                  className="font-mono text-xs bg-input border-border"
                  data-testid="textarea-parser-prompt"
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
