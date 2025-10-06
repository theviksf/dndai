import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { RefreshCw, User, MapPin } from 'lucide-react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import type { GameCharacter, Companion, EncounteredCharacter, Location } from '@shared/schema';

interface EntityDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: GameCharacter | Companion | EncounteredCharacter | Location | null;
  entityType: 'character' | 'companion' | 'npc' | 'location';
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function EntityDetailSheet({ 
  open, 
  onOpenChange, 
  entity, 
  entityType,
  onRefresh,
  isRefreshing = false
}: EntityDetailSheetProps) {
  if (!entity) return null;

  const Icon = entityType === 'location' ? MapPin : User;
  
  const renderMetadata = () => {
    if (entityType === 'location') {
      const loc = entity as Location;
      return (
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-semibold text-foreground">Location:</span>
            <span className="ml-2 text-muted-foreground">{loc.name}</span>
          </div>
          {loc.description && (
            <div>
              <span className="font-semibold text-foreground">Description:</span>
              <p className="mt-1 text-muted-foreground">{loc.description}</p>
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
          <span className="ml-2 text-muted-foreground">{char.name}</span>
        </div>
        {'race' in char && char.race && (
          <div>
            <span className="font-semibold text-foreground">Race:</span>
            <span className="ml-2 text-muted-foreground">{char.race}</span>
          </div>
        )}
        {'class' in char && char.class && (
          <div>
            <span className="font-semibold text-foreground">Class:</span>
            <span className="ml-2 text-muted-foreground">{char.class}</span>
          </div>
        )}
        {'role' in char && char.role && (
          <div>
            <span className="font-semibold text-foreground">Role:</span>
            <span className="ml-2 text-muted-foreground">{char.role}</span>
          </div>
        )}
        {char.age && (
          <div>
            <span className="font-semibold text-foreground">Age:</span>
            <span className="ml-2 text-muted-foreground">{char.age}</span>
          </div>
        )}
        {char.sex && (
          <div>
            <span className="font-semibold text-foreground">Sex:</span>
            <span className="ml-2 text-muted-foreground">{char.sex}</span>
          </div>
        )}
        {'level' in char && char.level && (
          <div>
            <span className="font-semibold text-foreground">Level:</span>
            <span className="ml-2 text-muted-foreground">{char.level}</span>
          </div>
        )}
        {'appearance' in char && char.appearance && (
          <div>
            <span className="font-semibold text-foreground">Appearance:</span>
            <p className="mt-1 text-muted-foreground">{char.appearance}</p>
          </div>
        )}
        {'personality' in char && char.personality && (
          <div>
            <span className="font-semibold text-foreground">Personality:</span>
            <p className="mt-1 text-muted-foreground">{char.personality}</p>
          </div>
        )}
        {'description' in char && char.description && (
          <div>
            <span className="font-semibold text-foreground">Description:</span>
            <p className="mt-1 text-muted-foreground">{char.description}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
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
