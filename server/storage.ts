import { type GameState, type InsertGameState, type GameStateData, type GameConfig, type CostTracker } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getGameState(id: string): Promise<GameState | undefined>;
  createGameState(state: InsertGameState): Promise<GameState>;
  updateGameState(id: string, state: Partial<InsertGameState>): Promise<GameState>;
  deleteGameState(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private gameStates: Map<string, GameState>;

  constructor() {
    this.gameStates = new Map();
  }

  async getGameState(id: string): Promise<GameState | undefined> {
    return this.gameStates.get(id);
  }

  async createGameState(insertState: InsertGameState): Promise<GameState> {
    const id = randomUUID();
    const now = Date.now();
    const gameState: GameState = {
      id,
      state: insertState.state as GameStateData,
      config: insertState.config as GameConfig,
      costTracker: insertState.costTracker as CostTracker,
      createdAt: now,
      updatedAt: now,
    };
    this.gameStates.set(id, gameState);
    return gameState;
  }

  async updateGameState(id: string, updates: Partial<InsertGameState>): Promise<GameState> {
    const existing = this.gameStates.get(id);
    if (!existing) {
      throw new Error("Game state not found");
    }
    
    const updated: GameState = {
      id: existing.id,
      state: (updates.state || existing.state) as GameStateData,
      config: (updates.config || existing.config) as GameConfig,
      costTracker: (updates.costTracker || existing.costTracker) as CostTracker,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    };
    
    this.gameStates.set(id, updated);
    return updated;
  }

  async deleteGameState(id: string): Promise<void> {
    this.gameStates.delete(id);
  }
}

export const storage = new MemStorage();
