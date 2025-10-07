import type { GameStateData } from '@shared/schema';
import { formatModifier } from '@/lib/game-state';
import { BarChart3, MapPin, Sparkles, Wand2 } from 'lucide-react';

interface CharacterStatsProps {
  character: GameStateData['character'];
  statusEffects: GameStateData['statusEffects'];
  location: GameStateData['location'];
  spells: GameStateData['spells'];
  businesses?: GameStateData['businesses'];
}

export default function CharacterStats({ character, statusEffects, location, spells = [], businesses = [] }: CharacterStatsProps) {
  const hpPercent = (character.hp / character.maxHp) * 100;
  const xpPercent = (character.xp / character.nextLevelXp) * 100;
  
  // Calculate total weekly income from all businesses
  const weeklyIncome = businesses.reduce((total, business) => {
    return total + (business.weeklyIncome - business.runningCost);
  }, 0);

  return (
    <aside className="lg:col-span-3 space-y-4">
      {/* Character Card */}
      <div className="bg-card border-2 border-border rounded-lg ornate-border parchment-texture overflow-hidden">
        <div className="bg-gradient-to-b from-primary/20 to-transparent p-4 border-b border-border">
          <h2 className="text-xl font-serif font-bold text-primary" data-testid="text-character-name">
            {character.name || 'Character'}
          </h2>
          <div className="text-sm text-muted-foreground mt-1">
            <span data-testid="text-character-race">{character.race}</span>{' '}
            <span data-testid="text-character-class">{character.class}</span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Level & XP */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Level <span className="text-primary font-mono" data-testid="text-character-level">{character.level}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                <span className="font-mono" data-testid="text-character-xp">{character.xp}</span> /{' '}
                <span data-testid="text-character-next-level-xp">{character.nextLevelXp}</span> XP
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-accent h-2 rounded-full transition-all" style={{ width: `${xpPercent}%` }} />
            </div>
          </div>

          {/* Health */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground">Health</span>
              <span className="text-xs font-mono text-destructive">
                <span data-testid="text-character-hp">{character.hp}</span> /{' '}
                <span data-testid="text-character-max-hp">{character.maxHp}</span> HP
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-destructive to-secondary h-3 rounded-full transition-all" 
                style={{ width: `${hpPercent}%` }} 
              />
            </div>
          </div>

          {/* Gold & Weekly Income */}
          <div className="bg-primary/10 border border-primary/30 rounded-md p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Gold</span>
              <span className="text-lg font-mono font-bold text-primary" data-testid="text-character-gold">
                {character.gold}
              </span>
            </div>
            {businesses.length > 0 && (
              <div className="flex items-center justify-between mt-1 pt-1 border-t border-primary/20">
                <span className="text-xs text-muted-foreground">Weekly Income</span>
                <span className={`text-xs font-mono font-semibold ${
                  weeklyIncome > 0 
                    ? 'text-green-600 dark:text-green-500' 
                    : weeklyIncome < 0 
                    ? 'text-red-600 dark:text-red-500' 
                    : 'text-muted-foreground'
                }`} data-testid="text-weekly-income">
                  {weeklyIncome > 0 ? '+' : ''}{weeklyIncome.toLocaleString()} gp
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Attributes */}
      <div className="bg-card border-2 border-border rounded-lg ornate-border parchment-texture p-4">
        <h3 className="text-lg font-serif font-semibold text-primary mb-3 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Attributes
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(character.attributes).map(([key, value]) => (
            <div key={key} className="bg-muted/30 border border-border rounded-md p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1 uppercase">{key}</div>
              <div className="text-2xl font-mono font-bold text-primary" data-testid={`text-attribute-${key}`}>
                {value}
              </div>
              <div className="text-xs text-muted-foreground">{formatModifier(value)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Status Effects */}
      <div className="bg-card border-2 border-border rounded-lg ornate-border parchment-texture p-4">
        <h3 className="text-lg font-serif font-semibold text-primary mb-3 flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Status Effects
        </h3>
        <div className="space-y-2">
          {statusEffects.length > 0 ? (
            statusEffects.map(effect => (
              <div 
                key={effect.id} 
                className="bg-accent/10 border border-accent rounded-md p-2 flex items-center justify-between"
                data-testid={`status-effect-${effect.id}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{effect.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-foreground">{effect.name}</div>
                    <div className="text-xs text-muted-foreground">{effect.description}</div>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{effect.turnsRemaining} turns</span>
              </div>
            ))
          ) : (
            <div className="text-center py-2 text-xs text-muted-foreground">No active effects</div>
          )}
        </div>
      </div>

      {/* Spells */}
      <div className="bg-card border-2 border-border rounded-lg ornate-border parchment-texture p-4">
        <h3 className="text-lg font-serif font-semibold text-primary mb-3 flex items-center gap-2">
          <Wand2 className="w-5 h-5" />
          Spells
        </h3>
        <div className="space-y-2">
          {spells.length > 0 ? (
            spells.map(spell => (
              <div 
                key={spell.id} 
                className="bg-accent/10 border border-accent rounded-md p-2"
                data-testid={`spell-${spell.id}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{spell.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-foreground">{spell.name}</div>
                      <div className="text-xs text-muted-foreground">Lvl {spell.level}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{spell.school}</div>
                    <div className="text-xs text-muted-foreground mt-1">{spell.description}</div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-2 text-xs text-muted-foreground">No spells learned</div>
          )}
        </div>
      </div>

      {/* Location */}
      <div className="bg-card border-2 border-border rounded-lg ornate-border parchment-texture p-4">
        <h3 className="text-lg font-serif font-semibold text-primary mb-2 flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Current Location
        </h3>
        <div className="text-sm text-foreground" data-testid="text-location-name">{location.name}</div>
        <div className="text-xs text-muted-foreground mt-1" data-testid="text-location-description">
          {location.description}
        </div>
      </div>
    </aside>
  );
}
