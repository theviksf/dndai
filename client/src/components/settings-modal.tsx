import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { GameConfig, OpenRouterModel } from '@shared/schema';
import { RECOMMENDED_CONFIGS, estimateTurnCost } from '@/lib/openrouter';
import { Cpu, Key, Settings2, Sparkles, Scale, DollarSign, FlaskConical, FileText } from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: GameConfig;
  onSave: (config: GameConfig) => void;
  models: OpenRouterModel[];
}

export default function SettingsModal({ open, onOpenChange, config, onSave, models }: SettingsModalProps) {
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-2 border-border ornate-border parchment-texture">
        <DialogHeader>
          <DialogTitle className="text-3xl font-serif font-bold text-primary">Game Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* API Key */}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <Key className="w-6 h-6 text-primary" />
              <h3 className="text-xl font-serif font-semibold text-primary">OpenRouter API Key</h3>
            </div>
            <div className="bg-muted/30 border border-border rounded-md p-4 space-y-3">
              <label className="block text-sm font-semibold text-foreground">
                API Key <span className="text-destructive">*</span>
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
          </section>

          {/* LLM Configuration */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Cpu className="w-6 h-6 text-primary" />
              <h3 className="text-xl font-serif font-semibold text-primary">LLM Configuration</h3>
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
          </section>

          {/* Prompts */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-primary" />
              <h3 className="text-xl font-serif font-semibold text-primary">System Prompts</h3>
            </div>

            {/* DM Prompt */}
            <div className="bg-muted/30 border border-border rounded-md p-4 space-y-3">
              <label className="block text-sm font-semibold text-foreground">
                Dungeon Master Prompt <span className="text-primary">(Narrative Generation)</span>
              </label>
              <Textarea
                value={localConfig.dmSystemPrompt}
                onChange={(e) => setLocalConfig(prev => ({ ...prev, dmSystemPrompt: e.target.value }))}
                rows={6}
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
                rows={6}
                className="font-mono text-xs bg-input border-border"
                data-testid="textarea-parser-prompt"
              />
            </div>
          </section>

          {/* Game Settings */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Settings2 className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-serif font-semibold text-primary">Game Settings</h3>
            </div>

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
          </section>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button 
              onClick={handleSave} 
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              data-testid="button-save-settings"
            >
              Save & Start Game
            </Button>
            <Button 
              onClick={() => onOpenChange(false)} 
              variant="outline"
              className="bg-muted hover:bg-muted/80"
              data-testid="button-cancel-settings"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
