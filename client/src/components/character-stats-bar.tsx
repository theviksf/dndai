import { Heart, Coins, MapPin, Zap, Shield } from 'lucide-react';
import type { GameCharacter, StatusEffect, GameStateData } from '@shared/schema';
import { InlineEdit } from '@/components/ui/inline-edit';

interface CharacterStatsBarProps {
  character: GameCharacter;
  statusEffects: StatusEffect[];
  location: GameStateData['location'];
  onUpdate?: (updates: Partial<GameStateData>) => void;
}

function getModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export default function CharacterStatsBar({ character, statusEffects, location, onUpdate }: CharacterStatsBarProps) {
  const hpPercentage = (character.hp / character.maxHp) * 100;
  
  return (
    <div className="bg-card border-b-2 border-border parchment-texture">
      <div className="max-w-[1920px] mx-auto px-4 py-3">
        {/* Row 1: Character Info, HP Bar, Gold, Location */}
        <div className="flex flex-wrap items-center gap-4 mb-3">
          {/* Character Name & Level */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              {onUpdate ? (
                <InlineEdit
                  value={character.name}
                  onSave={(value) => onUpdate({ character: { name: String(value) } })}
                  className="text-lg font-bold text-primary"
                  inputClassName="text-lg font-bold"
                />
              ) : (
                <span className="text-lg font-bold text-primary" data-testid="text-character-name">
                  {character.name}
                </span>
              )}
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                Lv.
                {onUpdate ? (
                  <InlineEdit
                    value={character.level}
                    onSave={(value) => onUpdate({ character: { level: Number(value) } })}
                    type="number"
                    min={1}
                    max={20}
                    className="font-normal"
                    inputClassName="w-16 h-6 text-xs"
                  />
                ) : (
                  <span>{character.level}</span>
                )}
                {' '}
                {onUpdate ? (
                  <InlineEdit
                    value={character.race}
                    onSave={(value) => onUpdate({ character: { race: String(value) } })}
                    className="font-normal"
                    inputClassName="h-6 text-xs"
                  />
                ) : (
                  <span>{character.race}</span>
                )}
                {' '}
                {onUpdate ? (
                  <InlineEdit
                    value={character.class}
                    onSave={(value) => onUpdate({ character: { class: String(value) } })}
                    className="font-normal"
                    inputClassName="h-6 text-xs"
                  />
                ) : (
                  <span>{character.class}</span>
                )}
              </span>
            </div>
          </div>

          {/* HP Bar */}
          <div className="flex-1 min-w-[200px] max-w-[300px]">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-destructive" />
                <span className="text-xs font-medium">Health</span>
              </div>
              <span className="text-xs font-mono font-semibold flex items-center gap-1" data-testid="text-character-hp">
                {onUpdate ? (
                  <>
                    <InlineEdit
                      value={character.hp}
                      onSave={(value) => onUpdate({ character: { hp: Number(value) } })}
                      type="number"
                      min={0}
                      max={character.maxHp}
                      inputClassName="w-12 h-6 text-xs"
                    />
                    /
                    <InlineEdit
                      value={character.maxHp}
                      onSave={(value) => onUpdate({ character: { maxHp: Number(value) } })}
                      type="number"
                      min={1}
                      inputClassName="w-12 h-6 text-xs"
                    />
                  </>
                ) : (
                  <>{character.hp}/{character.maxHp}</>
                )}
              </span>
            </div>
            <div className="w-full bg-destructive/20 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full transition-all ${hpPercentage > 50 ? 'bg-green-500' : hpPercentage > 25 ? 'bg-yellow-500' : 'bg-destructive'}`}
                style={{ width: `${hpPercentage}%` }}
              />
            </div>
          </div>

          {/* Gold */}
          <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 rounded-md border border-yellow-500/20">
            <Coins className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Gold</span>
              <span className="text-sm font-mono font-semibold" data-testid="text-character-gold">
                {onUpdate ? (
                  <InlineEdit
                    value={character.gold}
                    onSave={(value) => onUpdate({ character: { gold: Number(value) } })}
                    type="number"
                    min={0}
                    inputClassName="w-20 h-6 text-sm"
                  />
                ) : (
                  <span>{character.gold}</span>
                )}
              </span>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-md border border-primary/20 flex-1 min-w-[200px]">
            <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-muted-foreground">Location</span>
              <span className="text-sm font-medium truncate" data-testid="text-location">
                {onUpdate ? (
                  <InlineEdit
                    value={location?.name || 'Unknown'}
                    onSave={(value) => onUpdate({ location: { ...location, name: String(value) } })}
                    inputClassName="h-6 text-sm"
                  />
                ) : (
                  <span>{location?.name || 'Unknown'}</span>
                )}
              </span>
              {onUpdate ? (
                <span className="text-xs text-muted-foreground truncate">
                  <InlineEdit
                    value={location?.description || ''}
                    onSave={(value) => onUpdate({ location: { ...location, description: String(value) } })}
                    type="textarea"
                    className="text-xs"
                    inputClassName="h-12 text-xs"
                  />
                </span>
              ) : location?.description ? (
                <span className="text-xs text-muted-foreground truncate">
                  {location.description}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Row 2: Attributes & Status Effects */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Attributes with Modifiers */}
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border border-border">
            <Zap className="w-4 h-4 text-muted-foreground" />
            <div className="flex gap-3 text-xs font-mono">
              <div className="flex flex-col items-center" data-testid="text-str">
                <span className="text-muted-foreground">STR</span>
                <span className="font-semibold">
                  {onUpdate ? (
                    <InlineEdit
                      value={character.attributes.str}
                      onSave={(value) => onUpdate({ character: { attributes: { ...character.attributes, str: Number(value) } } })}
                      type="number"
                      min={1}
                      max={30}
                      inputClassName="w-10 h-5 text-xs text-center"
                    />
                  ) : (
                    <span>{character.attributes.str}</span>
                  )}
                </span>
                <span className="text-[10px] text-accent">{getModifier(character.attributes.str)}</span>
              </div>
              <div className="flex flex-col items-center" data-testid="text-dex">
                <span className="text-muted-foreground">DEX</span>
                <span className="font-semibold">
                  {onUpdate ? (
                    <InlineEdit
                      value={character.attributes.dex}
                      onSave={(value) => onUpdate({ character: { attributes: { ...character.attributes, dex: Number(value) } } })}
                      type="number"
                      min={1}
                      max={30}
                      inputClassName="w-10 h-5 text-xs text-center"
                    />
                  ) : (
                    <span>{character.attributes.dex}</span>
                  )}
                </span>
                <span className="text-[10px] text-accent">{getModifier(character.attributes.dex)}</span>
              </div>
              <div className="flex flex-col items-center" data-testid="text-con">
                <span className="text-muted-foreground">CON</span>
                <span className="font-semibold">
                  {onUpdate ? (
                    <InlineEdit
                      value={character.attributes.con}
                      onSave={(value) => onUpdate({ character: { attributes: { ...character.attributes, con: Number(value) } } })}
                      type="number"
                      min={1}
                      max={30}
                      inputClassName="w-10 h-5 text-xs text-center"
                    />
                  ) : (
                    <span>{character.attributes.con}</span>
                  )}
                </span>
                <span className="text-[10px] text-accent">{getModifier(character.attributes.con)}</span>
              </div>
              <div className="flex flex-col items-center" data-testid="text-int">
                <span className="text-muted-foreground">INT</span>
                <span className="font-semibold">
                  {onUpdate ? (
                    <InlineEdit
                      value={character.attributes.int}
                      onSave={(value) => onUpdate({ character: { attributes: { ...character.attributes, int: Number(value) } } })}
                      type="number"
                      min={1}
                      max={30}
                      inputClassName="w-10 h-5 text-xs text-center"
                    />
                  ) : (
                    <span>{character.attributes.int}</span>
                  )}
                </span>
                <span className="text-[10px] text-accent">{getModifier(character.attributes.int)}</span>
              </div>
              <div className="flex flex-col items-center" data-testid="text-wis">
                <span className="text-muted-foreground">WIS</span>
                <span className="font-semibold">
                  {onUpdate ? (
                    <InlineEdit
                      value={character.attributes.wis}
                      onSave={(value) => onUpdate({ character: { attributes: { ...character.attributes, wis: Number(value) } } })}
                      type="number"
                      min={1}
                      max={30}
                      inputClassName="w-10 h-5 text-xs text-center"
                    />
                  ) : (
                    <span>{character.attributes.wis}</span>
                  )}
                </span>
                <span className="text-[10px] text-accent">{getModifier(character.attributes.wis)}</span>
              </div>
              <div className="flex flex-col items-center" data-testid="text-cha">
                <span className="text-muted-foreground">CHA</span>
                <span className="font-semibold">
                  {onUpdate ? (
                    <InlineEdit
                      value={character.attributes.cha}
                      onSave={(value) => onUpdate({ character: { attributes: { ...character.attributes, cha: Number(value) } } })}
                      type="number"
                      min={1}
                      max={30}
                      inputClassName="w-10 h-5 text-xs text-center"
                    />
                  ) : (
                    <span>{character.attributes.cha}</span>
                  )}
                </span>
                <span className="text-[10px] text-accent">{getModifier(character.attributes.cha)}</span>
              </div>
            </div>
          </div>

          {/* Status Effects */}
          <div className="flex items-center gap-2 flex-1">
            {statusEffects.length > 0 ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-accent/10 rounded-md border border-accent/20 flex-wrap">
                <Shield className="w-4 h-4 text-accent flex-shrink-0" />
                <span className="text-xs font-medium text-accent">Effects:</span>
                {statusEffects.map((effect, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-1 bg-accent/20 px-2 py-1 rounded"
                    data-testid={`status-effect-${index}`}
                  >
                    <span className="text-lg">{effect.icon}</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-accent-foreground leading-tight">
                        {effect.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        {effect.turnsRemaining} turns
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-md border border-border">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">No active effects</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
