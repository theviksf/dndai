import { Heart, Coins, MapPin, Zap } from 'lucide-react';
import type { GameCharacter, StatusEffect, GameStateData } from '@shared/schema';

interface CharacterStatsBarProps {
  character: GameCharacter;
  statusEffects: StatusEffect[];
  location: GameStateData['location'];
}

export default function CharacterStatsBar({ character, statusEffects, location }: CharacterStatsBarProps) {
  return (
    <div className="bg-card border-b-2 border-border parchment-texture">
      <div className="max-w-[1920px] mx-auto px-4 py-2">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {/* Character Name & Level */}
          <div className="flex items-center gap-2 font-semibold">
            <span className="text-primary" data-testid="text-character-name">{character.name}</span>
            <span className="text-muted-foreground">
              Lv.{character.level} {character.race} {character.class}
            </span>
          </div>

          {/* HP */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-destructive/10 rounded-md border border-destructive/20">
            <Heart className="w-4 h-4 text-destructive" />
            <span className="font-mono font-semibold" data-testid="text-character-hp">
              {character.hp}/{character.maxHp}
            </span>
          </div>

          {/* Gold */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 rounded-md border border-yellow-500/20">
            <Coins className="w-4 h-4 text-yellow-600 dark:text-yellow-500" />
            <span className="font-mono font-semibold" data-testid="text-character-gold">
              {character.gold}
            </span>
          </div>

          {/* Location */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 rounded-md border border-primary/20">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="font-medium" data-testid="text-location">
              {location?.name || 'Unknown'}
            </span>
          </div>

          {/* Attributes */}
          <div className="flex items-center gap-2 px-3 py-1 bg-muted/50 rounded-md border border-border">
            <Zap className="w-4 h-4 text-muted-foreground" />
            <div className="flex gap-3 text-xs font-mono">
              <span data-testid="text-str">STR {character.attributes.str}</span>
              <span data-testid="text-dex">DEX {character.attributes.dex}</span>
              <span data-testid="text-con">CON {character.attributes.con}</span>
              <span data-testid="text-int">INT {character.attributes.int}</span>
              <span data-testid="text-wis">WIS {character.attributes.wis}</span>
              <span data-testid="text-cha">CHA {character.attributes.cha}</span>
            </div>
          </div>

          {/* Status Effects */}
          {statusEffects.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 bg-accent/10 rounded-md border border-accent/20">
              <span className="text-xs font-medium text-accent">Effects:</span>
              <div className="flex gap-2">
                {statusEffects.map((effect, index) => (
                  <span 
                    key={index} 
                    className="text-xs font-medium text-accent-foreground"
                    data-testid={`status-effect-${index}`}
                  >
                    {effect.name} ({effect.turnsRemaining})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
