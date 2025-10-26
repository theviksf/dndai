import { Backpack, ScrollText, Users, UserCircle, History, Sparkles, MapPin, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type PanelKey = 'inventory' | 'spells' | 'locations' | 'businesses' | 'quests' | 'companions' | 'npcs' | 'history';

interface IconRailProps {
  activePanel: PanelKey | null;
  onPanelChange: (panel: PanelKey | null) => void;
  badges: Record<PanelKey, boolean>;
}

const panels: { key: PanelKey; icon: any; label: string }[] = [
  { key: 'inventory', icon: Backpack, label: 'Inventory' },
  { key: 'spells', icon: Sparkles, label: 'Spells & Abilities' },
  { key: 'locations', icon: MapPin, label: 'Locations' },
  { key: 'businesses', icon: Building2, label: 'Businesses' },
  { key: 'quests', icon: ScrollText, label: 'Quests' },
  { key: 'companions', icon: Users, label: 'Party' },
  { key: 'npcs', icon: UserCircle, label: 'NPCs' },
  { key: 'history', icon: History, label: 'History' },
];

export function IconRail({ activePanel, onPanelChange, badges }: IconRailProps) {
  const handlePanelClick = (panel: PanelKey) => {
    if (activePanel === panel) {
      onPanelChange(null);
    } else {
      onPanelChange(panel);
    }
  };

  return (
    <div className="w-14 border-l border-border bg-card/50 flex flex-col items-center py-2 gap-1">
      <TooltipProvider delayDuration={300}>
        {panels.map(({ key, icon: Icon, label }) => (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <Button
                variant={activePanel === key ? 'default' : 'ghost'}
                size="icon"
                className="w-10 h-10 relative"
                onClick={() => handlePanelClick(key)}
                data-testid={`icon-${key}`}
              >
                <Icon className="w-5 h-5" />
                {badges[key] && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-primary rounded-full animate-pulse" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );
}
