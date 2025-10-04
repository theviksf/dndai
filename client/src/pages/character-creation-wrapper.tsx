import { useLocation } from 'wouter';
import type { GameStateData } from '@shared/schema';
import { ensureSessionId, getSessionStorageKey } from '@/lib/session';
import CharacterCreationPage from '@/pages/character-creation';

export default function CharacterCreationWrapper() {
  const [, setLocation] = useLocation();
  const sessionId = ensureSessionId();

  const handleComplete = (character: GameStateData['character']) => {
    // Save character to session-scoped localStorage
    localStorage.setItem(getSessionStorageKey('gameCharacter', sessionId), JSON.stringify(character));
    localStorage.setItem(getSessionStorageKey('isGameStarted', sessionId), 'true');
    // Navigate back to home with session ID
    setLocation(`/?session=${sessionId}`);
  };

  return <CharacterCreationPage onComplete={handleComplete} />;
}
