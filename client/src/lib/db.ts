import Dexie, { Table } from 'dexie';
import LZString from 'lz-string';
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

// Compressed storage format
interface CompressedSessionData {
  sessionId: string;
  compressedData: string;
  lastUpdated: number;
}

export class DnDGameDB extends Dexie {
  sessions!: Table<CompressedSessionData, string>;

  constructor() {
    super('DnDAdventureDB');
    
    // Version 1: Uncompressed data
    this.version(1).stores({
      sessions: 'sessionId, lastUpdated'
    });
    
    // Version 2: Compressed data with migration
    this.version(2).stores({
      sessions: 'sessionId, lastUpdated'
    }).upgrade(async (tx) => {
      // Migrate old uncompressed data to compressed format
      const sessions = await tx.table('sessions').toArray();
      await tx.table('sessions').clear();
      
      for (const session of sessions) {
        const sessionAny = session as any;
        
        // Check if this is a legacy uncompressed record (has gameState field)
        if ('gameState' in sessionAny && !('compressedData' in sessionAny)) {
          // Legacy uncompressed format - compress it
          const { sessionId, lastUpdated, ...data } = sessionAny;
          const compressed = LZString.compressToUTF16(JSON.stringify(data));
          await tx.table('sessions').put({
            sessionId,
            compressedData: compressed,
            lastUpdated
          });
          console.log('[DB MIGRATION] Compressed legacy session:', sessionId);
        } else if ('compressedData' in sessionAny) {
          // Already compressed - keep as is
          await tx.table('sessions').put(sessionAny);
        } else {
          // Unknown format - try to compress anyway
          console.warn('[DB MIGRATION] Unknown session format, attempting compression:', sessionAny.sessionId);
          const { sessionId, lastUpdated, ...data } = sessionAny;
          const compressed = LZString.compressToUTF16(JSON.stringify(data));
          await tx.table('sessions').put({
            sessionId,
            compressedData: compressed,
            lastUpdated
          });
        }
      }
      console.log('[DB MIGRATION] Migrated', sessions.length, 'sessions to compressed format');
    });
  }
}

export const db = new DnDGameDB();

export async function getSessionData(sessionId: string): Promise<SessionData | undefined> {
  const record = await db.sessions.get(sessionId);
  if (!record) return undefined;
  
  try {
    // Check if this is a compressed record
    if ('compressedData' in record) {
      const decompressed = LZString.decompressFromUTF16(record.compressedData);
      if (!decompressed) {
        console.error('[DB GET] Failed to decompress data, attempting raw JSON parse');
        // Fallback: try parsing as raw JSON (legacy data that wasn't properly compressed)
        try {
          const data = JSON.parse(record.compressedData);
          console.log('[DB GET] Successfully parsed as raw JSON, re-saving as compressed');
          // Re-save in compressed format
          await saveSessionData({
            sessionId: record.sessionId,
            lastUpdated: record.lastUpdated,
            ...data
          } as SessionData);
          return {
            sessionId: record.sessionId,
            lastUpdated: record.lastUpdated,
            ...data
          } as SessionData;
        } catch {
          console.error('[DB GET] Failed to parse as JSON, data may be corrupted');
          return undefined;
        }
      }
      
      const data = JSON.parse(decompressed);
      return {
        sessionId: record.sessionId,
        lastUpdated: record.lastUpdated,
        ...data
      } as SessionData;
    } else {
      // Legacy uncompressed record - this shouldn't happen after migration but handle it
      console.log('[DB GET] Found legacy uncompressed record, converting to compressed');
      const legacyData = record as any;
      const { sessionId, lastUpdated, ...data } = legacyData;
      // Re-save in compressed format
      await saveSessionData(legacyData as SessionData);
      return legacyData as SessionData;
    }
  } catch (error) {
    console.error('[DB GET] Error loading session data:', error);
    return undefined;
  }
}

