import type {
  AchievementId,
  FactProgress,
  GameProgress,
  LegacyPlayerProfile,
  LocalLeaderboardEntry,
  PlayerProfile,
  StorageSchemaV1,
  StorageSchemaV2
} from "../types";

const PROFILE_KEY_V1 = "eduGame.profile.v1";
const PROFILE_KEY_V2 = "eduGame.profile.v2";
const LEADERBOARD_KEY = "eduGame.localLeaderboard.v1";

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidFactStatus(value: unknown): value is FactProgress["status"] {
  return value === "new" || value === "learning" || value === "review" || value === "mastered";
}

function isValidFactProgress(value: unknown): value is FactProgress {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.key) &&
    isNumber(value.attempts) &&
    isNumber(value.correct) &&
    isNumber(value.incorrect) &&
    isNumber(value.streak) &&
    isNumber(value.avgTimeMs) &&
    (value.lastSeenAt === null || isString(value.lastSeenAt)) &&
    isValidFactStatus(value.status)
  );
}

function isValidFactMap(value: unknown): value is Record<string, FactProgress> {
  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).every(isValidFactProgress);
}

function isValidAchievementId(value: unknown): value is AchievementId {
  return (
    value === "star-starter" ||
    value === "coin-hunter" ||
    value === "chest-collector" ||
    value === "trophy-master" ||
    value === "heart-guardian"
  );
}

export function createEmptyGameProgress(): GameProgress {
  return {
    factMap: {},
    totalSessions: 0,
    totalQuestions: 0,
    totalCorrect: 0,
    lastSessionAt: null,
    currentStreakDays: 0,
    bestStreakDays: 0,
    xp: 0,
    coins: 0,
    level: 1,
    unlockedAchievements: [],
    sessionHistory: []
  };
}

function isValidLegacyGameProgress(value: unknown): value is LegacyPlayerProfile["gameProgress"] {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isValidFactMap(value.factMap) &&
    isNumber(value.totalSessions) &&
    isNumber(value.totalQuestions) &&
    isNumber(value.totalCorrect) &&
    (value.lastSessionAt === null || isString(value.lastSessionAt)) &&
    isNumber(value.currentStreakDays) &&
    isNumber(value.bestStreakDays) &&
    Array.isArray(value.sessionHistory)
  );
}

function isValidGameProgress(value: unknown): value is GameProgress {
  if (!isValidLegacyGameProgress(value)) {
    return false;
  }

  const maybeProgress = value as unknown as Record<string, unknown>;
  return (
    isNumber(maybeProgress.xp) &&
    isNumber(maybeProgress.coins) &&
    isNumber(maybeProgress.level) &&
    Array.isArray(maybeProgress.unlockedAchievements) &&
    maybeProgress.unlockedAchievements.every(isValidAchievementId)
  );
}

function isValidLegacyProfile(value: unknown): value is LegacyPlayerProfile {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.nickname) &&
    value.nickname.trim().length > 0 &&
    isString(value.createdAt) &&
    isString(value.updatedAt) &&
    isValidLegacyGameProgress(value.gameProgress)
  );
}

function isValidProfile(value: unknown): value is PlayerProfile {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.nickname) &&
    value.nickname.trim().length > 0 &&
    isString(value.createdAt) &&
    isString(value.updatedAt) &&
    isValidGameProgress(value.gameProgress)
  );
}

function isValidStorageSchemaV1(value: unknown): value is StorageSchemaV1 {
  if (!isRecord(value)) {
    return false;
  }

  const profileOk = value.profile === null || isValidLegacyProfile(value.profile);
  return value.version === 1 && profileOk;
}

function isValidStorageSchemaV2(value: unknown): value is StorageSchemaV2 {
  if (!isRecord(value)) {
    return false;
  }

  const profileOk = value.profile === null || isValidProfile(value.profile);
  return value.version === 2 && profileOk;
}

function sanitizeAchievements(value: AchievementId[]): AchievementId[] {
  const uniq = new Set<AchievementId>();
  for (const item of value) {
    if (isValidAchievementId(item)) {
      uniq.add(item);
    }
  }
  return [...uniq];
}

function migrateLegacyProfile(profile: LegacyPlayerProfile | null): PlayerProfile | null {
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    gameProgress: {
      ...createEmptyGameProgress(),
      ...profile.gameProgress,
      xp: 0,
      coins: 0,
      level: 1,
      unlockedAchievements: []
    }
  };
}

function sanitizeLeaderboard(value: unknown): LocalLeaderboardEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => isRecord(item))
    .filter(
      (item) =>
        isString(item.nickname) &&
        isNumber(item.score) &&
        isNumber(item.sessions) &&
        isNumber(item.progressDelta) &&
        isString(item.updatedAt)
    )
    .map((item) => ({
      nickname: item.nickname as string,
      score: item.score as number,
      sessions: item.sessions as number,
      progressDelta: item.progressDelta as number,
      updatedAt: item.updatedAt as string
    }));
}

function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

export function loadProfile(): PlayerProfile | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const rawV2 = storage.getItem(PROFILE_KEY_V2);
  if (rawV2) {
    const parsedV2 = safeJsonParse<unknown>(rawV2);
    if (parsedV2 && isValidStorageSchemaV2(parsedV2)) {
      return parsedV2.profile;
    }
  }

  const rawV1 = storage.getItem(PROFILE_KEY_V1);
  if (!rawV1) {
    return null;
  }

  const parsedV1 = safeJsonParse<unknown>(rawV1);
  if (!parsedV1 || !isValidStorageSchemaV1(parsedV1)) {
    return null;
  }

  const migrated = migrateLegacyProfile(parsedV1.profile);
  if (!migrated) {
    saveProfile(null);
    storage.removeItem(PROFILE_KEY_V1);
    return null;
  }

  saveProfile({
    ...migrated,
    gameProgress: {
      ...migrated.gameProgress,
      unlockedAchievements: sanitizeAchievements(migrated.gameProgress.unlockedAchievements)
    }
  });
  storage.removeItem(PROFILE_KEY_V1);
  return migrated;
}

export function saveProfile(profile: PlayerProfile | null): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const payload: StorageSchemaV2 = {
    version: 2,
    profile
  };

  storage.setItem(PROFILE_KEY_V2, JSON.stringify(payload));
}

export function loadLeaderboard(): LocalLeaderboardEntry[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  const raw = storage.getItem(LEADERBOARD_KEY);
  if (!raw) {
    return [];
  }

  const parsed = safeJsonParse<unknown>(raw);
  return sanitizeLeaderboard(parsed);
}

export function saveLeaderboard(entries: LocalLeaderboardEntry[]): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
}

export function clearAllLocalData(): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(PROFILE_KEY_V1);
  storage.removeItem(PROFILE_KEY_V2);
  storage.removeItem(LEADERBOARD_KEY);
}
