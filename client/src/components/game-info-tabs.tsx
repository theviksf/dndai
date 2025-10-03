import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Backpack, ScrollText, Users, UserCircle, History, Sparkles, MapPin } from 'lucide-react';
import type { InventoryItem, Quest, Companion, EncounteredCharacter, Spell, GameStateData } from '@shared/schema';
import { InlineEdit } from '@/components/ui/inline-edit';

interface GameInfoTabsProps {
  inventory: InventoryItem[];
  quests: Quest[];
  spells: Spell[];
  companions: Companion[];
  encounteredCharacters: EncounteredCharacter[];
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
  history,
  previousLocations,
  onUpdate,
}: GameInfoTabsProps) {
  return (
    <Tabs defaultValue="inventory" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-7 bg-muted/50 border-b border-border">
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
            {previousLocations.length === 0 ? (
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
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="p-4 space-y-4">
            {encounteredCharacters.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No characters encountered</p>
            ) : (
              encounteredCharacters.map((character, index) => (
                <div
                  key={character.id}
                  className="border-2 border-border rounded-lg p-4 bg-card space-y-2"
                  data-testid={`encountered-${character.id}`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-base">
                      {onUpdate ? (
                        <InlineEdit
                          value={character.name}
                          onSave={(value) => {
                            const updated = [...encounteredCharacters];
                            updated[index] = { ...character, name: String(value) };
                            onUpdate({ encounteredCharacters: updated });
                          }}
                          inputClassName="text-base font-semibold"
                        />
                      ) : (
                        <span>{character.name}</span>
                      )}
                    </h4>
                    <span className="text-xs bg-accent/10 text-accent px-2 py-1 rounded">
                      {onUpdate ? (
                        <InlineEdit
                          value={character.role}
                          onSave={(value) => {
                            const updated = [...encounteredCharacters];
                            updated[index] = { ...character, role: String(value) };
                            onUpdate({ encounteredCharacters: updated });
                          }}
                          className="text-xs"
                          inputClassName="h-5 text-xs"
                        />
                      ) : (
                        <span>{character.role}</span>
                      )}
                    </span>
                  </div>
                  <div className="pt-2 space-y-2 border-t border-border">
                    <p className="text-xs text-foreground leading-relaxed">
                      {onUpdate ? (
                        <InlineEdit
                          value={character.appearance}
                          onSave={(value) => {
                            const updated = [...encounteredCharacters];
                            updated[index] = { ...character, appearance: String(value) };
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
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {onUpdate ? (
                        <InlineEdit
                          value={character.description}
                          onSave={(value) => {
                            const updated = [...encounteredCharacters];
                            updated[index] = { ...character, description: String(value) };
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
              ))
            )}
          </div>
        </ScrollArea>
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
