import { describe, expect, it } from "vitest";
import { createEmptyFactProgress, deriveFactStatus, updateFactProgress } from "./progress";

describe("progress", () => {
  it("starts as new", () => {
    const base = createEmptyFactProgress("6x7");
    expect(deriveFactStatus(base)).toBe("new");
  });

  it("moves to learning after early mistakes", () => {
    let state = createEmptyFactProgress("6x7");
    state = updateFactProgress(state, false, 4200, new Date().toISOString());
    expect(state.status).toBe("learning");
    state = updateFactProgress(state, false, 4000, new Date().toISOString());
    expect(state.status).toBe("learning");
  });

  it("marks a practiced correct fact as learning after the first answer", () => {
    const state = updateFactProgress(
      createEmptyFactProgress("6x7"),
      true,
      3200,
      new Date().toISOString()
    );

    expect(state.status).toBe("learning");
  });

  it("reaches review and mastered by consistent correct answers", () => {
    let state = createEmptyFactProgress("6x7");
    for (let i = 0; i < 3; i += 1) {
      state = updateFactProgress(state, true, 3500, new Date().toISOString());
    }
    expect(state.status).toBe("review");

    for (let i = 0; i < 3; i += 1) {
      state = updateFactProgress(state, true, 3200, new Date().toISOString());
    }
    expect(state.status).toBe("mastered");
  });
});
