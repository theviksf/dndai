import Dexie, { Table } from 'dexie';
import type { GameStateData, GameConfig, CostTracker, TurnSnapshot } from '@shared/schema';

export interface SessionData {
  sessionId: string;
  gameState: GameStateData;
  gameConfig: GameConfig;
  costTracker?: CostTracker;
  turnSnapshots: TurnSnapshot[];
  isGameStarted: boolean;
  lastUpdated: number;
}

export class DnDGameDB extends Dexie {
  sessions!: Table<SessionData, string>;

  constructor() {
    super('DnDAdventureDB');
    
    this.version(1).stores({
      sessions: 'sessionId, lastUpdated'
    });
  }
}

export const db = new DnDGameDB();

export async function getSessionData(sessionId: string): Promise<SessionData | undefined> {
  return await db.sessions.get(sessionId);
}

export async function saveSessionData(data: SessionData): Promise<string> {
  data.lastUpdated = Date.now();
  await db.sessions.put(data);
  return data.sessionId;
}

export async function deleteSessionData(sessionId: string): Promise<void> {
  await db.sessions.delete(sessionId);
}

export async function getAllSessions(): Promise<SessionData[]> {
  return await db.sessions.orderBy('lastUpdated').reverse().toArray();
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0
    };
  }
  return { usage: 0, quota: 0 };
}
