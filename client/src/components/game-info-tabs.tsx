import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Backpack, ScrollText, Users, UserCircle, History, Sparkles } from 'lucide-react';
import type { InventoryItem, Quest, Companion, EncounteredCharacter, Spell } from '@shared/schema';

interface GameInfoTabsProps {
  inventory: InventoryItem[];
  quests: Quest[];
  spells: Spell[];
  companions: Companion[];
  encounteredCharacters: EncounteredCharacter[];
  history: string[];
}

export default function GameInfoTabs({
  inventory,
  quests,
  spells,
  companions,
  encounteredCharacters,
  history,
}: GameInfoTabsProps) {
  return (
    <Tabs defaultValue="inventory" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-6 bg-muted/50 border-b border-border">
        <TabsTrigger value="inventory" className="gap-1 text-xs" data-testid="tab-inventory">
          <Backpack className="w-4 h-4" />
          <span className="hidden lg:inline">Inventory</span>
        </TabsTrigger>
        <TabsTrigger value="spells" className="gap-1 text-xs" data-testid="tab-spells">
          <Sparkles className="w-4 h-4" />
          <span className="hidden lg:inline">Spells</span>
        </TabsTrigger>
        <TabsTrigger value="quests" className="gap-1 text-xs" data-testid="tab-quests">
          <ScrollText className="w-4 h-4" />
          <span className="hidden lg:inline">Quests</span>
        </TabsTrigger>
        <TabsTrigger value="companions" className="gap-1 text-xs" data-testid="tab-companions">
          <Users className="w-4 h-4" />
          <span className="hidden lg:inline">Allies</span>
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
              spells.map((spell) => (
                <div
                  key={spell.id}
                  className="border border-border rounded-lg p-3 bg-card hover:bg-accent/5 transition-colors"
                  data-testid={`spell-${spell.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{spell.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-semibold text-sm">{spell.name}</h4>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          Lv.{spell.level}
                        </span>
                      </div>
                      <p className="text-xs text-accent mt-1">{spell.school}</p>
                      <p className="text-xs text-muted-foreground mt-1">{spell.description}</p>
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
              companions.map((companion) => (
                <div
                  key={companion.id}
                  className="border-2 border-border rounded-lg p-4 bg-card space-y-2"
                  data-testid={`companion-${companion.id}`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-base">{companion.name}</h4>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      Lv. {companion.level}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {companion.race} {companion.class}, Age {companion.age}
                  </p>
                  <div className="pt-2 space-y-2 border-t border-border">
                    <p className="text-xs text-foreground leading-relaxed">{companion.appearance}</p>
                    <p className="text-xs text-muted-foreground italic leading-relaxed">{companion.personality}</p>
                  </div>
                  {companion.relationship && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs font-medium text-accent">Relationship: {companion.relationship}</p>
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
              encounteredCharacters.map((character) => (
                <div
                  key={character.id}
                  className="border-2 border-border rounded-lg p-4 bg-card space-y-2"
                  data-testid={`encountered-${character.id}`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-base">{character.name}</h4>
                    <span className="text-xs bg-accent/10 text-accent px-2 py-1 rounded">
                      {character.role}
                    </span>
                  </div>
                  <div className="pt-2 space-y-2 border-t border-border">
                    <p className="text-xs text-foreground leading-relaxed">{character.appearance}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{character.description}</p>
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
