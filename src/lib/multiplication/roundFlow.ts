import type { FeedbackStateLike } from "./roundFlowTypes";

export function getDisplayedQuestionNumber(
  askedCount: number,
  totalQuestions: number,
  feedback: FeedbackStateLike
): number {
  if (feedback !== "idle") {
    return Math.min(Math.max(askedCount, 1), totalQuestions);
  }

  return Math.min(askedCount + 1, totalQuestions);
}

export function isLastAnsweredQuestion(
  askedCount: number,
  totalQuestions: number,
  feedback: FeedbackStateLike
): boolean {
  return feedback !== "idle" && askedCount >= totalQuestions;
}
