export type FactStatus = "new" | "learning" | "review" | "mastered";
export type AchievementId =
  | "star-starter"
  | "coin-hunter"
  | "chest-collector"
  | "trophy-master"
  | "heart-guardian";

export type Screen =
  | "welcome"
  | "home"
  | "game"
  | "summary"
  | "progress"
  | "achievements"
  | "friends"
  | "settings";

export interface MultiplicationFact {
  a: number;
  b: number;
  key: string;
  answer: number;
}

export interface FactProgress {
  key: string;
  attempts: number;
  correct: number;
  incorrect: number;
  streak: number;
  avgTimeMs: number;
  lastSeenAt: string | null;
  status: FactStatus;
}

export interface SessionResult {
  id: string;
  createdAt: string;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  masteredNow: number;
  improvedFacts: string[];
  hardestFacts: string[];
  durationMs: number;
}

export interface GameProgress {
  factMap: Record<string, FactProgress>;
  totalSessions: number;
  totalQuestions: number;
  totalCorrect: number;
  lastSessionAt: string | null;
  currentStreakDays: number;
  bestStreakDays: number;
  xp: number;
  coins: number;
  level: number;
  unlockedAchievements: AchievementId[];
  sessionHistory: SessionResult[];
}

export interface PlayerProfile {
  nickname: string;
  createdAt: string;
  updatedAt: string;
  gameProgress: GameProgress;
}

export interface LocalLeaderboardEntry {
  nickname: string;
  score: number;
  sessions: number;
  progressDelta: number;
  updatedAt: string;
}

export interface StorageSchemaV1 {
  version: 1;
  profile: LegacyPlayerProfile | null;
}

export interface StorageSchemaV2 {
  version: 2;
  profile: PlayerProfile | null;
}

export interface LegacyGameProgress {
  factMap: Record<string, FactProgress>;
  totalSessions: number;
  totalQuestions: number;
  totalCorrect: number;
  lastSessionAt: string | null;
  currentStreakDays: number;
  bestStreakDays: number;
  sessionHistory: SessionResult[];
}

export interface LegacyPlayerProfile {
  nickname: string;
  createdAt: string;
  updatedAt: string;
  gameProgress: LegacyGameProgress;
}

export interface AchievementDefinition {
  id: AchievementId;
  title: string;
  description: string;
  icon: "star" | "coin" | "chest" | "trophy" | "heart";
}
