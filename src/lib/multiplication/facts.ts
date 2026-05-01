import type { MultiplicationFact } from "../../types";

const MIN_FACTOR = 2;
const MAX_FACTOR = 10;

export function toCanonicalKey(a: number, b: number): string {
  const left = Math.min(a, b);
  const right = Math.max(a, b);
  return `${left}x${right}`;
}

export function buildFactsPool(): MultiplicationFact[] {
  const facts: MultiplicationFact[] = [];

  for (let a = MIN_FACTOR; a <= MAX_FACTOR; a += 1) {
    for (let b = a; b <= MAX_FACTOR; b += 1) {
      facts.push({
        a,
        b,
        key: toCanonicalKey(a, b),
        answer: a * b
      });
    }
  }

  return facts;
}
