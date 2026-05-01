import type { FactProgress, MultiplicationFact, SessionResult } from "../../types";
import { toCanonicalKey } from "./facts";
import { updateFactProgress } from "./progress";
import { enqueueErrorFact, pickNextFact, type ErrorQueueItem } from "./scheduler";

export interface SessionState {
  totalQuestions: number;
  askedCount: number;
  correctAnswers: number;
  incorrectAnswers: number;
  currentFact: MultiplicationFact | null;
  recentKeys: string[];
  errorQueue: ErrorQueueItem[];
  startedAtMs: number;
  masteredBefore: Set<string>;
  improvedFacts: Set<string>;
}

export interface EvaluatedAnswer {
  isCorrect: boolean;
  expected: number;
  updatedMap: Record<string, FactProgress>;
  updatedState: SessionState;
}

export function createSessionState(totalQuestions: number, factMap: Record<string, FactProgress>): SessionState {
  const masteredBefore = new Set(
    Object.values(factMap)
      .filter((item) => item.status === "mastered")
      .map((item) => item.key)
  );

  return {
    totalQuestions,
    askedCount: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    currentFact: null,
    recentKeys: [],
    errorQueue: [],
    startedAtMs: Date.now(),
    masteredBefore,
    improvedFacts: new Set<string>()
  };
}

export function nextQuestion(
  state: SessionState,
  facts: MultiplicationFact[],
  factMap: Record<string, FactProgress>,
  random: () => number
): SessionState {
  if (state.askedCount >= state.totalQuestions) {
    return state;
  }

  const fact = pickNextFact({
    facts,
    factMap,
    errorQueue: state.errorQueue,
    askedCount: state.askedCount,
    recentKeys: state.recentKeys,
    random
  });

  return {
    ...state,
    currentFact: fact,
    recentKeys: [...state.recentKeys, fact.key].slice(-6)
  };
}

export function evaluateAnswer(
  state: SessionState,
  factMap: Record<string, FactProgress>,
  rawAnswer: string,
  elapsedMs: number,
  random: () => number
): EvaluatedAnswer {
  if (!state.currentFact) {
    throw new Error("No current fact to evaluate");
  }

  const normalizedAnswer = Number.parseInt(rawAnswer, 10);
  const expected = state.currentFact.answer;
  const isCorrect = normalizedAnswer === expected;
  const key = toCanonicalKey(state.currentFact.a, state.currentFact.b);
  const previous = factMap[key];
  const updated = updateFactProgress(previous ? { ...previous, key } : { key, attempts: 0, correct: 0, incorrect: 0, streak: 0, avgTimeMs: 0, lastSeenAt: null, status: "new" }, isCorrect, elapsedMs, new Date().toISOString());

  const updatedMap: Record<string, FactProgress> = {
    ...factMap,
    [key]: updated
  };

  const updatedState: SessionState = {
    ...state,
    askedCount: state.askedCount + 1,
    correctAnswers: state.correctAnswers + (isCorrect ? 1 : 0),
    incorrectAnswers: state.incorrectAnswers + (isCorrect ? 0 : 1)
  };

  if (!isCorrect) {
    updatedState.errorQueue = enqueueErrorFact(
      state.errorQueue,
      key,
      updatedState.askedCount,
      random
    );
  }

  if (updated.status === "review" || updated.status === "mastered") {
    updatedState.improvedFacts.add(key);
  }

  return { isCorrect, expected, updatedMap, updatedState };
}

export function buildSessionResult(
  state: SessionState,
  factMap: Record<string, FactProgress>
): SessionResult {
  const now = new Date().toISOString();
  const hardestFacts = Object.values(factMap)
    .filter((fact) => fact.incorrect > 0)
    .sort((a, b) => b.incorrect - a.incorrect)
    .slice(0, 5)
    .map((fact) => fact.key);

  const masteredNow = Object.values(factMap).filter(
    (fact) => fact.status === "mastered" && !state.masteredBefore.has(fact.key)
  ).length;

  return {
    id: `${Date.now()}`,
    createdAt: now,
    totalQuestions: state.totalQuestions,
    correctAnswers: state.correctAnswers,
    incorrectAnswers: state.incorrectAnswers,
    masteredNow,
    improvedFacts: [...state.improvedFacts],
    hardestFacts,
    durationMs: Date.now() - state.startedAtMs
  };
}
