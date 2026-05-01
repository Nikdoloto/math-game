import type { GameProgress, LocalLeaderboardEntry } from "../types";

function safeAccuracy(progress: GameProgress): number {
  if (progress.totalQuestions === 0) {
    return 0;
  }
  return progress.totalCorrect / progress.totalQuestions;
}

export function calculateFriendlyScore(progress: GameProgress): number {
  const accuracy = safeAccuracy(progress);
  const learnedFacts = Object.values(progress.factMap).filter(
    (fact) => fact.status === "review" || fact.status === "mastered"
  ).length;
  const repairedMistakes = Object.values(progress.factMap).reduce(
    (sum, fact) => sum + Math.min(fact.correct, fact.incorrect),
    0
  );

  const score =
    Math.round(accuracy * 450) +
    learnedFacts * 20 +
    progress.currentStreakDays * 15 +
    repairedMistakes * 5;

  return score;
}

export function upsertLocalLeaderboard(
  entries: LocalLeaderboardEntry[],
  nickname: string,
  progress: GameProgress
): LocalLeaderboardEntry[] {
  const score = calculateFriendlyScore(progress);
  const progressDelta = Object.values(progress.factMap).filter(
    (fact) => fact.status === "review" || fact.status === "mastered"
  ).length;

  const entry: LocalLeaderboardEntry = {
    nickname,
    score,
    sessions: progress.totalSessions,
    progressDelta,
    updatedAt: new Date().toISOString()
  };

  const withoutSame = entries.filter(
    (oldEntry) => oldEntry.nickname.toLowerCase() !== nickname.toLowerCase()
  );

  return [...withoutSame, entry]
    .sort((a, b) => b.score - a.score || b.progressDelta - a.progressDelta)
    .slice(0, 20);
}
