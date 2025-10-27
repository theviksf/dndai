import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, User, MapPin, Heart, Skull, Shield, Coins, Sparkles, Star, Pencil, Check, X } from 'lucide-react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { InlineEdit } from '@/components/ui/inline-edit';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { GameCharacter, Companion, EncounteredCharacter, Location, Business, Quest, StatusEffect } from '@shared/schema';

// Helper function to get relationship display info
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

// Helper function to get attribute modifier
function getModifier(score: number | undefined): string {
  if (score == null) return '+0';
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

interface EntityDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: GameCharacter | Companion | EncounteredCharacter | Location | Business | Quest | null;
  entityType: 'character' | 'companion' | 'npc' | 'location' | 'business' | 'quest';
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onUpdate?: (updates: Partial<GameCharacter | Companion | EncounteredCharacter | Location | Business | Quest>) => void;
  statusEffects?: StatusEffect[];
  businesses?: Business[];
}

export function EntityDetailSheet({ 
  open, 
  onOpenChange, 
  entity, 
  entityType,
  onRefresh,
  isRefreshing = false,
  onUpdate,
  statusEffects = [],
  businesses = []
}: EntityDetailSheetProps) {
  const [isEditingBackstory, setIsEditingBackstory] = useState(false);
  const [backstoryEditValue, setBackstoryEditValue] = useState('');
  
  // Reset edit state when sheet is closed
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setIsEditingBackstory(false);
      setBackstoryEditValue('');
    }
    onOpenChange(newOpen);
  };
  
  if (!entity) return null;

  const Icon = entityType === 'location' || entityType === 'business' ? MapPin : entityType === 'quest' ? null : User;
  
  const renderMetadata = () => {
    if (entityType === 'location') {
      const loc = entity as Location;
      return (
        <div className="space-y-3">
          {/* Basic Info */}
          <div className="flex items-baseline gap-2">
            <span className="font-serif font-semibold text-foreground min-w-[100px]">Name:</span>
            {onUpdate ? (
              <InlineEdit
                value={loc.name}
                onSave={(value) => onUpdate({ name: String(value) } as any)}
                inputClassName="h-7 text-base"
              />
            ) : (
              <span className="text-foreground font-medium text-base">{loc.name}</span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif font-semibold text-foreground min-w-[100px]">Type:</span>
            {onUpdate ? (
              <InlineEdit
                value={loc.type || ''}
                onSave={(value) => onUpdate({ type: String(value) } as any)}
                inputClassName="h-7 text-base"
              />
            ) : (
              <Badge variant="secondary" className="font-semibold text-sm capitalize">
                {loc.type || 'Unknown'}
              </Badge>
            )}
          </div>
          <div className="pt-3 border-t border-border">
            <span className="font-serif font-bold text-foreground block mb-2">Description:</span>
            {onUpdate ? (
              <InlineEdit
                value={loc.description || ''}
                onSave={(value) => onUpdate({ description: String(value) } as any)}
                type="textarea"
                inputClassName="text-sm leading-relaxed"
              />
            ) : (
              <p className="text-foreground text-sm leading-relaxed italic">{loc.description || 'No description'}</p>
            )}
          </div>

          {/* Hierarchy */}
          {loc.hierarchy && (
            <div className="pt-3 border-t border-border">
              <h4 className="font-semibold text-foreground mb-2">Location Hierarchy</h4>
              <div className="space-y-1 ml-2">
                {loc.hierarchy.country && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">Country:</span>
                    <span className="text-foreground">{loc.hierarchy.country}</span>
                  </div>
                )}
                {loc.hierarchy.region && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">Region:</span>
                    <span className="text-foreground">{loc.hierarchy.region}</span>
                  </div>
                )}
                {loc.hierarchy.city && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">City:</span>
                    <span className="text-foreground">{loc.hierarchy.city}</span>
                  </div>
                )}
                {loc.hierarchy.district && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">District:</span>
                    <span className="text-foreground">{loc.hierarchy.district}</span>
                  </div>
                )}
                {loc.hierarchy.building && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">Building:</span>
                    <span className="text-foreground">{loc.hierarchy.building}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Relative Location */}
          {loc.relative_location && loc.relative_location.reference_place && (
            <div className="pt-3 border-t border-border">
              <h4 className="font-semibold text-foreground mb-2">Relative Location</h4>
              <div className="ml-2">
                <p className="text-muted-foreground">
                  {loc.relative_location.distance_km && loc.relative_location.direction && (
                    <>{loc.relative_location.distance_km}km {loc.relative_location.direction} of </>
                  )}
                  {loc.relative_location.reference_place}
                </p>
              </div>
            </div>
          )}

          {/* Details */}
          {loc.details && (
            <div className="pt-3 border-t border-border">
              <h4 className="font-semibold text-foreground mb-2">Details</h4>
              <div className="space-y-1 ml-2">
                {loc.details.owner && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">Owner:</span>
                    <span className="text-foreground">{loc.details.owner}</span>
                  </div>
                )}
                {loc.details.notable_people && loc.details.notable_people.length > 0 && (
                  <div>
                    <span className="text-muted-foreground text-xs">Notable People:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {loc.details.notable_people.map((person, idx) => (
                        <span key={idx} className="inline-block bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">
                          {person}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {loc.details.capacity && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">Capacity:</span>
                    <span className="text-foreground">{loc.details.capacity}</span>
                  </div>
                )}
                {loc.details.services && loc.details.services.length > 0 && (
                  <div>
                    <span className="text-muted-foreground text-xs">Services:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {loc.details.services.map((service, idx) => (
                        <span key={idx} className="inline-block bg-accent/10 text-accent px-2 py-0.5 rounded text-xs capitalize">
                          {service}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {loc.details.price_range && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">Price Range:</span>
                    <span className="text-foreground capitalize">{loc.details.price_range}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Nearby Locations */}
          {loc.connections?.nearby_locations && loc.connections.nearby_locations.length > 0 && (
            <div className="pt-3 border-t border-border">
              <h4 className="font-semibold text-foreground mb-2">Nearby Locations</h4>
              <div className="space-y-2 ml-2">
                {loc.connections.nearby_locations.map((nearby, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-foreground">{nearby.name}</span>
                    <span className="text-muted-foreground text-xs">
                      ({nearby.distance_km}km {nearby.direction})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    
    if (entityType === 'business') {
      const biz = entity as Business;
      const netIncome = biz.weeklyIncome - biz.runningCost;
      
      return (
        <div className="space-y-3">
          {/* Basic Info */}
          <div className="flex items-baseline gap-2">
            <span className="font-serif font-semibold text-foreground min-w-[120px]">Name:</span>
            {onUpdate ? (
              <InlineEdit
                value={biz.name}
                onSave={(value) => onUpdate({ name: String(value) } as any)}
                inputClassName="h-7 text-base"
              />
            ) : (
              <span className="text-foreground font-medium text-base">{biz.name}</span>
            )}
          </div>
          <div className="pt-3 border-t border-border">
            <span className="font-serif font-bold text-foreground block mb-2">Description:</span>
            {onUpdate ? (
              <InlineEdit
                value={biz.description || ''}
                onSave={(value) => onUpdate({ description: String(value) } as any)}
                type="textarea"
                inputClassName="text-sm leading-relaxed"
              />
            ) : (
              <p className="text-foreground text-sm leading-relaxed italic">{biz.description || 'No description'}</p>
            )}
          </div>

          {/* Financial Info */}
          <div className="pt-3 border-t border-border">
            <h4 className="font-serif font-bold text-foreground mb-3">Financial Details</h4>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground text-sm">Weekly Income:</span>
                {onUpdate ? (
                  <InlineEdit
                    value={biz.weeklyIncome}
                    onSave={(value) => onUpdate({ weeklyIncome: Number(value) } as any)}
                    type="number"
                    min={0}
                    inputClassName="h-7 text-base w-24 text-right"
                  />
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-base">{biz.weeklyIncome.toLocaleString()} GP</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground text-sm">Running Cost:</span>
                {onUpdate ? (
                  <InlineEdit
                    value={biz.runningCost}
                    onSave={(value) => onUpdate({ runningCost: Number(value) } as any)}
                    type="number"
                    min={0}
                    inputClassName="h-7 text-base w-24 text-right"
                  />
                ) : (
                  <span className="text-red-600 dark:text-red-400 font-bold text-base">{biz.runningCost.toLocaleString()} GP</span>
                )}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="font-bold text-foreground">Net Weekly Profit:</span>
                <span className={`font-bold text-base ${
                  netIncome > 0 ? 'text-emerald-600 dark:text-emerald-400' : 
                  netIncome < 0 ? 'text-red-600 dark:text-red-400' : 
                  'text-muted-foreground'
                }`}>
                  {netIncome > 0 ? '+' : ''}{netIncome.toLocaleString()} GP/week
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <span className="font-medium text-foreground text-sm">Purchase Cost:</span>
                <span className="text-muted-foreground font-bold text-base">{biz.purchaseCost.toLocaleString()} GP</span>
              </div>
            </div>
          </div>

          {/* Management */}
          <div className="pt-3 border-t border-border">
            <h4 className="font-serif font-bold text-foreground mb-3">Management</h4>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="font-medium text-foreground text-sm min-w-[100px]">Owner:</span>
              {onUpdate ? (
                <InlineEdit
                  value={biz.owner || ''}
                  onSave={(value) => onUpdate({ owner: String(value) } as any)}
                  inputClassName="h-7 text-base"
                />
              ) : (
                <span className="text-foreground text-base font-semibold text-primary">{biz.owner || 'None'}</span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-medium text-foreground text-sm min-w-[100px]">Manager:</span>
              {onUpdate ? (
                <InlineEdit
                  value={biz.manager || ''}
                  onSave={(value) => onUpdate({ manager: String(value) } as any)}
                  inputClassName="h-7 text-base"
                />
              ) : (
                <span className="text-foreground text-base">{biz.manager || 'None'}</span>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (entityType === 'quest') {
      const quest = entity as Quest;
      
      return (
        <div className="space-y-3">
          {/* Basic Info */}
          <div className="flex items-baseline gap-2">
            <span className="font-serif font-semibold text-foreground min-w-[100px]">Title:</span>
            {onUpdate ? (
              <InlineEdit
                value={quest.title}
                onSave={(value) => onUpdate({ title: String(value) } as any)}
                inputClassName="h-7 text-base"
              />
            ) : (
              <span className="text-foreground font-medium text-base">{quest.title}</span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif font-semibold text-foreground min-w-[100px]">Type:</span>
            <Badge variant={quest.type === 'main' ? 'default' : 'secondary'} className="font-bold text-sm px-3 py-1">
              {quest.type === 'main' ? '⚔️ Main Quest' : '📜 Side Quest'}
            </Badge>
          </div>
          <div className="pt-3 border-t border-border">
            <span className="font-serif font-bold text-foreground block mb-2">Description:</span>
            {onUpdate ? (
              <InlineEdit
                value={quest.description}
                onSave={(value) => onUpdate({ description: String(value) } as any)}
                type="textarea"
                inputClassName="text-sm leading-relaxed"
              />
            ) : (
              <p className="text-foreground text-sm leading-relaxed italic">{quest.description}</p>
            )}
          </div>

          {/* Objectives */}
          {quest.objectives && Array.isArray(quest.objectives) && quest.objectives.length > 0 && (
            <div className="pt-3 border-t border-border">
              <h4 className="font-serif font-bold text-foreground mb-3">Objectives</h4>
              <ul className="space-y-2.5">
                {quest.objectives.filter(obj => obj && typeof obj === 'object' && obj.text && typeof obj.text === 'string' && obj.text.trim() !== '').map((obj, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={!!obj.completed}
                      readOnly
                      className="w-5 h-5 rounded mt-0.5 cursor-not-allowed"
                    />
                    <span className={obj.completed ? 'line-through text-muted-foreground text-sm' : 'text-foreground text-sm font-medium'}>
                      {obj.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Progress */}
          {quest.progress && (
            <div className="pt-3 border-t border-border">
              <h4 className="font-serif font-bold text-foreground mb-3">Progress</h4>
              <div className="flex items-center gap-3">
                <span className="font-medium text-foreground text-sm">Completion:</span>
                <Badge variant="outline" className="font-bold text-sm px-3 py-1">
                  {quest.progress.current} / {quest.progress.total}
                </Badge>
              </div>
            </div>
          )}
        </div>
      );
    }
    
    const char = entity as GameCharacter | Companion | EncounteredCharacter;
    
    return (
      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="font-serif font-semibold text-foreground min-w-[100px]">Name:</span>
          {onUpdate ? (
            <InlineEdit
              value={char.name}
              onSave={(value) => onUpdate({ name: String(value) } as any)}
              inputClassName="h-7 text-base"
            />
          ) : (
            <span className="text-foreground font-medium text-base">{char.name}</span>
          )}
        </div>
        {'race' in char && (
          <div className="flex items-baseline gap-2">
            <span className="font-serif font-semibold text-foreground min-w-[100px]">Race:</span>
            {onUpdate ? (
              <InlineEdit
                value={char.race || ''}
                onSave={(value) => onUpdate({ race: String(value) } as any)}
                inputClassName="h-7 text-base"
              />
            ) : (
              <span className="text-foreground text-base">{char.race || 'Unknown'}</span>
            )}
          </div>
        )}
        {'class' in char && (
          <div className="flex items-baseline gap-2">
            <span className="font-serif font-semibold text-foreground min-w-[100px]">Class:</span>
            {onUpdate ? (
              <InlineEdit
                value={char.class || ''}
                onSave={(value) => onUpdate({ class: String(value) } as any)}
                inputClassName="h-7 text-base"
              />
            ) : (
              <Badge variant="secondary" className="font-semibold text-sm">
                {char.class || 'Unknown'}
              </Badge>
            )}
          </div>
        )}
        {'role' in char && (
          <div className="flex items-baseline gap-2">
            <span className="font-serif font-semibold text-foreground min-w-[100px]">Role:</span>
            {onUpdate ? (
              <InlineEdit
                value={char.role || ''}
                onSave={(value) => onUpdate({ role: String(value) } as any)}
                inputClassName="h-7 text-base"
              />
            ) : (
              <Badge variant="secondary" className="font-semibold text-sm">
                {char.role || 'Unknown'}
              </Badge>
            )}
          </div>
        )}
        <div className="flex items-baseline gap-2">
          <span className="font-serif font-semibold text-foreground min-w-[100px]">Age:</span>
          {onUpdate ? (
            <InlineEdit
              value={char.age || ''}
              onSave={(value) => onUpdate({ age: String(value) } as any)}
              inputClassName="h-7 text-base"
            />
          ) : (
            <span className="text-foreground text-base">{char.age || 'Unknown'}</span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-serif font-semibold text-foreground min-w-[100px]">Sex:</span>
          {onUpdate ? (
            <InlineEdit
              value={char.sex || ''}
              onSave={(value) => onUpdate({ sex: String(value) } as any)}
              inputClassName="h-7 text-base"
            />
          ) : (
            <span className="text-foreground text-base capitalize">{char.sex || 'Unknown'}</span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-serif font-semibold text-foreground min-w-[100px]">Hair Color:</span>
          {onUpdate ? (
            <InlineEdit
              value={char.hairColor || ''}
              onSave={(value) => onUpdate({ hairColor: String(value) } as any)}
              inputClassName="h-7 text-base"
            />
          ) : (
            <span className="text-foreground text-base">{char.hairColor || 'Not specified'}</span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-serif font-semibold text-foreground min-w-[100px]">Outfit:</span>
          {onUpdate ? (
            <InlineEdit
              value={(char as any).outfit || ''}
              onSave={(value) => onUpdate({ outfit: String(value) } as any)}
              inputClassName="h-7 text-base"
            />
          ) : (
            <span className="text-foreground text-base">{(char as any).outfit || 'Not specified'}</span>
          )}
        </div>
        {'level' in char && (
          <div className="flex items-baseline gap-2">
            <span className="font-serif font-semibold text-foreground min-w-[100px]">Level:</span>
            {onUpdate ? (
              <InlineEdit
                value={char.level || 1}
                onSave={(value) => onUpdate({ level: Number(value) } as any)}
                type="number"
                min={1}
                max={20}
                inputClassName="h-7 text-base w-20"
              />
            ) : (
              <Badge variant="default" className="font-bold text-sm px-3 py-1">
                Level {char.level || 1}
              </Badge>
            )}
          </div>
        )}
        {'appearance' in char && (
          <div className="pt-3 border-t border-border">
            <span className="font-serif font-bold text-foreground block mb-2">Appearance:</span>
            {onUpdate ? (
              <InlineEdit
                value={char.appearance || ''}
                onSave={(value) => onUpdate({ appearance: String(value) } as any)}
                type="textarea"
                inputClassName="text-sm leading-relaxed"
              />
            ) : (
              <p className="text-foreground text-sm leading-relaxed italic">{char.appearance || 'No description'}</p>
            )}
          </div>
        )}
        {'personality' in char && (
          <div className="pt-3 border-t border-border">
            <span className="font-serif font-bold text-foreground block mb-2">Personality:</span>
            {onUpdate ? (
              <InlineEdit
                value={char.personality || ''}
                onSave={(value) => onUpdate({ personality: String(value) } as any)}
                type="textarea"
                inputClassName="text-sm leading-relaxed"
              />
            ) : (
              <p className="text-foreground text-sm leading-relaxed italic">{char.personality || 'No description'}</p>
            )}
          </div>
        )}
        {(entityType === 'character' || 'description' in char) && (
          <div className="pt-3 border-t border-border">
            <span className="font-serif font-bold text-foreground block mb-2">Description:</span>
            {onUpdate ? (
              <InlineEdit
                value={(char as any).description || ''}
                onSave={(value) => onUpdate({ description: String(value) } as any)}
                type="textarea"
                inputClassName="text-sm leading-relaxed"
              />
            ) : (
              <p className="text-foreground text-sm leading-relaxed italic">{(char as any).description || 'No description'}</p>
            )}
          </div>
        )}
        
        {/* Character-specific stats (HP, XP, Gold, Attributes, AC, Status Effects) */}
        {entityType === 'character' && 'hp' in char && (
          <>
            <Separator className="my-4" />
            <div className="space-y-3">
              <h4 className="font-serif font-bold text-lg text-primary">Character Stats</h4>
              
              {/* Compact Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {/* HP */}
                <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-lg border border-destructive/30">
                  <Heart className="w-4 h-4 text-destructive flex-shrink-0" />
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-xs font-semibold text-muted-foreground flex-shrink-0">HP</span>
                    {onUpdate ? (
                      <div className="flex items-center gap-0.5 font-mono font-bold text-sm">
                        <InlineEdit
                          value={char.hp}
                          onSave={(value) => onUpdate({ hp: Number(value) } as any)}
                          type="number"
                          min={0}
                          inputClassName="w-10 h-6 text-sm"
                        />
                        <span className="text-muted-foreground">/</span>
                        <InlineEdit
                          value={char.maxHp}
                          onSave={(value) => onUpdate({ maxHp: Number(value) } as any)}
                          type="number"
                          min={1}
                          inputClassName="w-10 h-6 text-sm"
                        />
                      </div>
                    ) : (
                      <span className="font-mono font-bold text-sm">{char.hp}/{char.maxHp}</span>
                    )}
                  </div>
                </div>

                {/* XP */}
                <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <Star className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-xs font-semibold text-muted-foreground flex-shrink-0">XP</span>
                    {onUpdate ? (
                      <div className="flex items-center gap-0.5 font-mono font-bold text-sm">
                        <InlineEdit
                          value={char.xp}
                          onSave={(value) => onUpdate({ xp: Number(value) } as any)}
                          type="number"
                          min={0}
                          inputClassName="w-10 h-6 text-sm"
                        />
                        <span className="text-muted-foreground">/</span>
                        <InlineEdit
                          value={char.nextLevelXp}
                          onSave={(value) => onUpdate({ nextLevelXp: Number(value) } as any)}
                          type="number"
                          min={1}
                          inputClassName="w-12 h-6 text-sm"
                        />
                      </div>
                    ) : (
                      <span className="font-mono font-bold text-sm">{char.xp}/{char.nextLevelXp}</span>
                    )}
                  </div>
                </div>

                {/* Gold */}
                <div className="flex items-center gap-2 p-2 bg-gradient-to-br from-yellow-500/10 to-amber-500/10 rounded-lg border border-yellow-500/30">
                  <Coins className="w-4 h-4 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-xs font-semibold text-muted-foreground flex-shrink-0">GP</span>
                    {onUpdate ? (
                      <InlineEdit
                        value={char.gold}
                        onSave={(value) => onUpdate({ gold: Number(value) } as any)}
                        type="number"
                        min={0}
                        inputClassName="w-16 h-6 text-sm font-mono font-bold text-yellow-700 dark:text-yellow-500"
                        displayAs={(val) => Number(val).toLocaleString()}
                      />
                    ) : (
                      <span className="font-mono font-bold text-sm text-yellow-700 dark:text-yellow-500">{char.gold.toLocaleString()}</span>
                    )}
                  </div>
                </div>

                {/* AC */}
                <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-xs font-semibold text-muted-foreground flex-shrink-0">AC</span>
                    {onUpdate ? (
                      <InlineEdit
                        value={char.attributes.ac ?? 10}
                        onSave={(value) => onUpdate({ attributes: { ...char.attributes, ac: Number(value) } } as any)}
                        type="number"
                        min={1}
                        max={30}
                        inputClassName="w-12 h-6 text-sm text-center font-mono font-bold"
                      />
                    ) : (
                      <span className="font-mono font-bold text-sm">{char.attributes.ac ?? 10}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Weekly Income (if applicable) */}
              {businesses.length > 0 && (
                <div className={`text-xs font-mono font-semibold px-2 ${
                  businesses.reduce((total, b) => total + (b.weeklyIncome - b.runningCost), 0) > 0 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  Weekly Income: {businesses.reduce((total, b) => total + (b.weeklyIncome - b.runningCost), 0).toLocaleString()} GP
                </div>
              )}

              {/* Compact Attributes */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {[
                  { key: 'str', label: 'STR' },
                  { key: 'dex', label: 'DEX' },
                  { key: 'con', label: 'CON' },
                  { key: 'int', label: 'INT' },
                  { key: 'wis', label: 'WIS' },
                  { key: 'cha', label: 'CHA' },
                ].map(({ key, label }) => {
                  const attrValue = char.attributes[key as keyof typeof char.attributes] ?? 10;
                  return (
                    <div key={key} className="flex flex-col items-center justify-center p-2 bg-accent/10 rounded-md border border-accent/20">
                      <span className="text-xs font-medium text-muted-foreground mb-0.5">{label}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-lg font-bold">
                          {onUpdate ? (
                            <InlineEdit
                              value={attrValue}
                              onSave={(val) => onUpdate({ attributes: { ...char.attributes, [key]: Number(val) } } as any)}
                              type="number"
                              min={1}
                              max={30}
                              inputClassName="w-10 h-6 text-lg text-center font-bold"
                            />
                          ) : (
                            <span>{attrValue}</span>
                          )}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-mono px-1 py-0 h-5">
                          {getModifier(attrValue as number)}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Status Effects */}
              {statusEffects.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap p-2 bg-accent/10 rounded-lg border border-accent/30">
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                    <span className="text-xs font-semibold text-accent">Effects:</span>
                  </div>
                  {statusEffects.map((effect, index) => (
                    <Badge key={index} variant="secondary" className="gap-1 bg-accent/20 text-xs px-2 py-0.5">
                      <span>{effect.icon}</span>
                      <span className="font-medium">{effect.name}</span>
                      <span className="opacity-70">({effect.turnsRemaining}t)</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        
        {/* Companion-specific fields */}
        {'criticalMemories' in char && (
          <div>
            <span className="font-semibold text-foreground">Critical Memories:</span>
            {onUpdate ? (
              <InlineEdit
                value={char.criticalMemories || ''}
                onSave={(value) => onUpdate({ criticalMemories: String(value) } as any)}
                type="textarea"
                className="mt-1"
                inputClassName="text-sm"
              />
            ) : (
              <p className="mt-1 text-muted-foreground">{char.criticalMemories || 'N/A'}</p>
            )}
          </div>
        )}
        {'feelingsTowardsPlayer' in char && (
          <div>
            <span className="font-semibold text-foreground">Feelings Towards Player:</span>
            {onUpdate ? (
              <InlineEdit
                value={char.feelingsTowardsPlayer || ''}
                onSave={(value) => onUpdate({ feelingsTowardsPlayer: String(value) } as any)}
                type="textarea"
                className="mt-1"
                inputClassName="text-sm"
              />
            ) : (
              <p className="mt-1 text-muted-foreground">{char.feelingsTowardsPlayer || 'N/A'}</p>
            )}
          </div>
        )}
        {'relationship' in char && entityType === 'companion' && (
          <div>
            <span className="font-semibold text-foreground">Relationship:</span>
            {onUpdate ? (
              <InlineEdit
                value={char.relationship || ''}
                onSave={(value) => onUpdate({ relationship: String(value) } as any)}
                inputClassName="ml-2 h-6 text-sm"
              />
            ) : (
              <Badge variant="outline" className="ml-2 text-primary border-primary font-semibold px-2 py-0.5 text-xs">
                {char.relationship || 'N/A'}
              </Badge>
            )}
          </div>
        )}
        
        {/* NPC-specific fields */}
        {'location' in char && entityType === 'npc' && (
          <div className="flex items-baseline gap-2 pt-3 border-t border-border">
            <span className="font-serif font-semibold text-foreground min-w-[100px]">Location:</span>
            {onUpdate ? (
              <InlineEdit
                value={char.location || ''}
                onSave={(value) => onUpdate({ location: String(value) } as any)}
                inputClassName="h-7 text-base"
              />
            ) : (
              <span className="text-foreground text-base">{char.location || 'Unknown'}</span>
            )}
          </div>
        )}
        {'status' in char && entityType === 'npc' && (
          <div className="flex items-baseline gap-2">
            <span className="font-serif font-semibold text-foreground min-w-[100px]">Status:</span>
            <Badge 
              variant={char.status === 'alive' ? 'default' : 'destructive'}
              className={`${
                char.status === 'alive'
                  ? 'bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600' 
                  : 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800'
              } text-white font-bold px-3 py-1 text-sm flex items-center gap-1.5`}
            >
              {char.status === 'alive' ? (
                <><Heart className="w-4 h-4" /> Alive</>
              ) : (
                <><Skull className="w-4 h-4" /> Dead</>
              )}
            </Badge>
          </div>
        )}
        {'relationship' in char && entityType === 'npc' && (
          <div className="flex items-baseline gap-2">
            <span className="font-serif font-semibold text-foreground min-w-[100px]">Relationship:</span>
            {(() => {
              const rel = typeof char.relationship === 'number' ? char.relationship : 0;
              const relDisplay = getRelationshipDisplay(rel);
              return (
                <Badge 
                  variant="outline"
                  className={`${relDisplay.textColor} border-current font-bold px-3 py-1 text-sm`}
                  title={relDisplay.description}
                >
                  {relDisplay.label}
                </Badge>
              );
            })()}
          </div>
        )}
      </div>
    );
  };

  // Get status badge for NPCs
  const getStatusBadge = () => {
    if (entityType !== 'npc') return null;
    const npc = entity as EncounteredCharacter;
    const isAlive = npc.status === 'alive';
    
    return (
      <Badge 
        variant={isAlive ? 'default' : 'destructive'}
        className={`${
          isAlive 
            ? 'bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600' 
            : 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800'
        } text-white font-semibold px-3 py-1.5 text-sm flex items-center gap-1.5`}
      >
        {isAlive ? (
          <><Heart className="w-4 h-4" /> Alive</>
        ) : (
          <><Skull className="w-4 h-4" /> Dead</>
        )}
      </Badge>
    );
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-7xl overflow-y-auto">
        <SheetHeader className="space-y-4 pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            <SheetTitle className="flex items-center gap-3 text-2xl font-serif">
              {Icon && <Icon className="w-6 h-6" />}
              {entityType === 'quest' && <span className="text-2xl">{(entity as Quest).icon}</span>}
              {'name' in entity ? entity.name : entityType === 'quest' ? (entity as Quest).title : 'Details'}
            </SheetTitle>
            {getStatusBadge()}
          </div>
        </SheetHeader>
        
        <div className="mt-6">
          {/* Side-by-side layout: Image on left, content on right */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: Image - Only for entities with images */}
            {entityType !== 'quest' && (
              <div className="lg:w-2/5 flex-shrink-0">
                <AspectRatio ratio={1/1} className="bg-muted/20 rounded-xl overflow-hidden shadow-lg border-2 border-border">
                  {'imageUrl' in entity && entity.imageUrl ? (
                    <img 
                      src={entity.imageUrl} 
                      alt={`${entityType} portrait`}
                      className="object-cover w-full h-full hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-muted/50 to-muted/20">
                      {Icon && <Icon className="w-24 h-24 text-muted-foreground/30" />}
                    </div>
                  )}
                </AspectRatio>
                
                {/* Refresh Button under image */}
                {onRefresh && (
                  <Button
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="w-full mt-4 h-11 text-sm font-medium"
                    variant="outline"
                    data-testid={`button-refresh-image-${entityType}`}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Generating...' : 'Refresh Image'}
                  </Button>
                )}
              </div>
            )}

            {/* Right: Content */}
            <div className={`flex-1 space-y-6 ${entityType === 'quest' ? 'lg:w-full' : ''}`}>
              {/* Metadata */}
              <div className="bg-card border-2 border-border rounded-xl p-6 shadow-sm">
                <h3 className="font-serif font-bold text-lg mb-4 text-foreground border-b border-border pb-2">
                  Details
                </h3>
                {renderMetadata()}
              </div>

              {/* Backstory */}
              {'backstory' in entity && entity.backstory && (
                <div className="bg-card border-2 border-border rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
                    <h3 className="font-serif font-bold text-lg text-foreground flex items-center gap-2">
                      <span>📜</span> Backstory
                    </h3>
                    {onUpdate && !isEditingBackstory && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBackstoryEditValue(entity.backstory || '');
                          setIsEditingBackstory(true);
                        }}
                        className="h-8 px-2 text-xs"
                        data-testid="button-edit-backstory"
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                  {isEditingBackstory && onUpdate ? (
                    <div className="space-y-3">
                      <Textarea
                        value={backstoryEditValue}
                        onChange={(e) => setBackstoryEditValue(e.target.value)}
                        className="min-h-[200px] text-sm leading-relaxed font-mono"
                        placeholder="Enter backstory in markdown format..."
                        data-testid="textarea-backstory"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            onUpdate({ backstory: backstoryEditValue } as any);
                            setIsEditingBackstory(false);
                          }}
                          className="h-8"
                          data-testid="button-save-backstory"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIsEditingBackstory(false);
                            setBackstoryEditValue('');
                          }}
                          className="h-8"
                          data-testid="button-cancel-backstory"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-p:text-muted-foreground prose-headings:font-serif prose-headings:text-foreground prose-strong:text-foreground prose-code:text-foreground prose-li:text-muted-foreground">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {typeof entity.backstory === 'string' ? entity.backstory : JSON.stringify(entity.backstory, null, 2)}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              )}

              {/* Revelations */}
              {'revelations' in entity && entity.revelations && entity.revelations.length > 0 && (
                <div className="bg-card border-2 border-border rounded-xl p-6 shadow-sm">
                  <h3 className="font-serif font-bold text-lg mb-4 text-foreground flex items-center gap-2 border-b border-border pb-2">
                    <Sparkles className="w-5 h-5" /> Revelations
                  </h3>
                  <div className="space-y-3" data-testid="entity-revelations-list">
                    {entity.revelations.map((revelation, index) => (
                      <div key={index} className="bg-muted/30 border-l-4 border-primary rounded-r-lg p-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            <Badge variant="outline" className="font-mono text-xs">
                              Turn {revelation.revealedAtTurn}
                            </Badge>
                          </div>
                          <p className="text-foreground text-sm leading-relaxed flex-1">
                            {revelation.text}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
