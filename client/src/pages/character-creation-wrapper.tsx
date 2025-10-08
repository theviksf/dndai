import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import type { GameStateData } from '@shared/schema';
import { getSessionIdFromUrl, getSessionStorageKey, generateSessionId, setSessionIdInUrl, buildSessionUrl } from '@/lib/session';
import CharacterCreationPage from '@/pages/character-creation';
import { useToast } from '@/hooks/use-toast';

export default function CharacterCreationWrapper() {
  const [, setLocation] = useLocation();
  const [sessionId, setSessionId] = useState<string>(() => getSessionIdFromUrl() || '');
  const { toast } = useToast();
  
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
  }, []);

  const handleComplete = (character: GameStateData['character']) => {
    const currentSessionId = sessionId || getSessionIdFromUrl();
    if (!currentSessionId) {
      console.error('No session ID available');
      toast({
        title: "Error creating character",
        description: "No active session found. Please refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Save character to session-scoped localStorage
      localStorage.setItem(getSessionStorageKey('gameCharacter', currentSessionId), JSON.stringify(character));
      localStorage.setItem(getSessionStorageKey('isGameStarted', currentSessionId), 'true');
      
      // Navigate back to home with session ID
      setLocation(buildSessionUrl('/', currentSessionId));
    } catch (error) {
      // Handle localStorage quota exceeded error
      if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        toast({
          title: "Storage quota exceeded",
          description: "Your browser storage is full. Please start a new game session using the 'New Game' button on the home page.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error creating character",
          description: "Failed to save character. Please try again.",
          variant: "destructive",
        });
      }
      console.error('Failed to save character:', error);
    }
  };

  return <CharacterCreationPage onComplete={handleComplete} />;
}
