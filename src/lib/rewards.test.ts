import { describe, expect, it } from "vitest";
import type { GameProgress, SessionResult } from "../types";
import { applySessionRewards, calculateLevelFromXp } from "./rewards";
import { createEmptyGameProgress } from "./storage";

function buildSummary(overrides?: Partial<SessionResult>): SessionResult {
  return {
    id: "1",
    createdAt: new Date().toISOString(),
    totalQuestions: 12,
    correctAnswers: 10,
    incorrectAnswers: 2,
    masteredNow: 1,
    improvedFacts: ["2x6", "3x4", "4x7"],
    hardestFacts: ["6x8"],
    durationMs: 24000,
    ...overrides
  };
}

function buildProgress(overrides?: Partial<GameProgress>): GameProgress {
  return {
    ...createEmptyGameProgress(),
    ...overrides
  };
}

describe("rewards", () => {
  it("adds xp and coins after a session", () => {
    const previous = buildProgress();
    const baseNext = buildProgress({ totalSessions: 1 });
    const summary = buildSummary();

    const { nextProgress, reward } = applySessionRewards(previous, baseNext, summary);

    expect(reward.xpEarned).toBeGreaterThan(0);
    expect(reward.coinsEarned).toBeGreaterThan(0);
    expect(nextProgress.xp).toBe(reward.xpEarned);
    expect(nextProgress.coins).toBe(reward.coinsEarned);
  });

  it("unlocks first-session achievement", () => {
    const previous = buildProgress();
    const baseNext = buildProgress({ totalSessions: 1 });
    const summary = buildSummary();

    const { nextProgress, reward } = applySessionRewards(previous, baseNext, summary);

    expect(reward.unlockedAchievements).toContain("star-starter");
    expect(nextProgress.unlockedAchievements).toContain("star-starter");
  });

  it("unlocks heart achievement for flawless 12/12", () => {
    const previous = buildProgress();
    const baseNext = buildProgress({ totalSessions: 2 });
    const summary = buildSummary({
      correctAnswers: 12,
      incorrectAnswers: 0
    });

    const { nextProgress } = applySessionRewards(previous, baseNext, summary);
    expect(nextProgress.unlockedAchievements).toContain("heart-guardian");
  });

  it("derives level from xp", () => {
    expect(calculateLevelFromXp(0)).toBe(1);
    expect(calculateLevelFromXp(119)).toBe(1);
    expect(calculateLevelFromXp(120)).toBe(2);
    expect(calculateLevelFromXp(240)).toBe(3);
  });
});
