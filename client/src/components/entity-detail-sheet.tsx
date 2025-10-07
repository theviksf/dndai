import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { RefreshCw, User, MapPin } from 'lucide-react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { InlineEdit } from '@/components/ui/inline-edit';
import type { GameCharacter, Companion, EncounteredCharacter, Location } from '@shared/schema';

interface EntityDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: GameCharacter | Companion | EncounteredCharacter | Location | null;
  entityType: 'character' | 'companion' | 'npc' | 'location';
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onUpdate?: (updates: Partial<GameCharacter | Companion | EncounteredCharacter | Location>) => void;
}

export function EntityDetailSheet({ 
  open, 
  onOpenChange, 
  entity, 
  entityType,
  onRefresh,
  isRefreshing = false,
  onUpdate
}: EntityDetailSheetProps) {
  if (!entity) return null;

  const Icon = entityType === 'location' ? MapPin : User;
  
  const renderMetadata = () => {
    if (entityType === 'location') {
      const loc = entity as Location;
      return (
        <div className="space-y-4 text-sm">
          {/* Basic Info */}
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-foreground">Name:</span>
              {onUpdate ? (
                <InlineEdit
                  value={loc.name}
                  onSave={(value) => onUpdate({ name: String(value) } as any)}
                  inputClassName="ml-2 h-6 text-sm"
                />
              ) : (
                <span className="ml-2 text-muted-foreground">{loc.name}</span>
              )}
            </div>
            <div>
              <span className="font-semibold text-foreground">Type:</span>
              {onUpdate ? (
                <InlineEdit
                  value={loc.type || ''}
                  onSave={(value) => onUpdate({ type: String(value) } as any)}
                  inputClassName="ml-2 h-6 text-sm"
                />
              ) : (
                <span className="ml-2 text-muted-foreground capitalize">{loc.type || 'N/A'}</span>
              )}
            </div>
            <div>
              <span className="font-semibold text-foreground">Description:</span>
              {onUpdate ? (
                <InlineEdit
                  value={loc.description || ''}
                  onSave={(value) => onUpdate({ description: String(value) } as any)}
                  type="textarea"
                  className="mt-1"
                  inputClassName="text-sm"
                />
              ) : (
                <p className="mt-1 text-muted-foreground">{loc.description || 'N/A'}</p>
              )}
            </div>
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
    
    const char = entity as GameCharacter | Companion | EncounteredCharacter;
    
    return (
      <div className="space-y-2 text-sm">
        <div>
          <span className="font-semibold text-foreground">Name:</span>
          {onUpdate ? (
            <InlineEdit
              value={char.name}
              onSave={(value) => onUpdate({ name: String(value) } as any)}
              inputClassName="ml-2 h-6 text-sm"
            />
          ) : (
            <span className="ml-2 text-muted-foreground">{char.name}</span>
          )}
        </div>
        {'race' in char && (
          <div>
            <span className="font-semibold text-foreground">Race:</span>
            {onUpdate ? (
              <InlineEdit
                value={char.race || ''}
                onSave={(value) => onUpdate({ race: String(value) } as any)}
                inputClassName="ml-2 h-6 text-sm"
              />
            ) : (
              <span className="ml-2 text-muted-foreground">{char.race || 'N/A'}</span>
            )}
          </div>
        )}
        {'class' in char && (
          <div>
            <span className="font-semibold text-foreground">Class:</span>
            {onUpdate ? (
              <InlineEdit
                value={char.class || ''}
                onSave={(value) => onUpdate({ class: String(value) } as any)}
                inputClassName="ml-2 h-6 text-sm"
              />
            ) : (
              <span className="ml-2 text-muted-foreground">{char.class || 'N/A'}</span>
            )}
          </div>
        )}
        {'role' in char && (
          <div>
            <span className="font-semibold text-foreground">Role:</span>
            {onUpdate ? (
              <InlineEdit
                value={char.role || ''}
                onSave={(value) => onUpdate({ role: String(value) } as any)}
                inputClassName="ml-2 h-6 text-sm"
              />
            ) : (
              <span className="ml-2 text-muted-foreground">{char.role || 'N/A'}</span>
            )}
          </div>
        )}
        <div>
          <span className="font-semibold text-foreground">Age:</span>
          {onUpdate ? (
            <InlineEdit
              value={char.age || ''}
              onSave={(value) => onUpdate({ age: String(value) } as any)}
              inputClassName="ml-2 h-6 text-sm"
            />
          ) : (
            <span className="ml-2 text-muted-foreground">{char.age || 'N/A'}</span>
          )}
        </div>
        <div>
          <span className="font-semibold text-foreground">Sex:</span>
          {onUpdate ? (
            <InlineEdit
              value={char.sex || ''}
              onSave={(value) => onUpdate({ sex: String(value) } as any)}
              inputClassName="ml-2 h-6 text-sm"
            />
          ) : (
            <span className="ml-2 text-muted-foreground">{char.sex || 'N/A'}</span>
          )}
        </div>
        {'level' in char && (
          <div>
            <span className="font-semibold text-foreground">Level:</span>
            {onUpdate ? (
              <InlineEdit
                value={char.level || 1}
                onSave={(value) => onUpdate({ level: Number(value) } as any)}
                type="number"
                min={1}
                max={20}
                inputClassName="ml-2 h-6 text-sm w-16"
              />
            ) : (
              <span className="ml-2 text-muted-foreground">{char.level || 1}</span>
            )}
          </div>
        )}
        {'appearance' in char && (
          <div>
            <span className="font-semibold text-foreground">Appearance:</span>
            {onUpdate ? (
              <InlineEdit
                value={char.appearance || ''}
                onSave={(value) => onUpdate({ appearance: String(value) } as any)}
                type="textarea"
                className="mt-1"
                inputClassName="text-sm"
              />
            ) : (
              <p className="mt-1 text-muted-foreground">{char.appearance || 'N/A'}</p>
            )}
          </div>
        )}
        {'personality' in char && (
          <div>
            <span className="font-semibold text-foreground">Personality:</span>
            {onUpdate ? (
              <InlineEdit
                value={char.personality || ''}
                onSave={(value) => onUpdate({ personality: String(value) } as any)}
                type="textarea"
                className="mt-1"
                inputClassName="text-sm"
              />
            ) : (
              <p className="mt-1 text-muted-foreground">{char.personality || 'N/A'}</p>
            )}
          </div>
        )}
        {'description' in char && (
          <div>
            <span className="font-semibold text-foreground">Description:</span>
            {onUpdate ? (
              <InlineEdit
                value={char.description || ''}
                onSave={(value) => onUpdate({ description: String(value) } as any)}
                type="textarea"
                className="mt-1"
                inputClassName="text-sm"
              />
            ) : (
              <p className="mt-1 text-muted-foreground">{char.description || 'N/A'}</p>
            )}
          </div>
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
              <span className="ml-2 text-muted-foreground">{char.relationship || 'N/A'}</span>
            )}
          </div>
        )}
        
        {/* NPC-specific fields */}
        {'location' in char && entityType === 'npc' && (
          <div>
            <span className="font-semibold text-foreground">Location:</span>
            {onUpdate ? (
              <InlineEdit
                value={char.location || ''}
                onSave={(value) => onUpdate({ location: String(value) } as any)}
                inputClassName="ml-2 h-6 text-sm"
              />
            ) : (
              <span className="ml-2 text-muted-foreground">{char.location || 'N/A'}</span>
            )}
          </div>
        )}
        {'status' in char && entityType === 'npc' && (
          <div>
            <span className="font-semibold text-foreground">Status:</span>
            {onUpdate ? (
              <InlineEdit
                value={char.status || 'alive'}
                onSave={(value) => onUpdate({ status: String(value) } as any)}
                inputClassName="ml-2 h-6 text-sm"
              />
            ) : (
              <span className={`ml-2 font-medium ${char.status === 'alive' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {char.status || 'alive'}
              </span>
            )}
          </div>
        )}
        {'relationship' in char && entityType === 'npc' && (
          <div>
            <span className="font-semibold text-foreground">Relationship:</span>
            {onUpdate ? (
              <InlineEdit
                value={typeof char.relationship === 'number' ? char.relationship : 0}
                onSave={(value) => onUpdate({ relationship: Number(value) } as any)}
                type="number"
                min={-3}
                max={3}
                inputClassName="ml-2 h-6 text-sm w-16"
              />
            ) : (
              <span className={`ml-2 font-medium ${
                char.relationship > 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : char.relationship < 0 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-muted-foreground'
              }`}>
                {typeof char.relationship === 'number' ? char.relationship : 0}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            {'name' in entity ? entity.name : 'Location Details'}
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          {/* Large Image */}
          <div className="w-full max-w-sm mx-auto">
            <AspectRatio ratio={1/1}>
              {entity.imageUrl ? (
                <img 
                  src={entity.imageUrl} 
                  alt={`${entityType} portrait`}
                  className="rounded-lg object-cover w-full h-full border-2 border-border"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-muted/30 border-2 border-border rounded-lg">
                  <Icon className="w-16 h-16 text-muted-foreground" />
                </div>
              )}
            </AspectRatio>
          </div>

          {/* Metadata */}
          <div className="bg-muted/30 border border-border rounded-lg p-4">
            {renderMetadata()}
          </div>

          {/* Refresh Button */}
          {onRefresh && (
            <Button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="w-full"
              variant="outline"
              data-testid={`button-refresh-image-${entityType}`}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Generating...' : 'Refresh Image'}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
