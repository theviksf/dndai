import { nanoid } from 'nanoid';

export function generateSessionId(): string {
  return nanoid(10);
}

export function getSessionIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('session');
}

export function setSessionIdInUrl(sessionId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('session', sessionId);
  window.history.replaceState({}, '', url.toString());
}

export function navigateToSession(sessionId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('session', sessionId);
  window.location.href = url.toString();
}

export function ensureSessionId(): string {
  let sessionId = getSessionIdFromUrl();
  
  if (!sessionId) {
    sessionId = generateSessionId();
    setSessionIdInUrl(sessionId);
  }
  
  return sessionId;
}

export function getSessionStorageKey(key: string, sessionId: string): string {
  return `${key}_${sessionId}`;
}
