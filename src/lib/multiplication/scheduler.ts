import type { FactProgress, MultiplicationFact } from "../../types";

export interface ErrorQueueItem {
  key: string;
  dueAfterQuestion: number;
}

export interface SchedulerInput {
  facts: MultiplicationFact[];
  factMap: Record<string, FactProgress>;
  errorQueue: ErrorQueueItem[];
  askedCount: number;
  recentKeys: string[];
  random: () => number;
}

const ERROR_REPEAT_MIN_GAP = 2;
const ERROR_REPEAT_MAX_GAP = 5;

function weightedStatus(status: FactProgress["status"]): number {
  switch (status) {
    case "learning":
      return 100;
    case "review":
      return 75;
    case "new":
      return 60;
    case "mastered":
      return 15;
    default:
      return 40;
  }
}

function getRecencyPenalty(lastSeenAt: string | null): number {
  if (!lastSeenAt) {
    return 30;
  }

  const ageMs = Date.now() - new Date(lastSeenAt).getTime();
  const ageMinutes = ageMs / 1000 / 60;
  return Math.min(30, Math.floor(ageMinutes / 2));
}

export function enqueueErrorFact(
  queue: ErrorQueueItem[],
  factKey: string,
  askedCount: number,
  random: () => number
): ErrorQueueItem[] {
  const hasSame = queue.some((item) => item.key === factKey);
  if (hasSame) {
    return queue;
  }

  const gap =
    ERROR_REPEAT_MIN_GAP +
    Math.floor(random() * (ERROR_REPEAT_MAX_GAP - ERROR_REPEAT_MIN_GAP + 1));

  return [...queue, { key: factKey, dueAfterQuestion: askedCount + gap }];
}

export function popDueErrorFact(
  queue: ErrorQueueItem[],
  askedCount: number
): { dueKey: string | null; queue: ErrorQueueItem[] } {
  const idx = queue.findIndex((item) => item.dueAfterQuestion <= askedCount);
  if (idx < 0) {
    return { dueKey: null, queue };
  }

  const dueKey = queue[idx].key;
  const nextQueue = queue.filter((_, index) => index !== idx);
  return { dueKey, queue: nextQueue };
}

export function pickNextFact(input: SchedulerInput): MultiplicationFact {
  const { facts, factMap, askedCount, recentKeys, random } = input;
  const due = popDueErrorFact(input.errorQueue, askedCount);
  input.errorQueue.splice(0, input.errorQueue.length, ...due.queue);

  if (due.dueKey) {
    const fromQueue = facts.find((fact) => fact.key === due.dueKey);
    if (fromQueue) {
      return fromQueue;
    }
  }

  const recent = new Set(recentKeys.slice(-2));

  const scored = facts
    .filter((fact) => !recent.has(fact.key) || facts.length <= 3)
    .map((fact) => {
      const progress = factMap[fact.key];
      const statusWeight = weightedStatus(progress?.status ?? "new");
      const recencyWeight = getRecencyPenalty(progress?.lastSeenAt ?? null);
      const randomNoise = random() * 8;
      return {
        fact,
        score: statusWeight + recencyWeight + randomNoise
      };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0].fact;
}
