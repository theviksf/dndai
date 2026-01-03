import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { MapPin, X, Plus } from 'lucide-react';
import type { InventoryItem, Quest, Companion, EncounteredCharacter, Spell, RacialAbility, ClassFeature, ClassPower, Business, GameStateData, PreviousLocation } from '@shared/schema';
import { InlineEdit } from '@/components/ui/inline-edit';
import { EntityImageCard } from '@/components/entity-image-card';
import { nanoid } from 'nanoid';

interface BasePanelProps {
  onUpdate?: (updates: Partial<GameStateData>) => void;
  onEntityClick?: (entity: any, type: 'companion' | 'npc' | 'location' | 'business' | 'quest') => void;
}

interface InventoryPanelProps extends BasePanelProps {
  inventory: InventoryItem[];
}

export function InventoryPanel({ inventory, onUpdate }: InventoryPanelProps) {
  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
      <div className="p-4 space-y-3">
        {inventory.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No items in inventory</p>
        ) : (
          inventory.map((item) => (
            <div
              key={item.id}
              className="border border-border rounded-lg p-3 bg-card hover:bg-accent/5 transition-colors relative"
              data-testid={`inventory-item-${item.id}`}
            >
              <button
                onClick={() => {
                  if (onUpdate) {
                    onUpdate({
                      inventory: inventory.filter(i => i.id !== item.id)
                    });
                  }
                }}
                className="absolute top-2 right-2 w-5 h-5 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive flex items-center justify-center transition-colors"
                data-testid={`button-delete-item-${item.id}`}
              >
                <X className="w-3 h-3" />
              </button>

              <div className="flex items-start gap-3 pr-6">
                <div className="text-2xl">{item.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-sm">{item.name}</h4>
                    <div className="flex items-center gap-2">
                      {item.quantity > 1 && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          x{item.quantity}
                        </span>
                      )}
                      {item.price !== undefined && (
                        <span className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-500">
                          {item.price} gp
                        </span>
                      )}
                    </div>
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
  );
}

interface SpellsPanelProps extends BasePanelProps {
  spells: Spell[];
  racialAbilities: RacialAbility[];
  classFeatures: ClassFeature[];
  classPowers: ClassPower[];
}

export function SpellsPanel({ spells, racialAbilities, classFeatures, classPowers, onUpdate }: SpellsPanelProps) {
  const [filter, setFilter] = useState<string>('');
  const [spellLevelFilter, setSpellLevelFilter] = useState<string>('all');
  const [spellSortBy, setSpellSortBy] = useState<'name' | 'level' | 'school'>('name');

  const filteredAndSortedSpells = [...spells]
    .filter(spell => {
      const matchesText = filter === '' || 
        spell.name.toLowerCase().includes(filter.toLowerCase()) ||
        spell.school.toLowerCase().includes(filter.toLowerCase()) ||
        spell.description.toLowerCase().includes(filter.toLowerCase());
      
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

  const filteredRacialAbilities = racialAbilities.filter(ability => 
    filter === '' || 
    ability.name.toLowerCase().includes(filter.toLowerCase()) ||
    ability.race.toLowerCase().includes(filter.toLowerCase()) ||
    ability.description.toLowerCase().includes(filter.toLowerCase())
  );

  const filteredClassFeatures = classFeatures.filter(feature => 
    filter === '' || 
    feature.name.toLowerCase().includes(filter.toLowerCase()) ||
    feature.class.toLowerCase().includes(filter.toLowerCase()) ||
    feature.description.toLowerCase().includes(filter.toLowerCase())
  );

  const filteredClassPowers = classPowers.filter(power => 
    filter === '' || 
    power.name.toLowerCase().includes(filter.toLowerCase()) ||
    power.class.toLowerCase().includes(filter.toLowerCase()) ||
    (power.subclass && power.subclass.toLowerCase().includes(filter.toLowerCase())) ||
    power.description.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Tabs defaultValue="spells" className="h-full">
      <div className="p-3 border-b border-border bg-muted/30">
        <TabsList className="grid w-full grid-cols-4 h-8 mb-2">
          <TabsTrigger value="spells" className="text-[10px] px-1" data-testid="tab-spells">Spells</TabsTrigger>
          <TabsTrigger value="racial" className="text-[10px] px-1" data-testid="tab-racial">Racial</TabsTrigger>
          <TabsTrigger value="features" className="text-[10px] px-1" data-testid="tab-features">Features</TabsTrigger>
          <TabsTrigger value="powers" className="text-[10px] px-1" data-testid="tab-powers">Powers</TabsTrigger>
        </TabsList>
        <Input
          placeholder="Search..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 text-xs mb-2"
          data-testid="input-ability-search"
        />
      </div>

      <TabsContent value="spells" className="mt-0">
        <div className="p-3 border-b border-border bg-muted/30 space-y-2">
          <div className="flex gap-2">
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
            <Select value={spellSortBy} onValueChange={(value: any) => setSpellSortBy(value)}>
              <SelectTrigger className="flex-1 h-8 text-xs" data-testid="select-spell-sort">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="level">Level</SelectItem>
                <SelectItem value="school">School</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <ScrollArea className="h-[calc(100vh-380px)]">
          <div className="p-3 space-y-2">
            {filteredAndSortedSpells.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {spells.length === 0 ? 'No spells learned' : 'No spells match your filters'}
              </p>
            ) : (
              filteredAndSortedSpells.map((spell) => (
                <div
                  key={spell.id}
                  className="border border-border rounded p-2 bg-card hover:bg-accent/5 transition-colors"
                  data-testid={`spell-${spell.id}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">{spell.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-xs">{spell.name}</span>
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded flex-shrink-0">
                          {spell.level === 0 ? 'C' : `L${spell.level}`}
                        </span>
                      </div>
                      <div className="text-[10px] text-accent mt-0.5">{spell.school}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{spell.description}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="racial" className="mt-0">
        <ScrollArea className="h-[calc(100vh-290px)]">
          <div className="p-3 space-y-2">
            {filteredRacialAbilities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {racialAbilities.length === 0 ? 'No racial abilities' : 'No abilities match your search'}
              </p>
            ) : (
              filteredRacialAbilities.map((ability) => (
                <div
                  key={ability.id}
                  className="border border-border rounded p-2 bg-card hover:bg-accent/5 transition-colors"
                  data-testid={`racial-ability-${ability.id}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">{ability.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-xs">{ability.name}</span>
                        <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded flex-shrink-0">
                          {ability.race}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{ability.description}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="features" className="mt-0">
        <ScrollArea className="h-[calc(100vh-290px)]">
          <div className="p-3 space-y-2">
            {filteredClassFeatures.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {classFeatures.length === 0 ? 'No class features' : 'No features match your search'}
              </p>
            ) : (
              filteredClassFeatures.map((feature) => (
                <div
                  key={feature.id}
                  className="border border-border rounded p-2 bg-card hover:bg-accent/5 transition-colors"
                  data-testid={`class-feature-${feature.id}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">{feature.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-xs">{feature.name}</span>
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded flex-shrink-0">
                          {feature.class}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{feature.description}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="powers" className="mt-0">
        <ScrollArea className="h-[calc(100vh-290px)]">
          <div className="p-3 space-y-2">
            {filteredClassPowers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {classPowers.length === 0 ? 'No class powers' : 'No powers match your search'}
              </p>
            ) : (
              filteredClassPowers.map((power) => (
                <div
                  key={power.id}
                  className="border border-border rounded p-2 bg-card hover:bg-accent/5 transition-colors"
                  data-testid={`class-power-${power.id}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">{power.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-xs">{power.name}</span>
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded flex-shrink-0">
                          {power.subclass || power.class}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{power.description}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

function getRelationshipDisplay(score: number): { label: string; textColor: string; description: string } {
  if (score === 0) return { label: 'Neutral', textColor: 'text-gray-500 dark:text-gray-400', description: 'No particular feelings either way' };
  if (score === -1) return { label: 'Cold', textColor: 'text-red-400 dark:text-red-400', description: 'Slightly negative, indifferent but irritable' };
  if (score === -2) return { label: 'Unfriendly', textColor: 'text-red-500 dark:text-red-500', description: 'Dislikes you, distrustful' };
  if (score <= -3) return { label: 'Hostile', textColor: 'text-red-600 dark:text-red-600', description: 'Actively hates or seeks to harm you' };
  if (score === 1) return { label: 'Warm', textColor: 'text-green-400 dark:text-green-400', description: 'Generally positive or mildly interested' };
  if (score === 2) return { label: 'Friendly', textColor: 'text-green-500 dark:text-green-500', description: 'Likes you, emotionally invested' };
  if (score >= 3) return { label: 'Devoted', textColor: 'text-green-600 dark:text-green-600', description: 'Deeply loyal, affection or admiration' };
  return { label: 'Neutral', textColor: 'text-gray-500 dark:text-gray-400', description: 'No particular feelings either way' };
}

interface LocationsPanelProps extends BasePanelProps {
  previousLocations: PreviousLocation[];
}

export function LocationsPanel({ previousLocations, onEntityClick }: LocationsPanelProps) {
  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
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
                onClick={() => onEntityClick?.(location, 'location')}
              >
                <div className="flex items-start gap-3">
                  <div onClick={(e) => e.stopPropagation()}>
                    <EntityImageCard
                      imageUrl={location.imageUrl}
                      entityType="location"
                      onClick={() => onEntityClick?.(location, 'location')}
                      className="w-16 h-16 flex-shrink-0"
                    />
                  </div>
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
  );
}

interface BusinessesPanelProps extends BasePanelProps {
  businesses: Business[];
}

export function BusinessesPanel({ businesses, onEntityClick, onUpdate }: BusinessesPanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newBusiness, setNewBusiness] = useState({
    name: '',
    weeklyIncome: 0,
    runningCost: 0,
    purchaseCost: 0,
    manager: '',
    description: '',
    details: ''
  });

  const handleAddBusiness = () => {
    if (!newBusiness.name.trim() || !onUpdate) return;
    
    const business: Business = {
      id: nanoid(),
      name: newBusiness.name.trim(),
      weeklyIncome: newBusiness.weeklyIncome,
      runningCost: newBusiness.runningCost,
      purchaseCost: newBusiness.purchaseCost,
      owner: 'Player',
      manager: newBusiness.manager.trim() || 'None',
      description: newBusiness.description.trim() || '',
      details: newBusiness.details.trim() || ''
    };
    
    onUpdate({
      businesses: [...(businesses || []), business]
    });
    
    setNewBusiness({ name: '', weeklyIncome: 0, runningCost: 0, purchaseCost: 0, manager: '', description: '', details: '' });
    setIsAdding(false);
  };

  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
      <div className="p-4 space-y-3">
        {/* Add Business Button/Form */}
        {onUpdate && (
          <div className="mb-4">
            {isAdding ? (
              <div className="border border-primary/50 rounded-lg p-4 bg-primary/5 space-y-3">
                <h4 className="font-semibold text-sm mb-2">Add New Business</h4>
                <Input
                  placeholder="Business name"
                  value={newBusiness.name}
                  onChange={(e) => setNewBusiness(prev => ({ ...prev, name: e.target.value }))}
                  className="h-8 text-sm"
                  data-testid="input-new-business-name"
                />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Weekly Income</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={newBusiness.weeklyIncome || ''}
                      onChange={(e) => setNewBusiness(prev => ({ ...prev, weeklyIncome: Number(e.target.value) || 0 }))}
                      className="h-8 text-sm"
                      data-testid="input-new-business-income"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Running Cost</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={newBusiness.runningCost || ''}
                      onChange={(e) => setNewBusiness(prev => ({ ...prev, runningCost: Number(e.target.value) || 0 }))}
                      className="h-8 text-sm"
                      data-testid="input-new-business-cost"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Purchase Cost</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={newBusiness.purchaseCost || ''}
                      onChange={(e) => setNewBusiness(prev => ({ ...prev, purchaseCost: Number(e.target.value) || 0 }))}
                      className="h-8 text-sm"
                      data-testid="input-new-business-purchase"
                    />
                  </div>
                </div>
                <Input
                  placeholder="Manager name (optional)"
                  value={newBusiness.manager}
                  onChange={(e) => setNewBusiness(prev => ({ ...prev, manager: e.target.value }))}
                  className="h-8 text-sm"
                  data-testid="input-new-business-manager"
                />
                <Input
                  placeholder="Description (optional)"
                  value={newBusiness.description}
                  onChange={(e) => setNewBusiness(prev => ({ ...prev, description: e.target.value }))}
                  className="h-8 text-sm"
                  data-testid="input-new-business-description"
                />
                <Input
                  placeholder="Details (optional)"
                  value={newBusiness.details}
                  onChange={(e) => setNewBusiness(prev => ({ ...prev, details: e.target.value }))}
                  className="h-8 text-sm"
                  data-testid="input-new-business-details"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAddBusiness}
                    disabled={!newBusiness.name.trim()}
                    data-testid="button-confirm-add-business"
                  >
                    Add Business
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsAdding(false);
                      setNewBusiness({ name: '', weeklyIncome: 0, runningCost: 0, purchaseCost: 0, manager: '', description: '', details: '' });
                    }}
                    data-testid="button-cancel-add-business"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setIsAdding(true)}
                data-testid="button-add-business"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Business
              </Button>
            )}
          </div>
        )}

        {!businesses || businesses.length === 0 ? (
          !isAdding && <p className="text-sm text-muted-foreground text-center py-8">No businesses owned</p>
        ) : (
          businesses.map((business) => (
            <div
              key={business.id}
              className="border border-border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors relative"
              data-testid={`business-${business.id}`}
            >
              <button
                onClick={() => {
                  if (onUpdate) {
                    onUpdate({
                      businesses: businesses.filter(b => b.id !== business.id)
                    });
                  }
                }}
                className="absolute top-2 right-2 w-5 h-5 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive flex items-center justify-center transition-colors"
                data-testid={`button-delete-business-${business.id}`}
              >
                <X className="w-3 h-3" />
              </button>
              <div className="flex items-start gap-3">
                <EntityImageCard
                  imageUrl={business.imageUrl}
                  entityType="location"
                  onClick={() => onEntityClick?.(business, 'business')}
                  className="w-16 h-16 flex-shrink-0"
                />
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
                      <span className="text-muted-foreground">Owner:</span>
                      <span className="text-xs font-medium text-primary">{business.owner}</span>
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
  );
}

interface QuestsPanelProps extends BasePanelProps {
  quests: Quest[];
}

export function QuestsPanel({ quests, onEntityClick }: QuestsPanelProps) {
  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
      <div className="p-4 space-y-3">
        {quests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No active quests</p>
        ) : (
          quests.map((quest) => (
            <div
              key={quest.id}
              className="border border-border rounded-lg p-3 bg-card cursor-pointer hover:bg-accent/50 transition-colors"
              data-testid={`quest-${quest.id}`}
              onClick={() => onEntityClick?.(quest, 'quest')}
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
  );
}

interface CompanionsPanelProps extends BasePanelProps {
  companions: Companion[];
}

export function CompanionsPanel({ companions, onEntityClick }: CompanionsPanelProps) {
  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
      <div className="p-4">
        {companions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No companions yet</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {companions.map((companion) => {
              const relationship = typeof companion.relationship === 'string' 
                ? companion.relationship 
                : 'Unknown';
              return (
                <div key={companion.id} className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-accent/5 transition-colors">
                  <EntityImageCard
                    imageUrl={companion.imageUrl}
                    entityType="companion"
                    onClick={() => onEntityClick?.(companion, 'companion')}
                    className="w-full aspect-square"
                    data-testid={`companion-${companion.id}`}
                  />
                  <span className="text-sm font-medium text-center truncate w-full">{companion.name}</span>
                  <div className="text-xs text-muted-foreground text-center w-full">
                    <div className="truncate">{companion.class} • {companion.sex}</div>
                    {companion.age && <div className="truncate">Age {companion.age}</div>}
                  </div>
                  <div className="text-xs font-medium text-center text-muted-foreground mt-1">
                    {relationship}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

interface NPCsPanelProps extends BasePanelProps {
  encounteredCharacters: EncounteredCharacter[];
}

export function NPCsPanel({ encounteredCharacters, onEntityClick }: NPCsPanelProps) {
  const [npcSortBy, setNpcSortBy] = useState<'name' | 'role' | 'location'>('name');

  const sortedNPCs = [...encounteredCharacters].sort((a, b) => {
    if (npcSortBy === 'name') return a.name.localeCompare(b.name);
    if (npcSortBy === 'role') return a.role.localeCompare(b.role);
    if (npcSortBy === 'location') return (a.location || '').localeCompare(b.location || '');
    return 0;
  });

  return (
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
      <ScrollArea className="h-[calc(100vh-260px)]">
        <div className="p-4">
          {sortedNPCs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No characters encountered</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {sortedNPCs.map((character) => {
                const relScore = character.relationship ?? 0;
                const relDisplay = getRelationshipDisplay(relScore);
                return (
                  <div key={character.id} className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-accent/5 transition-colors">
                    <EntityImageCard
                      imageUrl={character.imageUrl}
                      entityType="npc"
                      onClick={() => onEntityClick?.(character, 'npc')}
                      className="w-full aspect-square"
                      data-testid={`encountered-${character.id}`}
                    />
                    <span className="text-sm font-medium text-center truncate w-full">{character.name}</span>
                    <div className="text-xs text-muted-foreground text-center w-full">
                      <div className="truncate">{character.role} • {character.sex}</div>
                      {character.age && <div className="truncate">Age {character.age}</div>}
                    </div>
                    <span 
                      className={`text-xs font-medium ${relDisplay.textColor} mt-1`}
                      title={relDisplay.description}
                      data-testid={`relationship-${character.id}`}
                    >
                      {relDisplay.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface HistoryPanelProps {
  history: string[];
}

export function HistoryPanel({ history }: HistoryPanelProps) {
  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
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
  );
}
