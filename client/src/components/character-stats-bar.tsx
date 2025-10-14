import { useState } from 'react';
import { Heart, Coins, MapPin, Zap, Shield, Calendar, Star, Sparkles, Globe } from 'lucide-react';
import type { GameCharacter, StatusEffect, GameStateData, Location } from '@shared/schema';
import { InlineEdit } from '@/components/ui/inline-edit';
import { EntityImageCard } from '@/components/entity-image-card';
import { EntityDetailSheet } from '@/components/entity-detail-sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface CharacterStatsBarProps {
  character: GameCharacter;
  statusEffects: StatusEffect[];
  location: GameStateData['location'];
  turnCount: number;
  businesses?: GameStateData['businesses'];
  worldBackstory?: string;
  onUpdate?: (updates: Partial<GameStateData>) => void;
  onRefreshImage?: (entityType: 'character' | 'location', entityId?: string) => Promise<void>;
}

function getModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export default function CharacterStatsBar({ character, statusEffects, location, turnCount, businesses = [], worldBackstory, onUpdate, onRefreshImage }: CharacterStatsBarProps) {
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [locationDetailSheetOpen, setLocationDetailSheetOpen] = useState(false);
  const [worldDetailSheetOpen, setWorldDetailSheetOpen] = useState(false);
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
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
          
          {/* Character Identity Section */}
          <div className="flex items-center gap-3">
            {/* Character Portrait */}
            <EntityImageCard
              imageUrl={character.imageUrl}
              entityType="character"
              onClick={() => setDetailSheetOpen(true)}
              className="w-20 h-20 flex-shrink-0"
            />
            
            {/* Character Name & Details */}
            <div className="flex flex-col gap-1">
              {onUpdate ? (
                <InlineEdit
                  value={character.name}
                  onSave={(value) => onUpdate({ character: { name: String(value) } as any })}
                  className="text-xl font-serif font-bold text-primary"
                  inputClassName="text-xl font-bold"
                />
              ) : (
                <span className="text-xl font-serif font-bold text-primary" data-testid="text-character-name">
                  {character.name}
                </span>
              )}
              
              {/* Level Badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="default" className="font-bold">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Level {onUpdate ? (
                    <InlineEdit
                      value={character.level}
                      onSave={(value) => onUpdate({ character: { level: Number(value) } as any })}
                      type="number"
                      min={1}
                      max={20}
                      inputClassName="w-8 h-5 text-xs ml-1"
                    />
                  ) : (
                    <span className="ml-1">{character.level}</span>
                  )}
                </Badge>
                
                {/* Race/Class/Sex Badges */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {onUpdate ? (
                    <InlineEdit
                      value={character.race}
                      onSave={(value) => onUpdate({ character: { race: String(value) } as any })}
                      className="font-medium"
                      inputClassName="h-5 text-xs"
                    />
                  ) : (
                    <span className="font-medium">{character.race}</span>
                  )}
                  <span>•</span>
                  {onUpdate ? (
                    <InlineEdit
                      value={character.class}
                      onSave={(value) => onUpdate({ character: { class: String(value) } as any })}
                      className="font-medium"
                      inputClassName="h-5 text-xs"
                    />
                  ) : (
                    <span className="font-medium">{character.class}</span>
                  )}
                  {(character.sex || onUpdate) && (
                    <>
                      <span>•</span>
                      {onUpdate ? (
                        <InlineEdit
                          value={character.sex || ''}
                          onSave={(value) => onUpdate({ character: { sex: String(value) } as any })}
                          className="font-medium"
                          inputClassName="h-5 text-xs"
                        />
                      ) : (
                        <span className="font-medium">{character.sex}</span>
                      )}
                    </>
                  )}
                  {(character.age || onUpdate) && (
                    <>
                      <span>•</span>
                      <span>Age</span>
                      {onUpdate ? (
                        <InlineEdit
                          value={character.age || ''}
                          onSave={(value) => onUpdate({ character: { age: String(value) } as any })}
                          className="font-medium"
                          inputClassName="h-5 text-xs w-12"
                        />
                      ) : (
                        <span className="font-medium">{character.age}</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Separator orientation="vertical" className="hidden lg:block h-16" />

          {/* Core Stats Section */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 flex-1">
            
            {/* HP & XP Bars */}
            <div className="flex-1 min-w-[240px] max-w-[320px] space-y-2.5">
              {/* HP Bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Badge variant="outline" className="gap-1.5 bg-destructive/10 border-destructive/30">
                    <Heart className="w-3 h-3" />
                    <span className="text-xs font-medium">Health</span>
                  </Badge>
                  <span className="text-sm font-mono font-bold flex items-center gap-1" data-testid="text-character-hp">
                    {onUpdate ? (
                      <>
                        <InlineEdit
                          value={character.hp}
                          onSave={(value) => onUpdate({ character: { hp: Number(value) } as any })}
                          type="number"
                          min={0}
                          max={character.maxHp}
                          inputClassName="w-14 h-6 text-sm"
                        />
                        /
                        <InlineEdit
                          value={character.maxHp}
                          onSave={(value) => onUpdate({ character: { maxHp: Number(value) } as any })}
                          type="number"
                          min={1}
                          inputClassName="w-14 h-6 text-sm"
                        />
                      </>
                    ) : (
                      <>{character.hp}/{character.maxHp}</>
                    )}
                  </span>
                </div>
                <div className="w-full bg-destructive/20 rounded-full h-2.5 overflow-hidden border border-destructive/30">
                  <div 
                    className={`h-full transition-all ${hpPercentage > 50 ? 'bg-green-500' : hpPercentage > 25 ? 'bg-yellow-500' : 'bg-destructive'}`}
                    style={{ width: `${hpPercentage}%` }}
                  />
                </div>
              </div>

              {/* XP Bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Badge variant="outline" className="gap-1.5 bg-blue-500/10 border-blue-500/30">
                    <Star className="w-3 h-3" />
                    <span className="text-xs font-medium">XP</span>
                  </Badge>
                  <span className="text-sm font-mono font-bold flex items-center gap-1" data-testid="text-character-xp">
                    {onUpdate ? (
                      <>
                        <InlineEdit
                          value={safeXp}
                          onSave={(value) => onUpdate({ character: { xp: Number(value) } as any })}
                          type="number"
                          min={0}
                          max={safeNextLevelXp}
                          inputClassName="w-14 h-6 text-sm"
                        />
                        /
                        <InlineEdit
                          value={safeNextLevelXp}
                          onSave={(value) => onUpdate({ character: { nextLevelXp: Number(value) } as any })}
                          type="number"
                          min={1}
                          inputClassName="w-14 h-6 text-sm"
                        />
                      </>
                    ) : (
                      <>{safeXp}/{safeNextLevelXp}</>
                    )}
                  </span>
                </div>
                <div className="w-full bg-blue-500/20 rounded-full h-2.5 overflow-hidden border border-blue-500/30">
                  <div 
                    className="h-full transition-all bg-blue-500"
                    style={{ width: `${xpPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Gold */}
            <div className="flex items-center gap-2.5 px-4 py-2 bg-gradient-to-br from-yellow-500/10 to-amber-500/10 rounded-lg border border-yellow-500/30 shadow-sm">
              <Coins className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
              <div className="flex flex-col">
                <span className="text-xs font-medium text-muted-foreground">Gold</span>
                <span className="text-base font-mono font-bold text-yellow-700 dark:text-yellow-500" data-testid="text-character-gold">
                  {onUpdate ? (
                    <InlineEdit
                      value={character.gold}
                      onSave={(value) => onUpdate({ character: { gold: Number(value) } as any })}
                      type="number"
                      min={0}
                      inputClassName="w-24 h-6 text-base"
                      displayAs={(val) => Number(val).toLocaleString()}
                    />
                  ) : (
                    <span>{character.gold.toLocaleString()}</span>
                  )}
                </span>
                {businesses.length > 0 && (
                  <span className={`text-xs font-mono font-semibold ${
                    weeklyIncome > 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : weeklyIncome < 0 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-muted-foreground'
                  }`} data-testid="text-weekly-income">
                    {weeklyIncome > 0 ? '+' : ''}{weeklyIncome.toLocaleString()}/wk
                  </span>
                )}
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center gap-2.5 px-3 py-2 bg-primary/10 rounded-lg border border-primary/30 flex-1 min-w-[180px] shadow-sm">
              <EntityImageCard
                imageUrl={location?.imageUrl}
                entityType="location"
                onClick={() => setLocationDetailSheetOpen(true)}
                className="w-20 h-20 flex-shrink-0"
              />
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <MapPin className="w-3 h-3 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">Location</span>
                  {location?.type && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {location.type}
                    </Badge>
                  )}
                </div>
                <span className="text-sm font-bold text-primary break-words" data-testid="text-location">
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
                  <span className="text-xs text-muted-foreground break-words line-clamp-2">
                    {location.hierarchy.district && `${location.hierarchy.district}, `}
                    {location.hierarchy.city || ''}
                  </span>
                ) : location?.description ? (
                  <span className="text-xs text-muted-foreground break-words line-clamp-2">
                    {location.description}
                  </span>
                ) : null}
              </div>
            </div>

            {/* World Map Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWorldDetailSheetOpen(true)}
              className="flex items-center gap-2 px-3 py-2 h-auto bg-primary/10 border-primary/30 hover:bg-primary/20"
              data-testid="button-world-map"
            >
              <Globe className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium">World Map</span>
            </Button>
          </div>
        </div>

        <Separator className="my-3" />

        {/* Bottom Row: Attributes, AC, Status Effects, Week Counter */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Attributes - Always Visible */}
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-border">
            <Zap className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="flex gap-2">
              {[
                { key: 'str', label: 'STR', value: character.attributes.str, testId: 'text-str' },
                { key: 'dex', label: 'DEX', value: character.attributes.dex, testId: 'text-dex' },
                { key: 'con', label: 'CON', value: character.attributes.con, testId: 'text-con' },
                { key: 'int', label: 'INT', value: character.attributes.int, testId: 'text-int' },
                { key: 'wis', label: 'WIS', value: character.attributes.wis, testId: 'text-wis' },
                { key: 'cha', label: 'CHA', value: character.attributes.cha, testId: 'text-cha' },
              ].map(({ key, label, value, testId }) => (
                <div key={key} className="flex flex-col items-center min-w-[44px]" data-testid={testId}>
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">{label}</span>
                  <span className="text-base font-bold text-foreground leading-tight">
                    {onUpdate ? (
                      <InlineEdit
                        value={value}
                        onSave={(val) => onUpdate({ character: { attributes: { ...character.attributes, [key]: Number(val) } } as any })}
                        type="number"
                        min={1}
                        max={30}
                        inputClassName="w-10 h-6 text-base text-center font-bold"
                      />
                    ) : (
                      <span>{value}</span>
                    )}
                  </span>
                  <span className="text-[10px] font-mono text-accent leading-tight">{getModifier(value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AC Badge */}
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-border" data-testid="text-ac">
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">AC</span>
              <span className="text-lg font-bold font-mono leading-tight">
                {onUpdate ? (
                  <InlineEdit
                    value={character.attributes.ac}
                    onSave={(value) => onUpdate({ character: { attributes: { ...character.attributes, ac: Number(value) } } as any })}
                    type="number"
                    min={1}
                    max={30}
                    inputClassName="w-12 h-7 text-lg text-center font-bold"
                  />
                ) : (
                  <span>{character.attributes.ac}</span>
                )}
              </span>
            </div>
          </div>

          {/* Status Effects */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            {statusEffects.length > 0 ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-accent/10 rounded-lg border border-accent/30 flex-wrap flex-1">
                <Sparkles className="w-4 h-4 text-accent flex-shrink-0" />
                <span className="text-xs font-semibold text-accent">Active Effects:</span>
                {statusEffects.map((effect, index) => (
                  <Badge 
                    key={index}
                    variant="secondary" 
                    className="gap-1.5 bg-accent/20"
                    data-testid={`status-effect-${index}`}
                  >
                    <span>{effect.icon}</span>
                    <span className="font-medium">{effect.name}</span>
                    <span className="text-xs opacity-70">({effect.turnsRemaining}t)</span>
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg border border-border/50">
                <Sparkles className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">No active effects</span>
              </div>
            )}
          </div>

          {/* Week Counter */}
          <Badge variant="outline" className="gap-2 px-3 py-2 bg-primary/10 border-primary/30">
            <Calendar className="w-4 h-4" />
            <span className="font-mono font-semibold" data-testid="text-week-counter">
              Turn {turnInWeek}/15 • Week {weekNumber}
            </span>
          </Badge>
        </div>
      </div>
      
      {/* Character Detail Sheet */}
      <EntityDetailSheet
        key={`character-${character.imageUrl || 'no-image'}`}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        entity={character}
        entityType="character"
        onRefresh={onRefreshImage ? handleRefreshImage : undefined}
        isRefreshing={isRefreshingImage}
        onUpdate={onUpdate ? (updates) => {
          onUpdate({ character: { ...character, ...updates } as GameCharacter });
        } : undefined}
        statusEffects={statusEffects}
        businesses={businesses}
      />

      {/* Location Detail Sheet */}
      {location && (
        <EntityDetailSheet
          key={`location-${location.imageUrl || 'no-image'}`}
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

      {/* World Detail Sheet */}
      <Sheet open={worldDetailSheetOpen} onOpenChange={setWorldDetailSheetOpen}>
        <SheetContent side="bottom" className="h-[90vh] max-w-[1400px] mx-auto">
          <SheetHeader className="pb-6">
            <SheetTitle className="flex items-center gap-3 text-2xl font-serif">
              <Globe className="w-6 h-6" />
              World Lore
            </SheetTitle>
            <SheetDescription>
              Explore the rich history, geography, and factions of the world
            </SheetDescription>
          </SheetHeader>
          
          <div className="flex flex-col lg:flex-row gap-6 h-[calc(100%-120px)] overflow-auto">
            {/* Left: World Map Placeholder */}
            <div className="lg:w-1/2 flex-shrink-0">
              <div className="relative aspect-square w-full max-w-[600px] mx-auto border-4 border-border rounded-xl overflow-hidden shadow-2xl bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 dark:from-amber-950 dark:via-yellow-950 dark:to-amber-900 flex items-center justify-center">
                <div className="text-center p-8">
                  <Globe className="w-24 h-24 mx-auto mb-4 text-amber-700 dark:text-amber-300" />
                  <p className="text-lg font-serif text-amber-800 dark:text-amber-200">World Map</p>
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">Explore the realm through your adventures</p>
                </div>
              </div>
            </div>

            {/* Right: World Lore Content */}
            <div className="lg:w-1/2 flex-1 overflow-auto">
              {worldBackstory ? (
                <div className="bg-card border-2 border-border rounded-xl p-6 shadow-sm">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {worldBackstory}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="bg-card border-2 border-border rounded-xl p-6 shadow-sm">
                  <p className="text-muted-foreground italic">
                    World lore will be generated after you visit your first location in the adventure.
                  </p>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
