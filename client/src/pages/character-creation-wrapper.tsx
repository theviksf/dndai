import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import type { GameStateData } from '@shared/schema';
import { getSessionIdFromUrl, getSessionStorageKey, generateSessionId, setSessionIdInUrl, buildSessionUrl } from '@/lib/session';
import CharacterCreationPage from '@/pages/character-creation';

export default function CharacterCreationWrapper() {
  const [, setLocation] = useLocation();
  const [sessionId, setSessionId] = useState<string>(() => getSessionIdFromUrl() || '');
  
  // Ensure session ID exists - create one if missing
  useEffect(() => {
    const urlSessionId = getSessionIdFromUrl();
    if (!urlSessionId) {
      const newSessionId = generateSessionId();
      setSessionIdInUrl(newSessionId);
      setSessionId(newSessionId);
    } else if (urlSessionId !== sessionId) {
      setSessionId(urlSessionId);
    }
  }, [sessionId]);

  const handleComplete = (character: GameStateData['character']) => {
    const currentSessionId = sessionId || getSessionIdFromUrl();
    if (!currentSessionId) {
      console.error('No session ID available');
      return;
    }
    
    // Save character to session-scoped localStorage
    localStorage.setItem(getSessionStorageKey('gameCharacter', currentSessionId), JSON.stringify(character));
    localStorage.setItem(getSessionStorageKey('isGameStarted', currentSessionId), 'true');
    // Navigate back to home with session ID
    setLocation(buildSessionUrl('/', currentSessionId));
  };

  return <CharacterCreationPage onComplete={handleComplete} />;
}
