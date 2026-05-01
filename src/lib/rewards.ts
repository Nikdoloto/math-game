import type { AchievementDefinition, AchievementId, GameProgress, SessionResult } from "../types";

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "star-starter",
    title: "Первая звезда",
    description: "Заверши первую тренировку.",
    icon: "star"
  },
  {
    id: "coin-hunter",
    title: "Охотник за монетами",
    description: "Накопи 150 монет.",
    icon: "coin"
  },
  {
    id: "chest-collector",
    title: "Коллекционер сундуков",
    description: "Улучши 12 фактов.",
    icon: "chest"
  },
  {
    id: "trophy-master",
    title: "Кубок мастерства",
    description: "Сделай 5 фактов уверенными.",
    icon: "trophy"
  },
  {
    id: "heart-guardian",
    title: "Береги сердца",
    description: "Пройди тренировку без ошибок.",
    icon: "heart"
  }
];

export interface SessionReward {
  xpEarned: number;
  coinsEarned: number;
  unlockedAchievements: AchievementId[];
}

const XP_PER_LEVEL = 120;

function countConfidentFacts(progress: GameProgress): number {
  return Object.values(progress.factMap).filter(
    (fact) => fact.status === "review" || fact.status === "mastered"
  ).length;
}

export function calculateLevelFromXp(xp: number): number {
  return Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
}

function hasAchievement(progress: GameProgress, id: AchievementId): boolean {
  return progress.unlockedAchievements.includes(id);
}

function unlock(
  unlocked: Set<AchievementId>,
  progress: GameProgress,
  id: AchievementId,
  condition: boolean
): void {
  if (condition && !hasAchievement(progress, id)) {
    unlocked.add(id);
  }
}

function getUnlockedForProgress(
  previous: GameProgress,
  next: GameProgress,
  summary: SessionResult
): AchievementId[] {
  const unlocked = new Set<AchievementId>();
  const confidentFacts = countConfidentFacts(next);

  unlock(unlocked, previous, "star-starter", next.totalSessions >= 1);
  unlock(unlocked, previous, "coin-hunter", next.coins >= 150);
  unlock(unlocked, previous, "chest-collector", summary.improvedFacts.length >= 12);
  unlock(unlocked, previous, "trophy-master", confidentFacts >= 5);
  unlock(unlocked, previous, "heart-guardian", summary.incorrectAnswers === 0 && summary.totalQuestions >= 12);

  return [...unlocked];
}

export function applySessionRewards(
  previous: GameProgress,
  baseNext: GameProgress,
  summary: SessionResult
): { nextProgress: GameProgress; reward: SessionReward } {
  const xpEarned =
    summary.correctAnswers * 10 +
    summary.improvedFacts.length * 6 +
    summary.masteredNow * 14 +
    (summary.correctAnswers === summary.totalQuestions ? 20 : 0);

  const coinsEarned =
    summary.correctAnswers * 2 +
    summary.masteredNow * 5 +
    (summary.improvedFacts.length >= 3 ? 6 : summary.improvedFacts.length > 0 ? 3 : 0);

  const seededProgress: GameProgress = {
    ...baseNext,
    xp: Math.max(0, previous.xp + xpEarned),
    coins: Math.max(0, previous.coins + coinsEarned),
    level: calculateLevelFromXp(Math.max(0, previous.xp + xpEarned)),
    unlockedAchievements: [...previous.unlockedAchievements]
  };

  const unlockedNow = getUnlockedForProgress(previous, seededProgress, summary);
  const nextProgress: GameProgress = {
    ...seededProgress,
    unlockedAchievements: [...new Set([...previous.unlockedAchievements, ...unlockedNow])]
  };

  return {
    nextProgress,
    reward: {
      xpEarned,
      coinsEarned,
      unlockedAchievements: unlockedNow
    }
  };
}
