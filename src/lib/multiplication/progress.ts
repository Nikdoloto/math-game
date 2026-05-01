import type { FactProgress, FactStatus } from "../../types";

const MASTERED_TIME_THRESHOLD_MS = 5000;

export function createEmptyFactProgress(key: string): FactProgress {
  return {
    key,
    attempts: 0,
    correct: 0,
    incorrect: 0,
    streak: 0,
    avgTimeMs: 0,
    lastSeenAt: null,
    status: "new"
  };
}

export function deriveFactStatus(progress: FactProgress): FactStatus {
  if (progress.attempts === 0) {
    return "new";
  }

  const accuracy = progress.correct / Math.max(progress.attempts, 1);

  if (progress.attempts < 2) {
    return "learning";
  }

  if (
    accuracy >= 0.9 &&
    progress.streak >= 5 &&
    progress.avgTimeMs > 0 &&
    progress.avgTimeMs <= MASTERED_TIME_THRESHOLD_MS
  ) {
    return "mastered";
  }

  if (accuracy >= 0.8 && progress.streak >= 3) {
    return "review";
  }

  return "learning";
}

export function updateFactProgress(
  previous: FactProgress | undefined,
  isCorrect: boolean,
  elapsedMs: number,
  atIso: string
): FactProgress {
  const base = previous ? { ...previous } : createEmptyFactProgress("unknown");
  const attempts = base.attempts + 1;
  const correct = base.correct + (isCorrect ? 1 : 0);
  const incorrect = base.incorrect + (isCorrect ? 0 : 1);
  const streak = isCorrect ? base.streak + 1 : 0;
  const avgTimeMs = base.attempts === 0 ? elapsedMs : Math.round((base.avgTimeMs * base.attempts + elapsedMs) / attempts);

  const next: FactProgress = {
    ...base,
    attempts,
    correct,
    incorrect,
    streak,
    avgTimeMs,
    lastSeenAt: atIso
  };

  next.status = deriveFactStatus(next);
  return next;
}
