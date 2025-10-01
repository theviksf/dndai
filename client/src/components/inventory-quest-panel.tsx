import type { GameStateData } from '@shared/schema';
import { Package, ScrollText, CheckCircle2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InventoryQuestPanelProps {
  inventory: GameStateData['inventory'];
  quests: GameStateData['quests'];
  history: string[];
}

export default function InventoryQuestPanel({ inventory, quests, history }: InventoryQuestPanelProps) {
  const activeQuests = quests.filter(q => !q.completed);
  const completedQuests = quests.filter(q => q.completed);

  return (
    <aside className="lg:col-span-3 space-y-4">
      {/* Inventory */}
      <div className="bg-card border-2 border-border rounded-lg ornate-border parchment-texture overflow-hidden">
        <div className="bg-gradient-to-b from-primary/20 to-transparent p-4 border-b border-border">
          <h2 className="text-xl font-serif font-semibold text-primary flex items-center gap-2">
            <Package className="w-5 h-5" />
            Inventory
          </h2>
        </div>

        <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
          {inventory.length > 0 ? (
            inventory.map(item => (
              <div
                key={item.id}
                className={`rounded-md p-3 border-2 transition-colors cursor-pointer ${
                  item.equipped 
                    ? 'bg-secondary/10 border-secondary' 
                    : 'bg-muted/30 border-border hover:border-primary'
                }`}
                data-testid={`inventory-item-${item.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{item.icon}</span>
                      <span className="text-sm font-semibold text-foreground">{item.name}</span>
                      {item.quantity > 1 && (
                        <span className="bg-accent/20 text-accent text-xs px-2 py-0.5 rounded font-mono">
                          x{item.quantity}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">{item.description}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.equipped && (
                        <span className="bg-secondary/20 text-secondary text-xs px-2 py-0.5 rounded">
                          Equipped
                        </span>
                      )}
                      {item.magical && (
                        <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded">
                          Magical
                        </span>
                      )}
                      {item.type === 'quest' && (
                        <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded">
                          Quest Item
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Your inventory is empty
            </div>
          )}
        </div>
      </div>

      {/* Active Quests */}
      <div className="bg-card border-2 border-border rounded-lg ornate-border parchment-texture overflow-hidden">
        <div className="bg-gradient-to-b from-primary/20 to-transparent p-4 border-b border-border">
          <h2 className="text-xl font-serif font-semibold text-primary flex items-center gap-2">
            <ScrollText className="w-5 h-5" />
            Quest Log
          </h2>
        </div>

        <div className="p-4 space-y-3">
          {activeQuests.length > 0 ? (
            activeQuests.map(quest => (
              <div
                key={quest.id}
                className={`rounded-md p-3 border-2 ${
                  quest.type === 'main' 
                    ? 'bg-primary/10 border-primary' 
                    : 'bg-muted/30 border-border'
                }`}
                data-testid={`quest-${quest.id}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-2xl mt-1">{quest.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-serif font-semibold text-primary">
                        {quest.title}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        quest.type === 'main' 
                          ? 'bg-primary/20 text-primary' 
                          : 'bg-accent/20 text-accent'
                      }`}>
                        {quest.type === 'main' ? 'Main' : 'Side'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{quest.description}</p>
                    
                    {quest.objectives.length > 0 && (
                      <div className="space-y-1">
                        {quest.objectives.map((obj, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            {obj.completed ? (
                              <CheckCircle2 className="w-3 h-3 text-accent" />
                            ) : (
                              <div className="w-3 h-3 border-2 border-muted-foreground rounded-sm" />
                            )}
                            <span className={obj.completed ? 'text-muted-foreground line-through' : 'text-foreground font-medium'}>
                              {obj.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {quest.progress && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Progress:</span>
                          <span className="font-mono text-accent">
                            {quest.progress.current}/{quest.progress.total}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div 
                            className="bg-accent h-1.5 rounded-full transition-all" 
                            style={{ width: `${(quest.progress.current / quest.progress.total) * 100}%` }} 
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No active quests
            </div>
          )}

          {completedQuests.length > 0 && (
            <>
              <div className="border-t border-border my-3 pt-3">
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">Completed</h3>
              </div>
              {completedQuests.map(quest => (
                <div
                  key={quest.id}
                  className="bg-accent/10 border border-accent rounded-md p-3 opacity-70"
                  data-testid={`quest-completed-${quest.id}`}
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-accent mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-serif font-semibold text-foreground line-through">
                          {quest.title}
                        </span>
                        <span className="bg-accent/20 text-accent text-xs px-2 py-0.5 rounded">
                          Complete
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* History */}
      <div className="bg-card border-2 border-border rounded-lg ornate-border parchment-texture overflow-hidden">
        <div className="bg-gradient-to-b from-primary/20 to-transparent p-4 border-b border-border">
          <h2 className="text-xl font-serif font-semibold text-primary flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            History
          </h2>
        </div>

        <div className="p-4 space-y-2 max-h-[300px] overflow-y-auto">
          {history.length > 0 ? (
            history.map((entry, idx) => (
              <div
                key={idx}
                className="bg-muted/30 border border-border rounded-md p-3"
                data-testid={`history-entry-${idx}`}
              >
                <p className="text-xs text-foreground leading-relaxed">{entry}</p>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Your journey begins...
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
