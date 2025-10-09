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
  
  // Diagnostic: Log size of data being saved
  const jsonString = JSON.stringify(data);
  const sizeInBytes = new Blob([jsonString]).size;
  const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
  console.log(`[DB SAVE] Session data size: ${sizeInMB} MB`);
  console.log(`[DB SAVE] Debug log entries: ${data.gameState.debugLog?.length || 0}`);
  console.log(`[DB SAVE] Turn snapshots: ${data.turnSnapshots?.length || 0}`);
  
  // Check if any debug log entries contain base64
  if (data.gameState.debugLog) {
    const base64Entries = data.gameState.debugLog.filter(log => 
      log.response?.includes('data:image') || log.response?.includes('base64,')
    );
    if (base64Entries.length > 0) {
      console.error(`[DB SAVE] WARNING: ${base64Entries.length} debug log entries contain base64 data!`);
      // Log sample of the offending entry
      console.error('[DB SAVE] Sample base64 entry response length:', base64Entries[0].response?.length);
    }
  }
  
  // Check turnSnapshots for base64
  if (data.turnSnapshots) {
    let snapshotWithBase64 = 0;
    data.turnSnapshots.forEach((snapshot, idx) => {
      if (snapshot.state.debugLog) {
        const hasBase64 = snapshot.state.debugLog.some(log => 
          log.response?.includes('data:image') || log.response?.includes('base64,')
        );
        if (hasBase64) {
          snapshotWithBase64++;
          console.error(`[DB SAVE] WARNING: Snapshot ${idx} contains base64 in debugLog!`);
        }
      }
    });
    if (snapshotWithBase64 > 0) {
      console.error(`[DB SAVE] Total snapshots with base64: ${snapshotWithBase64}/${data.turnSnapshots.length}`);
    }
  }
  
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
