import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Backpack, ScrollText, Users, UserCircle, History, Sparkles, MapPin, Building2 } from 'lucide-react';
import type { InventoryItem, Quest, Companion, EncounteredCharacter, Spell, Business, GameStateData, PreviousLocation, Location } from '@shared/schema';
import { InlineEdit } from '@/components/ui/inline-edit';
import { Badge } from '@/components/ui/badge';
import { EntityImageCard } from '@/components/entity-image-card';
import { EntityDetailSheet } from '@/components/entity-detail-sheet';

interface GameInfoTabsProps {
  inventory: InventoryItem[];
  quests: Quest[];
  spells: Spell[];
  companions: Companion[];
  encounteredCharacters: EncounteredCharacter[];
  businesses: Business[];
  history: string[];
  previousLocations: PreviousLocation[];
  updatedTabs?: string[];
  onUpdate?: (updates: Partial<GameStateData>) => void;
  onTabChange?: (tabId: string) => void;
  onRefreshImage?: (entityType: 'companion' | 'npc' | 'location', entityId?: string) => Promise<void>;
}

export default function GameInfoTabs({
  inventory,
  quests,
  spells,
  companions,
  encounteredCharacters,
  businesses,
  history,
  previousLocations,
  updatedTabs,
  onUpdate,
  onTabChange,
  onRefreshImage,
}: GameInfoTabsProps) {
  const [npcSortBy, setNpcSortBy] = useState<'name' | 'role' | 'location'>('name');
  const [spellSortBy, setSpellSortBy] = useState<'name' | 'level' | 'school'>('name');
  const [spellFilter, setSpellFilter] = useState<string>('');
  const [spellLevelFilter, setSpellLevelFilter] = useState<string>('all');
  const [detailEntity, setDetailEntity] = useState<Companion | EncounteredCharacter | Location | null>(null);
  const [detailEntityType, setDetailEntityType] = useState<'companion' | 'npc' | 'location'>('companion');
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [isRefreshingImage, setIsRefreshingImage] = useState(false);

  const openDetailSheet = (entity: Companion | EncounteredCharacter | Location, type: 'companion' | 'npc' | 'location') => {
    setDetailEntity(entity);
    setDetailEntityType(type);
    setDetailSheetOpen(true);
  };

  const handleRefreshImage = async () => {
    if (!onRefreshImage || !detailEntity) return;
    setIsRefreshingImage(true);
    try {
      const entityId = 'id' in detailEntity ? detailEntity.id : undefined;
      await onRefreshImage(detailEntityType, entityId);
    } finally {
      setIsRefreshingImage(false);
    }
  };

  const sortedNPCs = [...encounteredCharacters].sort((a, b) => {
    if (npcSortBy === 'name') return a.name.localeCompare(b.name);
    if (npcSortBy === 'role') return a.role.localeCompare(b.role);
    if (npcSortBy === 'location') return (a.location || '').localeCompare(b.location || '');
    return 0;
  });

  const filteredAndSortedSpells = [...spells]
    .filter(spell => {
      const matchesText = spellFilter === '' || 
        spell.name.toLowerCase().includes(spellFilter.toLowerCase()) ||
        spell.school.toLowerCase().includes(spellFilter.toLowerCase()) ||
        spell.description.toLowerCase().includes(spellFilter.toLowerCase());
      
      const matchesLevel = spellLevelFilter === 'all' || 
        spell.level.toString() === spellLevelFilter;
      
      return matchesText && matchesLevel;
    })
    .sort((a, b) => {
      if (spellSortBy === 'name') return a.name.localeCompare(b.name);
      if (spellSortBy === 'level') return a.level - b.level;
      if (spellSortBy === 'school') return a.school.localeCompare(b.school);
      return 0;
    });

  const hasUpdate = (tabId: string) => updatedTabs?.includes(tabId) || false;

  const handleTabChange = (value: string) => {
    if (onTabChange) {
      onTabChange(value);
    }
  };

  return (
    <Tabs defaultValue="inventory" className="w-full h-full flex flex-col" onValueChange={handleTabChange}>
      <TabsList className="grid w-full grid-cols-8 bg-muted/50 border-b border-border">
        <TabsTrigger value="inventory" className="gap-1 text-xs" data-testid="tab-inventory">
          <div className="relative">
            <Backpack className="w-4 h-4 flex-shrink-0" />
            {hasUpdate('inventory') && (
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rounded-full animate-pulse" />
            )}
          </div>
          <span className="hidden lg:inline">Inventory</span>
        </TabsTrigger>
        <TabsTrigger value="spells" className="gap-1 text-xs" data-testid="tab-spells">
          <div className="relative">
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            {hasUpdate('spells') && (
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rounded-full animate-pulse" />
            )}
          </div>
          <span className="hidden lg:inline">Spells</span>
        </TabsTrigger>
        <TabsTrigger value="locations" className="gap-1 text-xs" data-testid="tab-locations">
          <div className="relative">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            {hasUpdate('locations') && (
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rounded-full animate-pulse" />
            )}
          </div>
          <span className="hidden lg:inline">Locations</span>
        </TabsTrigger>
        <TabsTrigger value="businesses" className="gap-1 text-xs" data-testid="tab-businesses">
          <div className="relative">
            <Building2 className="w-4 h-4 flex-shrink-0" />
            {hasUpdate('businesses') && (
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rounded-full animate-pulse" />
            )}
          </div>
          <span className="hidden lg:inline">Business</span>
        </TabsTrigger>
        <TabsTrigger value="quests" className="gap-1 text-xs" data-testid="tab-quests">
          <div className="relative">
            <ScrollText className="w-4 h-4 flex-shrink-0" />
            {hasUpdate('quests') && (
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rounded-full animate-pulse" />
            )}
          </div>
          <span className="hidden lg:inline">Quests</span>
        </TabsTrigger>
        <TabsTrigger value="companions" className="gap-1 text-xs" data-testid="tab-companions">
          <div className="relative">
            <Users className="w-4 h-4 flex-shrink-0" />
            {hasUpdate('companions') && (
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rounded-full animate-pulse" />
            )}
          </div>
          <span className="hidden lg:inline">Party</span>
        </TabsTrigger>
        <TabsTrigger value="encounters" className="gap-1 text-xs" data-testid="tab-encounters">
          <div className="relative">
            <UserCircle className="w-4 h-4 flex-shrink-0" />
            {hasUpdate('encounters') && (
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rounded-full animate-pulse" />
            )}
          </div>
          <span className="hidden lg:inline">NPCs</span>
        </TabsTrigger>
        <TabsTrigger value="history" className="gap-1 text-xs" data-testid="tab-history">
          <div className="relative">
            <History className="w-4 h-4 flex-shrink-0" />
            {hasUpdate('history') && (
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rounded-full animate-pulse" />
            )}
          </div>
          <span className="hidden lg:inline">History</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="inventory" className="flex-1 mt-0 border-none p-0">
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="p-4 space-y-3">
            {inventory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No items in inventory</p>
            ) : (
              inventory.map((item) => (
                <div
                  key={item.id}
                  className="border border-border rounded-lg p-3 bg-card hover:bg-accent/5 transition-colors"
                  data-testid={`inventory-item-${item.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{item.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-semibold text-sm">{item.name}</h4>
                        {item.quantity > 1 && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            x{item.quantity}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                      {item.equipped && (
                        <span className="text-xs text-accent mt-1 inline-block">Equipped</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="spells" className="flex-1 mt-0 border-none p-0">
        <div className="p-3 border-b border-border bg-muted/30 space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Search spells..."
              value={spellFilter}
              onChange={(e) => setSpellFilter(e.target.value)}
              className="flex-1 h-8 text-xs"
              data-testid="input-spell-search"
            />
            <Select value={spellLevelFilter} onValueChange={setSpellLevelFilter}>
              <SelectTrigger className="w-24 h-8 text-xs" data-testid="select-spell-level">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="0">Cantrip</SelectItem>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => (
                  <SelectItem key={level} value={level.toString()}>Lv {level}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Select value={spellSortBy} onValueChange={(value: any) => setSpellSortBy(value)}>
            <SelectTrigger className="w-full h-8 text-xs" data-testid="select-spell-sort">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="level">Level</SelectItem>
              <SelectItem value="school">School</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ScrollArea className="h-[calc(100vh-360px)]">
          <div className="p-3 space-y-2">
            {filteredAndSortedSpells.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {spells.length === 0 ? 'No spells learned' : 'No spells match your filters'}
              </p>
            ) : (
              filteredAndSortedSpells.map((spell, index) => (
                <div
                  key={spell.id}
                  className="border border-border rounded p-2 bg-card hover:bg-accent/5 transition-colors"
                  data-testid={`spell-${spell.id}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">
                      {onUpdate ? (
                        <InlineEdit
                          value={spell.icon}
                          onSave={(value) => {
                            const updated = [...filteredAndSortedSpells];
                            const originalIndex = spells.findIndex(s => s.id === spell.id);
                            const updatedSpells = [...spells];
                            updatedSpells[originalIndex] = { ...spell, icon: String(value) };
                            onUpdate({ spells: updatedSpells });
                          }}
                          className="text-lg"
                          inputClassName="w-10 h-7 text-lg text-center"
                        />
                      ) : (
                        spell.icon
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-xs">
                          {onUpdate ? (
                            <InlineEdit
                              value={spell.name}
                              onSave={(value) => {
                                const originalIndex = spells.findIndex(s => s.id === spell.id);
                                const updatedSpells = [...spells];
                                updatedSpells[originalIndex] = { ...spell, name: String(value) };
                                onUpdate({ spells: updatedSpells });
                              }}
                              inputClassName="text-xs font-semibold"
                            />
                          ) : (
                            spell.name
                          )}
                        </span>
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded flex-shrink-0">
                          {spell.level === 0 ? 'C' : `L${spell.level}`}
                        </span>
                      </div>
                      <div className="text-[10px] text-accent mt-0.5">
                        {onUpdate ? (
                          <InlineEdit
                            value={spell.school}
                            onSave={(value) => {
                              const originalIndex = spells.findIndex(s => s.id === spell.id);
                              const updatedSpells = [...spells];
                              updatedSpells[originalIndex] = { ...spell, school: String(value) };
                              onUpdate({ spells: updatedSpells });
                            }}
                            className="text-[10px] text-accent"
                            inputClassName="h-5 text-[10px]"
                          />
                        ) : (
                          spell.school
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                        {onUpdate ? (
                          <InlineEdit
                            value={spell.description}
                            onSave={(value) => {
                              const originalIndex = spells.findIndex(s => s.id === spell.id);
                              const updatedSpells = [...spells];
                              updatedSpells[originalIndex] = { ...spell, description: String(value) };
                              onUpdate({ spells: updatedSpells });
                            }}
                            type="textarea"
                            className="text-[10px]"
                            inputClassName="text-[10px]"
                          />
                        ) : (
                          spell.description
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="locations" className="flex-1 mt-0 border-none p-0">
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="p-4 space-y-3">
            {!previousLocations || previousLocations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No previous locations</p>
            ) : (
              <div className="space-y-2">
                {previousLocations.map((location) => (
                  <div
                    key={location.id}
                    className="border border-border rounded-lg p-3 bg-card cursor-pointer hover:bg-accent/5 transition-colors"
                    data-testid={`location-${location.id}`}
                    onClick={() => openDetailSheet(location, 'location')}
                  >
                    <div className="flex items-start gap-3">
                      <EntityImageCard
                        imageUrl={location.imageUrl}
                        entityType="location"
                        onClick={(e) => {
                          e?.stopPropagation();
                          openDetailSheet(location, 'location');
                        }}
                        className="w-16 h-16 flex-shrink-0"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">{location.name}</span>
                        </div>
                        {location.description && (
                          <p className="text-xs text-muted-foreground">{location.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="businesses" className="flex-1 mt-0 border-none p-0">
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="p-4 space-y-3">
            {!businesses || businesses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No businesses owned</p>
            ) : (
              businesses.map((business) => (
                <div
                  key={business.id}
                  className="border border-border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors"
                  data-testid={`business-${business.id}`}
                >
                  <div className="flex items-start gap-3">
                    <Building2 className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm mb-2">{business.name}</h4>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">Weekly Income:</span>
                          <span className="font-mono font-semibold text-green-600 dark:text-green-500">
                            +{business.weeklyIncome.toLocaleString()} gold
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">Running Cost:</span>
                          <span className="font-mono font-semibold text-red-600 dark:text-red-500">
                            -{business.runningCost.toLocaleString()} gold
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">Net Profit:</span>
                          <span className="font-mono font-semibold text-primary">
                            {(business.weeklyIncome - business.runningCost).toLocaleString()} gold/week
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs border-t border-border pt-1.5 mt-2">
                          <span className="text-muted-foreground">Purchase Cost:</span>
                          <span className="font-mono text-xs">{business.purchaseCost.toLocaleString()} gold</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">Manager:</span>
                          <span className="text-xs">{business.manager}</span>
                        </div>
                      </div>
                      {business.description && (
                        <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                          {business.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="quests" className="flex-1 mt-0 border-none p-0">
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="p-4 space-y-3">
            {quests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No active quests</p>
            ) : (
              quests.map((quest) => (
                <div
                  key={quest.id}
                  className="border border-border rounded-lg p-3 bg-card"
                  data-testid={`quest-${quest.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{quest.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm">{quest.title}</h4>
                        {quest.type === 'main' && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Main</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{quest.description}</p>
                      {quest.objectives.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {quest.objectives.filter(obj => obj.text && obj.text.trim() !== '').map((obj, idx) => (
                            <li key={idx} className="text-xs flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={obj.completed}
                                readOnly
                                className="w-3 h-3 rounded"
                              />
                              <span className={obj.completed ? 'line-through text-muted-foreground' : ''}>
                                {obj.text}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="companions" className="flex-1 mt-0 border-none p-0">
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="p-4 space-y-4">
            {companions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No companions yet</p>
            ) : (
              companions.map((companion, index) => (
                <div
                  key={companion.id}
                  className="border-2 border-border rounded-lg p-4 bg-card space-y-2"
                  data-testid={`companion-${companion.id}`}
                >
                  <div className="flex items-start gap-3">
                    <EntityImageCard
                      imageUrl={companion.imageUrl}
                      entityType="companion"
                      onClick={() => openDetailSheet(companion, 'companion')}
                      className="w-20 h-20 flex-shrink-0"
                    />
                    <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-base">
                      {onUpdate ? (
                        <InlineEdit
                          value={companion.name}
                          onSave={(value) => {
                            const updated = [...companions];
                            updated[index] = { ...companion, name: String(value) };
                            onUpdate({ companions: updated });
                          }}
                          inputClassName="text-base font-semibold"
                        />
                      ) : (
                        <span>{companion.name}</span>
                      )}
                    </h4>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded flex items-center gap-1">
                      Lv. 
                      {onUpdate ? (
                        <InlineEdit
                          value={companion.level}
                          onSave={(value) => {
                            const updated = [...companions];
                            updated[index] = { ...companion, level: Number(value) };
                            onUpdate({ companions: updated });
                          }}
                          type="number"
                          min={1}
                          max={20}
                          inputClassName="w-12 h-5 text-xs"
                        />
                      ) : (
                        <span>{companion.level}</span>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                    {onUpdate ? (
                      <>
                        <InlineEdit
                          value={companion.race}
                          onSave={(value) => {
                            const updated = [...companions];
                            updated[index] = { ...companion, race: String(value) };
                            onUpdate({ companions: updated });
                          }}
                          inputClassName="h-5 text-xs"
                        />
                        {' '}
                        <InlineEdit
                          value={companion.class}
                          onSave={(value) => {
                            const updated = [...companions];
                            updated[index] = { ...companion, class: String(value) };
                            onUpdate({ companions: updated });
                          }}
                          inputClassName="h-5 text-xs"
                        />
                        {' '}
                        <InlineEdit
                          value={companion.sex || ''}
                          onSave={(value) => {
                            const updated = [...companions];
                            updated[index] = { ...companion, sex: String(value) };
                            onUpdate({ companions: updated });
                          }}
                          inputClassName="h-5 text-xs"
                        />
                        {' • Age '}
                        <InlineEdit
                          value={companion.age || ''}
                          onSave={(value) => {
                            const updated = [...companions];
                            updated[index] = { ...companion, age: String(value) };
                            onUpdate({ companions: updated });
                          }}
                          inputClassName="h-5 text-xs w-16"
                        />
                      </>
                    ) : (
                      <span>{companion.race} {companion.class}{companion.sex ? ` ${companion.sex}` : ''}{companion.age ? ` • Age ${companion.age}` : ''}</span>
                    )}
                  </p>
                  <div className="pt-2 space-y-2 border-t border-border">
                    <p className="text-xs text-foreground leading-relaxed">
                      {onUpdate ? (
                        <InlineEdit
                          value={companion.appearance}
                          onSave={(value) => {
                            const updated = [...companions];
                            updated[index] = { ...companion, appearance: String(value) };
                            onUpdate({ companions: updated });
                          }}
                          type="textarea"
                          className="text-xs"
                          inputClassName="text-xs"
                        />
                      ) : (
                        <span>{companion.appearance}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground italic leading-relaxed">
                      {onUpdate ? (
                        <InlineEdit
                          value={companion.personality}
                          onSave={(value) => {
                            const updated = [...companions];
                            updated[index] = { ...companion, personality: String(value) };
                            onUpdate({ companions: updated });
                          }}
                          type="textarea"
                          className="text-xs italic"
                          inputClassName="text-xs"
                        />
                      ) : (
                        <span>{companion.personality}</span>
                      )}
                    </p>
                  </div>
                  {(companion.criticalMemories || onUpdate) && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs">
                        <span className="font-medium text-accent">Critical Memories: </span>
                        {onUpdate ? (
                          <InlineEdit
                            value={companion.criticalMemories || ''}
                            onSave={(value) => {
                              const updated = [...companions];
                              updated[index] = { ...companion, criticalMemories: String(value) };
                              onUpdate({ companions: updated });
                            }}
                            type="textarea"
                            className="text-xs"
                            inputClassName="text-xs"
                          />
                        ) : (
                          <span className="text-muted-foreground">{companion.criticalMemories}</span>
                        )}
                      </p>
                    </div>
                  )}
                  {(companion.feelingsTowardsPlayer || onUpdate) && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs">
                        <span className="font-medium text-accent">Feelings Towards You: </span>
                        {onUpdate ? (
                          <InlineEdit
                            value={companion.feelingsTowardsPlayer || ''}
                            onSave={(value) => {
                              const updated = [...companions];
                              updated[index] = { ...companion, feelingsTowardsPlayer: String(value) };
                              onUpdate({ companions: updated });
                            }}
                            type="textarea"
                            className="text-xs"
                            inputClassName="text-xs"
                          />
                        ) : (
                          <span className="text-muted-foreground">{companion.feelingsTowardsPlayer}</span>
                        )}
                      </p>
                    </div>
                  )}
                  {(companion.relationship || onUpdate) && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs">
                        <span className="font-medium text-accent">Relationship: </span>
                        {onUpdate ? (
                          <InlineEdit
                            value={companion.relationship || ''}
                            onSave={(value) => {
                              const updated = [...companions];
                              updated[index] = { ...companion, relationship: String(value) };
                              onUpdate({ companions: updated });
                            }}
                            className="text-xs"
                            inputClassName="text-xs"
                          />
                        ) : (
                          <span className="text-muted-foreground">{companion.relationship}</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
              ))
            )}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="encounters" className="flex-1 mt-0 border-none p-0">
        <div className="flex flex-col h-full">
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Sort by:</span>
              <Select value={npcSortBy} onValueChange={(value: any) => setNpcSortBy(value)}>
                <SelectTrigger className="w-28 h-7 text-xs" data-testid="select-npc-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="role">Role</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <ScrollArea className="h-[calc(100vh-320px)]">
            <div className="p-4">
              {sortedNPCs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No characters encountered</p>
              ) : (
                <Accordion type="multiple" className="space-y-2">
                  {sortedNPCs.map((character, index) => (
                    <AccordionItem 
                      key={character.id} 
                      value={character.id}
                      className="border border-border rounded-lg px-3 bg-card"
                      data-testid={`encountered-${character.id}`}
                    >
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center justify-between w-full pr-2">
                          <div className="flex items-center gap-3 flex-1">
                            <EntityImageCard
                              imageUrl={character.imageUrl}
                              entityType="npc"
                              onClick={(e) => {
                                e?.stopPropagation();
                                openDetailSheet(character, 'npc');
                              }}
                              className="w-12 h-12 flex-shrink-0"
                            />
                            <div className="flex flex-col items-start gap-1">
                              <span className="font-semibold text-sm">{character.name}</span>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{character.role}</span>
                                {character.location && (
                                  <>
                                    <span>•</span>
                                    <span>{character.location}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-3 pt-1">
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Sex:</span>
                            {onUpdate ? (
                              <InlineEdit
                                value={character.sex || ''}
                                onSave={(value) => {
                                  const updated = [...encounteredCharacters];
                                  const origIndex = encounteredCharacters.findIndex(c => c.id === character.id);
                                  updated[origIndex] = { ...character, sex: String(value) };
                                  onUpdate({ encounteredCharacters: updated });
                                }}
                                className="text-xs"
                                inputClassName="h-6 text-xs w-24"
                              />
                            ) : character.sex ? (
                              <span>{character.sex}</span>
                            ) : (
                              <span className="text-muted-foreground/50">Not specified</span>
                            )}
                          </div>
                          {(character.age || onUpdate) && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Age:</span>
                              {onUpdate ? (
                                <InlineEdit
                                  value={character.age || ''}
                                  onSave={(value) => {
                                    const updated = [...encounteredCharacters];
                                    const origIndex = encounteredCharacters.findIndex(c => c.id === character.id);
                                    updated[origIndex] = { ...character, age: String(value) };
                                    onUpdate({ encounteredCharacters: updated });
                                  }}
                                  className="text-xs"
                                  inputClassName="h-6 text-xs w-24"
                                />
                              ) : (
                                <span>{character.age}</span>
                              )}
                            </div>
                          )}
                          {(character.location || onUpdate) && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Location:</span>
                              {onUpdate ? (
                                <InlineEdit
                                  value={character.location || ''}
                                  onSave={(value) => {
                                    const updated = [...encounteredCharacters];
                                    const origIndex = encounteredCharacters.findIndex(c => c.id === character.id);
                                    updated[origIndex] = { ...character, location: String(value) };
                                    onUpdate({ encounteredCharacters: updated });
                                  }}
                                  className="text-xs"
                                  inputClassName="h-6 text-xs"
                                />
                              ) : (
                                <span>{character.location}</span>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Status:</span>
                            <span 
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                character.status === 'alive' 
                                  ? 'bg-green-500/20 text-green-700 dark:text-green-400' 
                                  : 'bg-red-500/20 text-red-700 dark:text-red-400'
                              }`}
                              data-testid={`status-${character.id}`}
                            >
                              {character.status || 'alive'}
                            </span>
                          </div>
                          <div className="pt-2 border-t border-border">
                            <p className="text-muted-foreground mb-1">Appearance:</p>
                            <p className="text-foreground leading-relaxed">
                              {onUpdate ? (
                                <InlineEdit
                                  value={character.appearance}
                                  onSave={(value) => {
                                    const updated = [...encounteredCharacters];
                                    const origIndex = encounteredCharacters.findIndex(c => c.id === character.id);
                                    updated[origIndex] = { ...character, appearance: String(value) };
                                    onUpdate({ encounteredCharacters: updated });
                                  }}
                                  type="textarea"
                                  className="text-xs"
                                  inputClassName="text-xs"
                                />
                              ) : (
                                <span>{character.appearance}</span>
                              )}
                            </p>
                          </div>
                          <div className="pt-2 border-t border-border">
                            <p className="text-muted-foreground mb-1">Description:</p>
                            <p className="text-foreground leading-relaxed">
                              {onUpdate ? (
                                <InlineEdit
                                  value={character.description}
                                  onSave={(value) => {
                                    const updated = [...encounteredCharacters];
                                    const origIndex = encounteredCharacters.findIndex(c => c.id === character.id);
                                    updated[origIndex] = { ...character, description: String(value) };
                                    onUpdate({ encounteredCharacters: updated });
                                  }}
                                  type="textarea"
                                  className="text-xs"
                                  inputClassName="text-xs"
                                />
                              ) : (
                                <span>{character.description}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>
          </ScrollArea>
        </div>
      </TabsContent>

      <TabsContent value="history" className="flex-1 mt-0 border-none p-0">
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="p-4 space-y-3">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No history yet</p>
            ) : (
              history.map((recap, index) => (
                <div
                  key={index}
                  className="border-l-2 border-primary pl-3 py-2"
                  data-testid={`history-${index}`}
                >
                  <p className="text-xs text-muted-foreground leading-relaxed">{recap}</p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </TabsContent>
      
      {/* Entity Detail Sheet */}
      <EntityDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        entity={detailEntity}
        entityType={detailEntityType}
        onRefresh={onRefreshImage ? handleRefreshImage : undefined}
        isRefreshing={isRefreshingImage}
      />
    </Tabs>
  );
}
