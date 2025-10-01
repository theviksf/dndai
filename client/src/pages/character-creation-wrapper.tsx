import { useLocation } from 'wouter';
import type { GameStateData } from '@shared/schema';
import CharacterCreationPage from '@/pages/character-creation';

export default function CharacterCreationWrapper() {
  const [, setLocation] = useLocation();

  const handleComplete = (character: GameStateData['character']) => {
    // Save character to localStorage
    localStorage.setItem('gameCharacter', JSON.stringify(character));
    localStorage.setItem('isGameStarted', 'true');
    // Navigate back to home
    setLocation('/');
  };

  return <CharacterCreationPage onComplete={handleComplete} />;
}
