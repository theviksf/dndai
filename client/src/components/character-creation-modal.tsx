import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GameStateData } from '@shared/schema';
import { calculateModifier, formatModifier } from '@/lib/game-state';
import { Dices } from 'lucide-react';

interface CharacterCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (character: GameStateData['character']) => void;
}

const RACES = [
  { id: 'human', name: 'Human', description: 'Versatile & adaptable' },
  { id: 'elf', name: 'Elf', description: 'Graceful & perceptive' },
  { id: 'dwarf', name: 'Dwarf', description: 'Hardy & resilient' },
  { id: 'halfling', name: 'Halfling', description: 'Lucky & nimble' },
  { id: 'dragonborn', name: 'Dragonborn', description: 'Powerful & proud' },
  { id: 'tiefling', name: 'Tiefling', description: 'Charismatic & cunning' },
];

const CLASSES = [
  { id: 'fighter', name: 'Fighter', icon: '⚔️', description: 'Master of combat' },
  { id: 'wizard', name: 'Wizard', icon: '🔮', description: 'Arcane spellcaster' },
  { id: 'rogue', name: 'Rogue', icon: '🗡️', description: 'Cunning & stealthy' },
  { id: 'cleric', name: 'Cleric', icon: '✨', description: 'Divine healer' },
  { id: 'ranger', name: 'Ranger', icon: '🏹', description: 'Wilderness expert' },
  { id: 'bard', name: 'Bard', icon: '🎵', description: 'Charismatic performer' },
];

export default function CharacterCreationModal({ open, onOpenChange, onComplete }: CharacterCreationModalProps) {
  const [name, setName] = useState('');
  const [selectedRace, setSelectedRace] = useState('elf');
  const [selectedClass, setSelectedClass] = useState('');
  const [attributes, setAttributes] = useState({
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
  });
  const [pointsRemaining, setPointsRemaining] = useState(27);

  const handleAttributeChange = (attr: keyof typeof attributes, delta: number) => {
    const current = attributes[attr];
    const newValue = current + delta;
    
    if (newValue < 8 || newValue > 15) return;
    
    const costDiff = calculatePointCost(newValue) - calculatePointCost(current);
    
    if (pointsRemaining - costDiff < 0) return;
    
    setAttributes(prev => ({ ...prev, [attr]: newValue }));
    setPointsRemaining(prev => prev - costDiff);
  };

  const calculatePointCost = (value: number): number => {
    if (value <= 13) return value - 8;
    if (value === 14) return 7;
    return 9;
  };

  const handleRandomize = () => {
    const randomRace = RACES[Math.floor(Math.random() * RACES.length)].id;
    const randomClass = CLASSES[Math.floor(Math.random() * CLASSES.length)].id;
    
    const randomAttrs = {
      str: Math.floor(Math.random() * 8) + 8,
      dex: Math.floor(Math.random() * 8) + 8,
      con: Math.floor(Math.random() * 8) + 8,
      int: Math.floor(Math.random() * 8) + 8,
      wis: Math.floor(Math.random() * 8) + 8,
      cha: Math.floor(Math.random() * 8) + 8,
    };
    
    setSelectedRace(randomRace);
    setSelectedClass(randomClass);
    setAttributes(randomAttrs);
    setPointsRemaining(0);
  };

  const handleCreate = () => {
    if (!name || !selectedRace || !selectedClass) return;
    
    const character: GameStateData['character'] = {
      name,
      race: RACES.find(r => r.id === selectedRace)?.name || '',
      class: CLASSES.find(c => c.id === selectedClass)?.name || '',
      level: 1,
      xp: 0,
      nextLevelXp: 300,
      hp: 10 + calculateModifier(attributes.con),
      maxHp: 10 + calculateModifier(attributes.con),
      gold: 50,
      attributes,
    };
    
    onComplete(character);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-2 border-border ornate-border parchment-texture">
        <DialogHeader>
          <DialogTitle className="text-3xl font-serif font-bold text-primary text-center">
            Create Your Character
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Begin your adventure by crafting your hero
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Character Name */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">Character Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your character's name..."
              className="bg-input border-border"
              data-testid="input-character-name"
            />
          </div>

          {/* Race Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-foreground">Race</label>
            <div className="grid grid-cols-3 gap-3">
              {RACES.map(race => (
                <button
                  key={race.id}
                  onClick={() => setSelectedRace(race.id)}
                  className={`bg-muted hover:bg-muted/80 border-2 rounded-md p-4 text-left transition-all ${
                    selectedRace === race.id ? 'border-primary glow-effect' : 'border-border'
                  }`}
                  data-testid={`button-race-${race.id}`}
                >
                  <div className="text-lg font-serif font-semibold text-primary">{race.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{race.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Class Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-foreground">Class</label>
            <div className="grid grid-cols-3 gap-3">
              {CLASSES.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClass(cls.id)}
                  className={`bg-muted hover:bg-muted/80 border-2 rounded-md p-4 text-left transition-all ${
                    selectedClass === cls.id ? 'border-primary glow-effect' : 'border-border'
                  }`}
                  data-testid={`button-class-${cls.id}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{cls.icon}</span>
                    <div className="text-base font-serif font-semibold text-primary">{cls.name}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{cls.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Attributes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-foreground">Attributes</label>
              <span className="text-xs text-muted-foreground">
                Points Remaining: <span className="font-mono text-primary" data-testid="text-points-remaining">{pointsRemaining}</span>
              </span>
            </div>

            <div className="bg-muted/30 border border-border rounded-md p-4 space-y-3">
              {Object.entries(attributes).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground w-32 capitalize">{key}</span>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => handleAttributeChange(key as keyof typeof attributes, -1)}
                      size="sm"
                      variant="outline"
                      className="w-8 h-8 p-0"
                      data-testid={`button-decrease-${key}`}
                    >
                      -
                    </Button>
                    <span className="font-mono font-semibold text-lg text-primary w-8 text-center" data-testid={`text-${key}-value`}>
                      {value}
                    </span>
                    <Button
                      onClick={() => handleAttributeChange(key as keyof typeof attributes, 1)}
                      size="sm"
                      variant="outline"
                      className="w-8 h-8 p-0"
                      data-testid={`button-increase-${key}`}
                    >
                      +
                    </Button>
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      {formatModifier(value)} mod
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleRandomize}
              variant="outline"
              className="bg-muted hover:bg-muted/80"
              data-testid="button-randomize"
            >
              <Dices className="w-5 h-5 mr-2" />
              Random
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name || !selectedRace || !selectedClass}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              data-testid="button-begin-adventure"
            >
              Begin Adventure
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
