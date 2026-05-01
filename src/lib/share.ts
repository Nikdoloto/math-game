import type { PlayerProfile, SessionResult } from "../types";

export function buildShareText(profile: PlayerProfile, summary: SessionResult): string {
  return `${profile.nickname} тренируется в «Мастер умножения»: ${summary.correctAnswers}/${summary.totalQuestions} верных ответов, улучшено фактов: ${summary.improvedFacts.length}. Попробуй тоже: ${window.location.href}`;
}

export async function shareResult(text: string): Promise<"shared" | "copied" | "failed"> {
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Мастер умножения",
        text,
        url: window.location.href
      });
      return "shared";
    } catch {
      // fall back to copy.
    }
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return "copied";
    } catch {
      return "failed";
    }
  }

  return "failed";
}
