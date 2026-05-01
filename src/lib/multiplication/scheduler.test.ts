import { describe, expect, it } from "vitest";
import { buildFactsPool } from "./facts";
import { enqueueErrorFact, pickNextFact } from "./scheduler";

describe("scheduler", () => {
  it("returns error fact after 2-5 later questions", () => {
    const queue = enqueueErrorFact([], "6x7", 1, () => 0.5);
    expect(queue[0].dueAfterQuestion).toBeGreaterThanOrEqual(3);
    expect(queue[0].dueAfterQuestion).toBeLessThanOrEqual(6);
  });

  it("prioritizes due error item", () => {
    const facts = buildFactsPool();
    const errorQueue = [{ key: "6x7", dueAfterQuestion: 1 }];
    const picked = pickNextFact({
      facts,
      factMap: {},
      errorQueue,
      askedCount: 2,
      recentKeys: [],
      random: () => 0.3
    });

    expect(picked.key).toBe("6x7");
    expect(errorQueue).toHaveLength(0);
  });
});
