import { pgTable, text, varchar, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Game state types
export type Attribute = {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  ac: number;
};

export type StatusEffect = {
  id: string;
  name: string;
  description: string;
  icon: string;
  turnsRemaining: number;
};

export type InventoryItem = {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'weapon' | 'consumable' | 'quest' | 'misc';
  quantity: number;
  price?: number;
  equipped?: boolean;
  magical?: boolean;
  stats?: string;
};

export type Quest = {
  id: string;
  title: string;
  description: string;
  type: 'main' | 'side';
  icon: string;
  completed: boolean;
  objectives: {
    text: string;
    completed: boolean;
  }[];
  progress?: {
    current: number;
    total: number;
  };
  backstory?: string;
};

export type Spell = {
  id: string;
  name: string;
  level: number;
  school: string;
  description: string;
  icon: string;
};

export type Companion = {
  id: string;
  name: string;
  race: string;
  age: string;
  sex: string;
  hairColor?: string;
  class: string;
  level: number;
  appearance: string;
  personality: string;
  criticalMemories: string;
  feelingsTowardsPlayer: string;
  relationship: string;
  imageUrl?: string;
  backstory?: string;
  revelations?: Revelation[];
};

export type EncounteredCharacter = {
  id: string;
  name: string;
  age: string;
  sex: string;
  hairColor?: string;
  role: string;
  location: string;
  appearance: string;
  description: string;
  status: 'alive' | 'dead';
  relationship: number;
  imageUrl?: string;
  backstory?: string;
  revelations?: Revelation[];
};

export type Business = {
  id: string;
  name: string;
  weeklyIncome: number;
  purchaseCost: number;
  manager: string;
  runningCost: number;
  description: string;
  imageUrl?: string;
};

export type NarrativeMessage = {
  id: string;
  type: 'dm' | 'player';
  content: string;
  timestamp: number;
  diceRoll?: {
    type: string;
    result: number;
    success: boolean;
  };
};

export type Revelation = {
  text: string;
  revealedAtTurn?: number;
};

export type DebugLogEntry = {
  id: string;
  timestamp: number;
  type: 'primary' | 'parser' | 'image' | 'backstory' | 'revelations';
  prompt: string;
  response: string;
  model: string;
  tokens?: {
    prompt: number;
    completion: number;
  };
  entityType?: string;
  imageUrl?: string | null;
  error?: string;
};

export type GameCharacter = {
  name: string;
  race: string;
  class: string;
  age: string;
  sex: string;
  hairColor?: string;
  description: string;
  level: number;
  xp: number;
  nextLevelXp: number;
  hp: number;
  maxHp: number;
  gold: number;
  attributes: Attribute;
  imageUrl?: string;
  revelations?: Revelation[];
};

export type TurnSnapshot = {
  state: Omit<GameStateData, 'turnSnapshots'>;
  costTracker: CostTracker;
  timestamp: number;
};

export type LocationHierarchy = {
  country?: string;
  region?: string;
  city?: string;
  district?: string;
  building?: string;
};

export type LocationRelative = {
  reference_place?: string;
  distance_km?: number;
  direction?: string;
};

export type LocationDetails = {
  owner?: string;
  notable_people?: string[];
  capacity?: number;
  services?: string[];
  price_range?: string;
};

export type NearbyLocation = {
  name: string;
  distance_km: number;
  direction: string;
};

export type Location = {
  name: string;
  type?: string;
  description: string;
  hierarchy?: LocationHierarchy;
  relative_location?: LocationRelative;
  details?: LocationDetails;
  connections?: {
    nearby_locations?: NearbyLocation[];
  };
  imageUrl?: string;
  backstory?: string;
  revelations?: Revelation[];
};

export type PreviousLocation = {
  id: string;
  name: string;
  type?: string;
  description: string;
  hierarchy?: LocationHierarchy;
  relative_location?: LocationRelative;
  details?: LocationDetails;
  connections?: {
    nearby_locations?: NearbyLocation[];
  };
  imageUrl?: string;
  lastVisited: number;
  backstory?: string;
  revelations?: Revelation[];
};

export type GameStateData = {
  character: GameCharacter;
  location: Location;
  previousLocations: PreviousLocation[];
  inventory: InventoryItem[];
  spells: Spell[];
  statusEffects: StatusEffect[];
  quests: Quest[];
  companions: Companion[];
  encounteredCharacters: EncounteredCharacter[];
  businesses: Business[];
  narrativeHistory: NarrativeMessage[];
  parsedRecaps: string[];
  turnCount: number;
  turnSnapshots: TurnSnapshot[];
  debugLog?: DebugLogEntry[];
  updatedTabs?: string[];
  lastIncomeCollectedTurn?: number;
  worldBackstory?: string;
};

export type GameConfig = {
  primaryLLM: string;
  parserLLM: string;
  backstoryLLM: string;
  revelationsLLM: string;
  difficulty: 'easy' | 'normal' | 'hard' | 'deadly';
  narrativeStyle: 'concise' | 'balanced' | 'detailed' | 'verbose';
  autoSave: boolean;
  openRouterApiKey: string;
  dmSystemPrompt: string;
  parserSystemPrompt: string;
  characterImagePrompt: string;
  locationImagePrompt: string;
  backstorySystemPrompt: string;
  revelationsSystemPrompt: string;
  autoGenerateImages: boolean;
  autoGenerateBackstories: boolean;
  autoGenerateRevelations: boolean;
};

export type OpenRouterModel = {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
};

export type CostTracker = {
  sessionCost: number;
  turnCount: number;
  primaryTokens: {
    prompt: number;
    completion: number;
  };
  parserTokens: {
    prompt: number;
    completion: number;
  };
  primaryCost: number;
  parserCost: number;
  lastTurnPrimaryTokens: {
    prompt: number;
    completion: number;
  };
  lastTurnParserTokens: {
    prompt: number;
    completion: number;
  };
  lastTurnPrimaryCost: number;
  lastTurnParserCost: number;
  lastTurnCost: number;
  imageCost: number;
  lastTurnImageCost: number;
  revelationsCost?: number;
  lastTurnRevelationsCost?: number;
};

// Database tables
export const gameStates = pgTable("game_states", {
  id: varchar("id").primaryKey(),
  state: jsonb("state").notNull().$type<GameStateData>(),
  config: jsonb("config").notNull().$type<GameConfig>(),
  costTracker: jsonb("cost_tracker").notNull().$type<CostTracker>(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const insertGameStateSchema = createInsertSchema(gameStates).omit({
  id: true,
});

export type InsertGameState = z.infer<typeof insertGameStateSchema>;
export type GameState = typeof gameStates.$inferSelect;
