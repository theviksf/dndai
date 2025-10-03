import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Backpack, ScrollText, Users, UserCircle, History, Sparkles, MapPin, Building2 } from 'lucide-react';
import type { InventoryItem, Quest, Companion, EncounteredCharacter, Spell, Business, GameStateData } from '@shared/schema';
import { InlineEdit } from '@/components/ui/inline-edit';

interface GameInfoTabsProps {
  inventory: InventoryItem[];
  quests: Quest[];
  spells: Spell[];
  companions: Companion[];
  encounteredCharacters: EncounteredCharacter[];
  businesses: Business[];
  history: string[];
  previousLocations: string[];
  onUpdate?: (updates: Partial<GameStateData>) => void;
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
  onUpdate,
}: GameInfoTabsProps) {
  const [npcSortBy, setNpcSortBy] = useState<'name' | 'role' | 'location'>('name');

  const sortedNPCs = [...encounteredCharacters].sort((a, b) => {
    if (npcSortBy === 'name') return a.name.localeCompare(b.name);
    if (npcSortBy === 'role') return a.role.localeCompare(b.role);
    if (npcSortBy === 'location') return (a.location || '').localeCompare(b.location || '');
    return 0;
  });

  return (
    <Tabs defaultValue="inventory" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-8 bg-muted/50 border-b border-border">
        <TabsTrigger value="inventory" className="gap-1 text-xs" data-testid="tab-inventory">
          <Backpack className="w-4 h-4" />
          <span className="hidden lg:inline">Inventory</span>
        </TabsTrigger>
        <TabsTrigger value="spells" className="gap-1 text-xs" data-testid="tab-spells">
          <Sparkles className="w-4 h-4" />
          <span className="hidden lg:inline">Spells</span>
        </TabsTrigger>
        <TabsTrigger value="locations" className="gap-1 text-xs" data-testid="tab-locations">
          <MapPin className="w-4 h-4" />
          <span className="hidden lg:inline">Locations</span>
        </TabsTrigger>
        <TabsTrigger value="businesses" className="gap-1 text-xs" data-testid="tab-businesses">
          <Building2 className="w-4 h-4" />
          <span className="hidden lg:inline">Business</span>
        </TabsTrigger>
        <TabsTrigger value="quests" className="gap-1 text-xs" data-testid="tab-quests">
          <ScrollText className="w-4 h-4" />
          <span className="hidden lg:inline">Quests</span>
        </TabsTrigger>
        <TabsTrigger value="companions" className="gap-1 text-xs" data-testid="tab-companions">
          <Users className="w-4 h-4" />
          <span className="hidden lg:inline">Party</span>
        </TabsTrigger>
        <TabsTrigger value="encounters" className="gap-1 text-xs" data-testid="tab-encounters">
          <UserCircle className="w-4 h-4" />
          <span className="hidden lg:inline">NPCs</span>
        </TabsTrigger>
        <TabsTrigger value="history" className="gap-1 text-xs" data-testid="tab-history">
          <History className="w-4 h-4" />
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
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="p-4 space-y-3">
            {spells.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No spells learned</p>
            ) : (
              spells.map((spell, index) => (
                <div
                  key={spell.id}
                  className="border border-border rounded-lg p-3 bg-card hover:bg-accent/5 transition-colors"
                  data-testid={`spell-${spell.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">
                      {onUpdate ? (
                        <InlineEdit
                          value={spell.icon}
                          onSave={(value) => {
                            const updated = [...spells];
                            updated[index] = { ...spell, icon: String(value) };
                            onUpdate({ spells: updated });
                          }}
                          className="text-2xl"
                          inputClassName="w-12 h-8 text-2xl text-center"
                        />
                      ) : (
                        <span>{spell.icon}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-semibold text-sm">
                          {onUpdate ? (
                            <InlineEdit
                              value={spell.name}
                              onSave={(value) => {
                                const updated = [...spells];
                                updated[index] = { ...spell, name: String(value) };
                                onUpdate({ spells: updated });
                              }}
                              inputClassName="text-sm font-semibold"
                            />
                          ) : (
                            <span>{spell.name}</span>
                          )}
                        </h4>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded flex items-center gap-1">
                          Lv.
                          {onUpdate ? (
                            <InlineEdit
                              value={spell.level}
                              onSave={(value) => {
                                const updated = [...spells];
                                updated[index] = { ...spell, level: Number(value) };
                                onUpdate({ spells: updated });
                              }}
                              type="number"
                              min={0}
                              max={9}
                              inputClassName="w-10 h-5 text-xs"
                            />
                          ) : (
                            <span>{spell.level}</span>
                          )}
                        </span>
                      </div>
                      <p className="text-xs text-accent mt-1">
                        {onUpdate ? (
                          <InlineEdit
                            value={spell.school}
                            onSave={(value) => {
                              const updated = [...spells];
                              updated[index] = { ...spell, school: String(value) };
                              onUpdate({ spells: updated });
                            }}
                            className="text-xs text-accent"
                            inputClassName="h-5 text-xs"
                          />
                        ) : (
                          <span>{spell.school}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {onUpdate ? (
                          <InlineEdit
                            value={spell.description}
                            onSave={(value) => {
                              const updated = [...spells];
                              updated[index] = { ...spell, description: String(value) };
                              onUpdate({ spells: updated });
                            }}
                            type="textarea"
                            className="text-xs"
                            inputClassName="text-xs"
                          />
                        ) : (
                          <span>{spell.description}</span>
                        )}
                      </p>
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
                {previousLocations.map((location, index) => (
                  <div
                    key={index}
                    className="border border-border rounded-lg p-3 bg-card"
                    data-testid={`location-${index}`}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">{location}</span>
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
                          {quest.objectives.map((obj, idx) => (
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
                        , Age{' '}
                        <InlineEdit
                          value={companion.age}
                          onSave={(value) => {
                            const updated = [...companions];
                            updated[index] = { ...companion, age: String(value) };
                            onUpdate({ companions: updated });
                          }}
                          inputClassName="h-5 text-xs w-16"
                        />
                      </>
                    ) : (
                      <span>{companion.race} {companion.class}, Age {companion.age}</span>
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
                      </AccordionTrigger>
                      <AccordionContent className="pb-3 pt-1">
                        <div className="space-y-2 text-xs">
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
    </Tabs>
  );
}
