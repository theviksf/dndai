import Dexie, { Table } from 'dexie';
import LZString from 'lz-string';
import type { GameStateData, GameConfig, CostTracker, TurnSnapshot } from '@shared/schema';
import type { WorkerResponse } from './compression-worker';

export interface SessionData {
  sessionId: string;
  gameState: GameStateData;
  gameConfig: GameConfig;
  costTracker?: CostTracker;
  turnSnapshots: TurnSnapshot[];
  isGameStarted: boolean;
  lastUpdated: number;
}

interface CompressedSessionData {
  sessionId: string;
  compressedData: string;
  lastUpdated: number;
}

export class DnDGameDB extends Dexie {
  sessions!: Table<CompressedSessionData, string>;

  constructor() {
    super('DnDAdventureDB');
    
    this.version(1).stores({
      sessions: 'sessionId, lastUpdated'
    });
    
    this.version(2).stores({
      sessions: 'sessionId, lastUpdated'
    }).upgrade(async (tx) => {
      const sessions = await tx.table('sessions').toArray();
      await tx.table('sessions').clear();
      
      for (const session of sessions) {
        const sessionAny = session as any;
        
        if ('gameState' in sessionAny && !('compressedData' in sessionAny)) {
          const { sessionId, lastUpdated, ...data } = sessionAny;
          const compressed = LZString.compressToUTF16(JSON.stringify(data));
          await tx.table('sessions').put({
            sessionId,
            compressedData: compressed,
            lastUpdated
          });
          console.log('[DB MIGRATION] Compressed legacy session:', sessionId);
        } else if ('compressedData' in sessionAny) {
          await tx.table('sessions').put(sessionAny);
        } else {
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

let compressionWorker: Worker | null = null;
let workerRequestId = 0;
const pendingWorkerRequests = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();

function getCompressionWorker(): Worker | null {
  if (compressionWorker) return compressionWorker;
  
  try {
    compressionWorker = new Worker(
      new URL('./compression-worker.ts', import.meta.url),
      { type: 'module' }
    );
    
    compressionWorker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { id } = e.data;
      const pending = pendingWorkerRequests.get(id);
      if (!pending) return;
      pendingWorkerRequests.delete(id);
      
      if (e.data.type === 'error') {
        pending.reject(new Error(e.data.error));
      } else {
        pending.resolve(e.data);
      }
    };
    
    compressionWorker.onerror = (err) => {
      console.error('[WORKER] Compression worker error:', err);
      compressionWorker = null;
      pendingWorkerRequests.forEach((pending, id) => {
        pending.reject(new Error('Worker crashed'));
        pendingWorkerRequests.delete(id);
      });
    };
    
    return compressionWorker;
  } catch (err) {
    console.warn('[WORKER] Failed to create compression worker, using main thread fallback:', err);
    return null;
  }
}

async function compressOffThread(jsonString: string): Promise<{ compressedData: string; uncompressedSize: number; compressedSize: number }> {
  const worker = getCompressionWorker();
  
  if (!worker) {
    const uncompressedSize = new Blob([jsonString]).size;
    const compressedData = LZString.compressToUTF16(jsonString);
    const compressedSize = new Blob([compressedData]).size;
    return { compressedData, uncompressedSize, compressedSize };
  }
  
  const id = ++workerRequestId;
  
  return new Promise((resolve, reject) => {
    pendingWorkerRequests.set(id, { resolve, reject });
    worker.postMessage({ type: 'compress', id, jsonString });
    
    setTimeout(() => {
      if (pendingWorkerRequests.has(id)) {
        pendingWorkerRequests.delete(id);
        console.warn('[WORKER] Compression timed out, falling back to main thread');
        const uncompressedSize = new Blob([jsonString]).size;
        const compressedData = LZString.compressToUTF16(jsonString);
        const compressedSize = new Blob([compressedData]).size;
        resolve({ compressedData, uncompressedSize, compressedSize });
      }
    }, 30000);
  });
}

async function decompressOffThread(compressedData: string): Promise<string | null> {
  const worker = getCompressionWorker();
  
  if (!worker) {
    return LZString.decompressFromUTF16(compressedData);
  }
  
  const id = ++workerRequestId;
  
  return new Promise((resolve, reject) => {
    pendingWorkerRequests.set(id, {
      resolve: (data: any) => resolve(data.jsonString),
      reject: () => {
        console.warn('[WORKER] Decompression failed in worker, falling back to main thread');
        resolve(LZString.decompressFromUTF16(compressedData));
      }
    });
    worker.postMessage({ type: 'decompress', id, compressedData });
    
    setTimeout(() => {
      if (pendingWorkerRequests.has(id)) {
        pendingWorkerRequests.delete(id);
        console.warn('[WORKER] Decompression timed out, falling back to main thread');
        resolve(LZString.decompressFromUTF16(compressedData));
      }
    }, 15000);
  });
}

export async function getSessionData(sessionId: string): Promise<SessionData | undefined> {
  const record = await db.sessions.get(sessionId);
  if (!record) return undefined;
  
  try {
    if ('compressedData' in record) {
      const decompressed = await decompressOffThread(record.compressedData);
      if (!decompressed) {
        console.error('[DB GET] Failed to decompress data, attempting raw JSON parse');
        try {
          const data = JSON.parse(record.compressedData);
          console.log('[DB GET] Successfully parsed as raw JSON, re-saving as compressed');
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
      console.log('[DB GET] Found legacy uncompressed record, converting to compressed');
      const legacyData = record as any;
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
  
  const { sessionId, lastUpdated, ...dataToCompress } = data;
  
  const jsonString = JSON.stringify(dataToCompress);
  
  const { compressedData, uncompressedSize, compressedSize } = await compressOffThread(jsonString);
  
  const uncompressedMB = (uncompressedSize / (1024 * 1024)).toFixed(2);
  const compressedMB = (compressedSize / (1024 * 1024)).toFixed(2);
  const compressionRatio = ((1 - compressedSize / uncompressedSize) * 100).toFixed(1);
  
  console.log(`[DB SAVE] Uncompressed: ${uncompressedMB} MB → Compressed: ${compressedMB} MB (${compressionRatio}% reduction)`);
  
  await db.sessions.put({
    sessionId,
    compressedData,
    lastUpdated
  });
  
  return sessionId;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSaveData: SessionData | null = null;
let saveInProgress = false;
let flushResolvers: Array<() => void> = [];

const SAVE_DEBOUNCE_MS = 2500;

async function executeSave() {
  if (!pendingSaveData || saveInProgress) return;
  
  saveInProgress = true;
  const dataToSave = pendingSaveData;
  pendingSaveData = null;
  
  try {
    await saveSessionData(dataToSave);
    console.log('[DB] Debounced save complete');
  } catch (error) {
    console.error('[DB] Debounced save failed:', error);
  } finally {
    saveInProgress = false;
    const resolvers = flushResolvers;
    flushResolvers = [];
    resolvers.forEach(r => r());
    
    if (pendingSaveData) {
      executeSave();
    }
  }
}

export function scheduleSave(data: SessionData) {
  pendingSaveData = data;
  
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  
  saveTimer = setTimeout(() => {
    saveTimer = null;
    executeSave();
  }, SAVE_DEBOUNCE_MS);
}

export function flushPendingSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  
  if (!pendingSaveData && !saveInProgress) {
    return Promise.resolve();
  }
  
  return new Promise<void>((resolve) => {
    flushResolvers.push(resolve);
    if (!saveInProgress) {
      executeSave();
    }
  });
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
      if ('compressedData' in record) {
        const decompressed = await decompressOffThread(record.compressedData);
        if (!decompressed) {
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

  const snapshotBreakdown = turnSnapshots.map((snapshot, idx) => ({
    turn: turnSnapshots.length - idx,
    size: getObjectSize(snapshot),
    timestamp: snapshot.timestamp
  }));

  const snapshotsTotal = getObjectSize(turnSnapshots);
  const avgSnapshotSize = turnSnapshots.length > 0 ? snapshotsTotal / turnSnapshots.length : 0;

  const { sessionId: _, lastUpdated: __, ...dataToMeasure } = sessionData;
  const totalUncompressed = getObjectSize(dataToMeasure);
  const { compressedSize: totalCompressed } = await compressOffThread(JSON.stringify(dataToMeasure));
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
