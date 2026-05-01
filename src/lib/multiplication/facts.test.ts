import { describe, expect, it } from "vitest";
import { buildFactsPool, toCanonicalKey } from "./facts";

describe("facts", () => {
  it("builds canonical key regardless of order", () => {
    expect(toCanonicalKey(6, 7)).toBe("6x7");
    expect(toCanonicalKey(7, 6)).toBe("6x7");
  });

  it("builds unique facts pool", () => {
    const facts = buildFactsPool();
    const keys = new Set(facts.map((fact) => fact.key));
    expect(facts.length).toBe(keys.size);
    expect(keys.has("2x2")).toBe(true);
    expect(keys.has("10x10")).toBe(true);
  });
});
