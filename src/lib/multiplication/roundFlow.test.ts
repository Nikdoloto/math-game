import { describe, expect, it } from "vitest";
import { getDisplayedQuestionNumber, isLastAnsweredQuestion } from "./roundFlow";

describe("round flow helpers", () => {
  it("shows current question index while answering", () => {
    expect(getDisplayedQuestionNumber(0, 12, "idle")).toBe(1);
    expect(getDisplayedQuestionNumber(5, 12, "idle")).toBe(6);
  });

  it("keeps question number stable during feedback", () => {
    expect(getDisplayedQuestionNumber(6, 12, "correct")).toBe(6);
    expect(getDisplayedQuestionNumber(12, 12, "incorrect")).toBe(12);
  });

  it("detects final answered question only in feedback state", () => {
    expect(isLastAnsweredQuestion(12, 12, "correct")).toBe(true);
    expect(isLastAnsweredQuestion(12, 12, "incorrect")).toBe(true);
    expect(isLastAnsweredQuestion(12, 12, "idle")).toBe(false);
    expect(isLastAnsweredQuestion(11, 12, "correct")).toBe(false);
  });
});
