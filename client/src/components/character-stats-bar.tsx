import { useState } from 'react';
import { Heart, Coins, MapPin, Zap, Shield, Calendar, Star } from 'lucide-react';
import type { GameCharacter, StatusEffect, GameStateData, Location } from '@shared/schema';
import { InlineEdit } from '@/components/ui/inline-edit';
import { EntityImageCard } from '@/components/entity-image-card';
import { EntityDetailSheet } from '@/components/entity-detail-sheet';

interface CharacterStatsBarProps {
  character: GameCharacter;
  statusEffects: StatusEffect[];
  location: GameStateData['location'];
  turnCount: number;
  businesses?: GameStateData['businesses'];
  onUpdate?: (updates: Partial<GameStateData>) => void;
  onRefreshImage?: (entityType: 'character' | 'location', entityId?: string) => Promise<void>;
}

function getModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export default function CharacterStatsBar({ character, statusEffects, location, turnCount, businesses = [], onUpdate, onRefreshImage }: CharacterStatsBarProps) {
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [locationDetailSheetOpen, setLocationDetailSheetOpen] = useState(false);
  const [isRefreshingImage, setIsRefreshingImage] = useState(false);
  const [isRefreshingLocationImage, setIsRefreshingLocationImage] = useState(false);
  const hpPercentage = (character.hp / character.maxHp) * 100;
  
  // Calculate XP percentage with safeguards
  const safeNextLevelXp = character.nextLevelXp || 300;
  const safeXp = character.xp || 0;
  const rawXpPercentage = (safeXp / safeNextLevelXp) * 100;
  const xpPercentage = Math.min(Math.max(rawXpPercentage, 0), 100);
  
  const turnInWeek = (turnCount % 15) + 1;
  const weekNumber = Math.floor(turnCount / 15) + 1;
  
  // Calculate total weekly income from all businesses
  const weeklyIncome = businesses.reduce((total, business) => {
    return total + (business.weeklyIncome - business.runningCost);
  }, 0);

  const handleRefreshImage = async () => {
    if (!onRefreshImage) return;
    setIsRefreshingImage(true);
    try {
      await onRefreshImage('character');
    } finally {
      setIsRefreshingImage(false);
    }
  };

  const handleRefreshLocationImage = async () => {
    if (!onRefreshImage) return;
    setIsRefreshingLocationImage(true);
    try {
      await onRefreshImage('location');
    } finally {
      setIsRefreshingLocationImage(false);
    }
  };
  
  return (
    <div className="bg-card border-b-2 border-border parchment-texture">
      <div className="max-w-[1920px] mx-auto px-4 py-3">
        {/* Row 1: Character Info, HP Bar, Gold, Location */}
        <div className="flex flex-wrap items-center gap-4 mb-3">
          {/* Character Portrait */}
          <EntityImageCard
            imageUrl={character.imageUrl}
            entityType="character"
            onClick={() => setDetailSheetOpen(true)}
            className="w-16 h-16 flex-shrink-0"
          />
          
          {/* Character Name & Level */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              {onUpdate ? (
                <InlineEdit
                  value={character.name}
                  onSave={(value) => onUpdate({ character: { name: String(value) } as any })}
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
                    onSave={(value) => onUpdate({ character: { level: Number(value) } as any })}
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
                    onSave={(value) => onUpdate({ character: { race: String(value) } as any })}
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
                    onSave={(value) => onUpdate({ character: { class: String(value) } as any })}
                    className="font-normal"
                    inputClassName="h-6 text-xs"
                  />
                ) : (
                  <span>{character.class}</span>
                )}
                {' '}
                {onUpdate ? (
                  <InlineEdit
                    value={character.sex || ''}
                    onSave={(value) => onUpdate({ character: { sex: String(value) } as any })}
                    className="font-normal"
                    inputClassName="h-6 text-xs"
                  />
                ) : character.sex ? (
                  <span>{character.sex}</span>
                ) : null}
                {(onUpdate || character.age) && (
                  <>
                    {' • Age '}
                    {onUpdate ? (
                      <InlineEdit
                        value={character.age || ''}
                        onSave={(value) => onUpdate({ character: { age: String(value) } as any })}
                        className="font-normal"
                        inputClassName="h-6 text-xs w-16"
                      />
                    ) : (
                      <span>{character.age}</span>
                    )}
                  </>
                )}
              </span>
            </div>
          </div>

          {/* HP & XP Bars (Stacked) */}
          <div className="flex-1 min-w-[200px] max-w-[300px] space-y-2">
            {/* HP Bar */}
            <div>
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
                        onSave={(value) => onUpdate({ character: { hp: Number(value) } as any })}
                        type="number"
                        min={0}
                        max={character.maxHp}
                        inputClassName="w-12 h-6 text-xs"
                      />
                      /
                      <InlineEdit
                        value={character.maxHp}
                        onSave={(value) => onUpdate({ character: { maxHp: Number(value) } as any })}
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

            {/* XP Bar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-medium">Experience</span>
                </div>
                <span className="text-xs font-mono font-semibold flex items-center gap-1" data-testid="text-character-xp">
                  {onUpdate ? (
                    <>
                      <InlineEdit
                        value={safeXp}
                        onSave={(value) => onUpdate({ character: { xp: Number(value) } as any })}
                        type="number"
                        min={0}
                        max={safeNextLevelXp}
                        inputClassName="w-12 h-6 text-xs"
                      />
                      /
                      <InlineEdit
                        value={safeNextLevelXp}
                        onSave={(value) => onUpdate({ character: { nextLevelXp: Number(value) } as any })}
                        type="number"
                        min={1}
                        inputClassName="w-12 h-6 text-xs"
                      />
                    </>
                  ) : (
                    <>{safeXp}/{safeNextLevelXp}</>
                  )}
                </span>
              </div>
              <div className="w-full bg-blue-500/20 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full transition-all bg-blue-500"
                  style={{ width: `${xpPercentage}%` }}
                />
              </div>
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
                    onSave={(value) => onUpdate({ character: { gold: Number(value) } as any })}
                    type="number"
                    min={0}
                    inputClassName="w-20 h-6 text-sm"
                    displayAs={(val) => Number(val).toLocaleString()}
                  />
                ) : (
                  <span>{character.gold.toLocaleString()}</span>
                )}
              </span>
              {businesses.length > 0 && (
                <span className={`text-xs font-mono ${
                  weeklyIncome > 0 
                    ? 'text-green-600 dark:text-green-500' 
                    : weeklyIncome < 0 
                    ? 'text-red-600 dark:text-red-500' 
                    : 'text-muted-foreground'
                }`} data-testid="text-weekly-income">
                  {weeklyIncome > 0 ? '+' : ''}{weeklyIncome.toLocaleString()}/week
                </span>
              )}
            </div>
          </div>

          {/* Location */}
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-md border border-primary/20 flex-1 min-w-[200px]">
            <EntityImageCard
              imageUrl={location?.imageUrl}
              entityType="location"
              onClick={() => setLocationDetailSheetOpen(true)}
              className="w-12 h-12 flex-shrink-0"
            />
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Location</span>
                {location?.type && (
                  <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded capitalize">
                    {location.type}
                  </span>
                )}
              </div>
              <span className="text-sm font-medium truncate" data-testid="text-location">
                {onUpdate ? (
                  <InlineEdit
                    value={location?.name || 'Unknown'}
                    onSave={(value) => onUpdate({ location: { name: String(value) } as any })}
                    inputClassName="h-6 text-sm"
                  />
                ) : (
                  <span>{location?.name || 'Unknown'}</span>
                )}
              </span>
              {location?.hierarchy && (location.hierarchy.city || location.hierarchy.district) ? (
                <span className="text-xs text-muted-foreground truncate">
                  {location.hierarchy.district && `${location.hierarchy.district}, `}
                  {location.hierarchy.city || ''}
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
                      onSave={(value) => onUpdate({ character: { attributes: { ...character.attributes, str: Number(value) } } as any })}
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
                      onSave={(value) => onUpdate({ character: { attributes: { ...character.attributes, dex: Number(value) } } as any })}
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
                      onSave={(value) => onUpdate({ character: { attributes: { ...character.attributes, con: Number(value) } } as any })}
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
                      onSave={(value) => onUpdate({ character: { attributes: { ...character.attributes, int: Number(value) } } as any })}
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
                      onSave={(value) => onUpdate({ character: { attributes: { ...character.attributes, wis: Number(value) } } as any })}
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
                      onSave={(value) => onUpdate({ character: { attributes: { ...character.attributes, cha: Number(value) } } as any })}
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

          {/* AC (Armor Class) */}
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border border-border">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <div className="flex flex-col items-center text-xs font-mono" data-testid="text-ac">
              <span className="text-muted-foreground">AC</span>
              <span className="font-semibold text-base">
                {onUpdate ? (
                  <InlineEdit
                    value={character.attributes.ac}
                    onSave={(value) => onUpdate({ character: { attributes: { ...character.attributes, ac: Number(value) } } as any })}
                    type="number"
                    min={1}
                    max={30}
                    inputClassName="w-10 h-6 text-base text-center font-semibold"
                  />
                ) : (
                  <span>{character.attributes.ac}</span>
                )}
              </span>
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

          {/* Week Counter */}
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-md border border-primary/20">
            <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-xs font-medium text-primary" data-testid="text-week-counter">
              {turnInWeek}/15 - Week {weekNumber}
            </span>
          </div>
        </div>
      </div>
      
      {/* Character Detail Sheet */}
      <EntityDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        entity={character}
        entityType="character"
        onRefresh={onRefreshImage ? handleRefreshImage : undefined}
        isRefreshing={isRefreshingImage}
        onUpdate={onUpdate ? (updates) => {
          onUpdate({ character: { ...character, ...updates } as GameCharacter });
        } : undefined}
      />

      {/* Location Detail Sheet */}
      {location && (
        <EntityDetailSheet
          open={locationDetailSheetOpen}
          onOpenChange={setLocationDetailSheetOpen}
          entity={location}
          entityType="location"
          onRefresh={onRefreshImage ? handleRefreshLocationImage : undefined}
          isRefreshing={isRefreshingLocationImage}
          onUpdate={onUpdate ? (updates) => {
            onUpdate({ location: { ...location, ...updates } as Location });
          } : undefined}
        />
      )}
    </div>
  );
}