export async function saveSessionData(data: SessionData): Promise<string> {
  data.lastUpdated = Date.now();
  
  // Separate sessionId and lastUpdated from the data to compress
  const { sessionId, lastUpdated, ...dataToCompress } = data;
  
  // Diagnostic: Log size of data before compression
  const jsonString = JSON.stringify(dataToCompress);
  const uncompressedSize = new Blob([jsonString]).size;
  const uncompressedMB = (uncompressedSize / (1024 * 1024)).toFixed(2);
  
  // Compress the data
  const compressedData = LZString.compressToUTF16(jsonString);
  const compressedSize = new Blob([compressedData]).size;
  const compressedMB = (compressedSize / (1024 * 1024)).toFixed(2);
  const compressionRatio = ((1 - compressedSize / uncompressedSize) * 100).toFixed(1);
  
  console.log(`[DB SAVE] Uncompressed: ${uncompressedMB} MB → Compressed: ${compressedMB} MB (${compressionRatio}% reduction)`);
  console.log(`[DB SAVE] Debug log entries: ${data.gameState.debugLog?.length || 0}`);
  console.log(`[DB SAVE] Turn snapshots: ${data.turnSnapshots?.length || 0}`);
  
  // Check if any debug log entries contain base64
  if (data.gameState.debugLog) {
    const base64Entries = data.gameState.debugLog.filter(log => 
      log.response?.includes('data:image') || log.response?.includes('base64,')
    );
    if (base64Entries.length > 0) {
      console.error(`[DB SAVE] WARNING: ${base64Entries.length} debug log entries contain base64 data!`);
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
  
  // Save compressed data
  await db.sessions.put({
    sessionId,
    compressedData,
    lastUpdated
  });
  
  return sessionId;
}

export async function deleteSessionData(sessionId: string): Promise<void> {
  await db.sessions.delete(sessionId);
}

export async function deleteAllSessions(): Promise<void> {
  await db.sessions.clear();
}

export async function getAllSessions(): Promise<SessionData[]> {
  const records = await db.sessions.orderBy('lastUpdated').reverse().toArray();
  
  const sessions: SessionData[] = [];
  for (const record of records) {
    try {
      // Check if this is a compressed record
      if ('compressedData' in record) {
        const decompressed = LZString.decompressFromUTF16(record.compressedData);
        if (!decompressed) {
          // Fallback: try parsing as raw JSON
          try {
            const data = JSON.parse(record.compressedData);
            console.log('[DB GET ALL] Parsed session as raw JSON:', record.sessionId);
            sessions.push({
              sessionId: record.sessionId,
              lastUpdated: record.lastUpdated,
              ...data
            } as SessionData);
          } catch {
            console.error('[DB GET ALL] Failed to parse session:', record.sessionId);
          }
          continue;
        }
        
        const data = JSON.parse(decompressed);
        sessions.push({
          sessionId: record.sessionId,
          lastUpdated: record.lastUpdated,
          ...data
        } as SessionData);
      } else {
        // Legacy uncompressed record
        const legacyRecord = record as any;
        console.log('[DB GET ALL] Found legacy uncompressed session:', legacyRecord.sessionId);
        sessions.push(legacyRecord as SessionData);
      }
    } catch (error) {
      console.error('[DB GET ALL] Error loading session:', record.sessionId, error);
    }
  }
  
  return sessions;
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

// Helper to calculate size of an object in bytes
function getObjectSize(obj: any): number {
  const jsonString = JSON.stringify(obj);
  return new Blob([jsonString]).size;
}

export interface StorageBreakdown {
  totalUncompressed: number;
  totalCompressed: number;
  compressionRatio: number;
  components: {
    gameState: {
      total: number;
      character: number;
      location: number;
      previousLocations: number;
      inventory: number;
      spells: number;
      statusEffects: number;
      quests: number;
      companions: number;
      encounteredCharacters: number;
      businesses: number;
      narrativeHistory: number;
      parsedRecaps: number;
      debugLog: number;
      worldBackstory: number;
      other: number;
    };
    gameConfig: number;
    costTracker: number;
    turnSnapshots: {
      total: number;
      count: number;
      averageSize: number;
      breakdown: Array<{
        turn: number;
        size: number;
        timestamp: number;
      }>;
    };
  };
}

export async function analyzeStorageBreakdown(sessionId: string): Promise<StorageBreakdown | null> {
  const sessionData = await getSessionData(sessionId);
  if (!sessionData) return null;

  const { gameState, gameConfig, costTracker, turnSnapshots } = sessionData;

  // Calculate sizes for each gameState component
  const gameStateBreakdown = {
    character: getObjectSize(gameState.character),
    location: getObjectSize(gameState.location),
    previousLocations: getObjectSize(gameState.previousLocations),
    inventory: getObjectSize(gameState.inventory),
    spells: getObjectSize(gameState.spells),
    statusEffects: getObjectSize(gameState.statusEffects),
    quests: getObjectSize(gameState.quests),
    companions: getObjectSize(gameState.companions),
    encounteredCharacters: getObjectSize(gameState.encounteredCharacters),
    businesses: getObjectSize(gameState.businesses),
    narrativeHistory: getObjectSize(gameState.narrativeHistory),
    parsedRecaps: getObjectSize(gameState.parsedRecaps),
    debugLog: getObjectSize(gameState.debugLog || []),
    worldBackstory: getObjectSize(gameState.worldBackstory || ''),
    other: 0
  };

  const gameStateTotal = getObjectSize(gameState);
  const knownGameStateSize = Object.values(gameStateBreakdown).reduce((sum, size) => sum + size, 0);
  gameStateBreakdown.other = Math.max(0, gameStateTotal - knownGameStateSize);

  // Calculate sizes for snapshots
  const snapshotBreakdown = turnSnapshots.map((snapshot, idx) => ({
    turn: turnSnapshots.length - idx,
    size: getObjectSize(snapshot),
    timestamp: snapshot.timestamp
  }));

  const snapshotsTotal = getObjectSize(turnSnapshots);
  const avgSnapshotSize = turnSnapshots.length > 0 ? snapshotsTotal / turnSnapshots.length : 0;

  // Calculate total sizes
  const { sessionId: _, lastUpdated: __, ...dataToMeasure } = sessionData;
  const totalUncompressed = getObjectSize(dataToMeasure);
  const compressedData = LZString.compressToUTF16(JSON.stringify(dataToMeasure));
  const totalCompressed = new Blob([compressedData]).size;
  const compressionRatio = totalUncompressed > 0 ? (1 - totalCompressed / totalUncompressed) * 100 : 0;

  return {
    totalUncompressed,
    totalCompressed,
    compressionRatio,
    components: {
      gameState: {
        total: gameStateTotal,
        ...gameStateBreakdown
      },
      gameConfig: getObjectSize(gameConfig),
      costTracker: getObjectSize(costTracker),
      turnSnapshots: {
        total: snapshotsTotal,
        count: turnSnapshots.length,
        averageSize: avgSnapshotSize,
        breakdown: snapshotBreakdown
      }
    }
  };
}
