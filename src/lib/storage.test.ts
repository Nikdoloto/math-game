import { afterEach, describe, expect, it } from "vitest";
import { loadLeaderboard, loadProfile, saveProfile } from "./storage";

describe("storage", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("does not crash on corrupted profile payload", () => {
    window.localStorage.setItem("eduGame.profile.v2", "{broken-json");
    const profile = loadProfile();
    expect(profile).toBeNull();
  });

  it("does not crash on wrong schema", () => {
    window.localStorage.setItem(
      "eduGame.profile.v2",
      JSON.stringify({ version: 2, profile: { broken: true } })
    );
    expect(loadProfile()).toBeNull();
  });

  it("does not load profile with invalid fact progress", () => {
    window.localStorage.setItem(
      "eduGame.profile.v1",
      JSON.stringify({
        version: 1,
        profile: {
          nickname: "Test",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          gameProgress: {
            factMap: {
              "6x7": {
                key: "6x7",
                attempts: "bad",
                correct: 1,
                incorrect: 0,
                streak: 1,
                avgTimeMs: 3000,
                lastSeenAt: null,
                status: "review"
              }
            },
            totalSessions: 0,
            totalQuestions: 0,
            totalCorrect: 0,
            lastSessionAt: null,
            currentStreakDays: 0,
            bestStreakDays: 0,
            sessionHistory: []
          }
        }
      })
    );

    expect(loadProfile()).toBeNull();
  });

  it("migrates profile from v1 to v2 with rewards defaults", () => {
    window.localStorage.setItem(
      "eduGame.profile.v1",
      JSON.stringify({
        version: 1,
        profile: {
          nickname: "Legacy",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          gameProgress: {
            factMap: {},
            totalSessions: 3,
            totalQuestions: 36,
            totalCorrect: 30,
            lastSessionAt: null,
            currentStreakDays: 2,
            bestStreakDays: 4,
            sessionHistory: []
          }
        }
      })
    );

    const migrated = loadProfile();
    expect(migrated?.nickname).toBe("Legacy");
    expect(migrated?.gameProgress.xp).toBe(0);
    expect(migrated?.gameProgress.coins).toBe(0);
    expect(migrated?.gameProgress.level).toBe(1);
    expect(migrated?.gameProgress.unlockedAchievements).toEqual([]);
    expect(window.localStorage.getItem("eduGame.profile.v2")).toBeTruthy();
    expect(window.localStorage.getItem("eduGame.profile.v1")).toBeNull();
  });

  it("saves and loads profile", () => {
    const sample = {
      nickname: "Test",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      gameProgress: {
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
      }
    };
    saveProfile(sample);
    expect(loadProfile()?.nickname).toBe("Test");
  });

  it("returns empty leaderboard for invalid storage data", () => {
    window.localStorage.setItem("eduGame.localLeaderboard.v1", "{\"invalid\":true}");
    expect(loadLeaderboard()).toEqual([]);
  });
});
