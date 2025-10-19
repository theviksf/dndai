import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { GameStateData } from '@shared/schema';
import {
  InventoryPanel,
  SpellsPanel,
  LocationsPanel,
  BusinessesPanel,
  QuestsPanel,
  CompanionsPanel,
  NPCsPanel,
  HistoryPanel
} from './info-panels';
import type { PanelKey } from './icon-rail';

interface InfoDrawerProps {
  activePanel: PanelKey | null;
  onClose: () => void;
  gameState: GameStateData;
  onUpdate?: (updates: Partial<GameStateData>) => void;
  onEntityClick?: (entity: any, type: 'companion' | 'npc' | 'location' | 'business' | 'quest') => void;
}

const PANEL_TITLES: Record<PanelKey, string> = {
  inventory: 'Inventory',
  spells: 'Spells',
  locations: 'Locations',
  businesses: 'Businesses',
  quests: 'Quests',
  companions: 'Party',
  npcs: 'NPCs',
  history: 'History',
};

export function InfoDrawer({ activePanel, onClose, gameState, onUpdate, onEntityClick }: InfoDrawerProps) {
  if (!activePanel) return null;

  const renderPanel = () => {
    switch (activePanel) {
      case 'inventory':
        return <InventoryPanel inventory={gameState.inventory} onUpdate={onUpdate} />;
      case 'spells':
        return <SpellsPanel spells={gameState.spells} onUpdate={onUpdate} />;
      case 'locations':
        return <LocationsPanel previousLocations={gameState.previousLocations} onEntityClick={onEntityClick} />;
      case 'businesses':
        return <BusinessesPanel businesses={gameState.businesses} onEntityClick={onEntityClick} />;
      case 'quests':
        return <QuestsPanel quests={gameState.quests} onEntityClick={onEntityClick} />;
      case 'companions':
        return <CompanionsPanel companions={gameState.companions} onEntityClick={onEntityClick} />;
      case 'npcs':
        return <NPCsPanel encounteredCharacters={gameState.encounteredCharacters} onEntityClick={onEntityClick} />;
      case 'history':
        return <HistoryPanel history={gameState.parsedRecaps} />;
      default:
        return null;
    }
  };

  return (
    <div 
      className="w-80 border-l border-border bg-background flex flex-col animate-in slide-in-from-right-full duration-200"
      data-testid={`info-drawer-${activePanel}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/50">
        <h2 className="text-sm font-semibold">{PANEL_TITLES[activePanel]}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7"
          data-testid="button-close-drawer"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {renderPanel()}
      </div>
    </div>
  );
}
