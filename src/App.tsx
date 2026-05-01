import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import type {
  AchievementId,
  FactProgress,
  PlayerProfile,
  Screen,
  SessionResult
} from "./types";
import { buildFactsPool } from "./lib/multiplication/facts";
import {
  buildSessionResult,
  createSessionState,
  evaluateAnswer,
  nextQuestion,
  type SessionState
} from "./lib/multiplication/session";
import { getDisplayedQuestionNumber, isLastAnsweredQuestion } from "./lib/multiplication/roundFlow";
import {
  clearAllLocalData,
  createEmptyGameProgress,
  loadLeaderboard,
  loadProfile,
  saveLeaderboard,
  saveProfile
} from "./lib/storage";
import { buildShareText, shareResult } from "./lib/share";
import { upsertLocalLeaderboard } from "./lib/leaderboard";
import { ACHIEVEMENTS, applySessionRewards, type SessionReward } from "./lib/rewards";

type FeedbackState =
  | { kind: "idle" }
  | { kind: "incorrect"; expected: number };

type SpriteName =
  | "avatar"
  | "cube"
  | "cloud"
  | "landscape"
  | "star"
  | "coin"
  | "chest"
  | "lightning"
  | "trophy"
  | "heart";

const FACTS = buildFactsPool();
const SESSION_QUESTIONS = 12;
const GAME_NAME = "Мастер умножения";
const TARGET_SPEED_MS = 5000;

const SPRITE_SOURCES: Record<SpriteName, string> = {
  avatar: "/assets/pixel/pixel-avatar.png",
  cube: "/assets/pixel/pixel-cube.png",
  cloud: "/assets/pixel/pixel-cloud.png",
  landscape: "/assets/pixel/pixel-landscape.png",
  star: "/assets/pixel/pixel-star.png",
  coin: "/assets/pixel/pixel-coin.png",
  chest: "/assets/pixel/pixel-chest.png",
  lightning: "/assets/pixel/pixel-lightning.png",
  trophy: "/assets/pixel/pixel-trophy.png",
  heart: "/assets/pixel/pixel-heart.png"
};

function todayIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayDiff(aIso: string, bIso: string): number {
  const a = new Date(`${aIso}T00:00:00.000Z`).getTime();
  const b = new Date(`${bIso}T00:00:00.000Z`).getTime();
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function createProfile(nickname: string): PlayerProfile {
  const now = new Date().toISOString();
  return {
    nickname,
    createdAt: now,
    updatedAt: now,
    gameProgress: createEmptyGameProgress()
  };
}

function countByStatus(factMap: Record<string, FactProgress>) {
  let mastered = 0;
  let review = 0;
  let learning = 0;
  let fresh = 0;

  for (const fact of Object.values(factMap)) {
    if (fact.status === "mastered") mastered += 1;
    if (fact.status === "review") review += 1;
    if (fact.status === "learning") learning += 1;
    if (fact.status === "new") fresh += 1;
  }

  return { mastered, review, learning, fresh };
}

function statusClass(status: string): string {
  if (status === "mastered") return "fact-mastered";
  if (status === "review") return "fact-review";
  if (status === "learning") return "fact-learning";
  return "fact-new";
}

function dailyGoalProgress(profile: PlayerProfile): number {
  const today = todayIsoDay(new Date());
  const solvedToday = profile.gameProgress.sessionHistory
    .filter((item) => todayIsoDay(new Date(item.createdAt)) === today)
    .reduce((sum, item) => sum + item.totalQuestions, 0);
  return Math.min(SESSION_QUESTIONS, solvedToday);
}

function sessionStars(summary: SessionResult): 1 | 2 | 3 {
  const ratio = summary.correctAnswers / Math.max(1, summary.totalQuestions);
  if (ratio >= 0.92) return 3;
  if (ratio >= 0.7) return 2;
  return 1;
}

function achievementIcon(id: AchievementId): SpriteName {
  if (id === "star-starter") return "star";
  if (id === "coin-hunter") return "coin";
  if (id === "chest-collector") return "chest";
  if (id === "trophy-master") return "trophy";
  return "heart";
}

function makeHint(a: number, b: number): string {
  if (b > 2) {
    return `Подсказка: ${a} × ${b} = (${a} × ${b - 1}) + ${a}`;
  }
  return `Подсказка: ${a} × ${b} это ${a} + ${a}.`;
}

function Sprite({
  name,
  className,
  size = 64,
  title
}: {
  name: SpriteName;
  className?: string;
  size?: number;
  title?: string;
}) {
  return (
    <img
      className={`sprite ${className ?? ""}`.trim()}
      src={SPRITE_SOURCES[name]}
      width={size}
      height={size}
      alt={title ?? ""}
      aria-hidden={title ? undefined : true}
      title={title}
    />
  );
}

export default function App() {
  const initialProfile = loadProfile();
  const [profile, setProfile] = useState<PlayerProfile | null>(initialProfile);
  const [screen, setScreen] = useState<Screen>(initialProfile ? "home" : "welcome");
  const [nicknameInput, setNicknameInput] = useState("");
  const [settingsNickname, setSettingsNickname] = useState(initialProfile?.nickname ?? "");
  const [session, setSession] = useState<SessionState | null>(null);
  const [sessionFactMap, setSessionFactMap] = useState<Record<string, FactProgress>>(
    initialProfile?.gameProgress.factMap ?? {}
  );
  const [answerInput, setAnswerInput] = useState("");
  const [questionStartMs, setQuestionStartMs] = useState(Date.now());
  const [nowMs, setNowMs] = useState(Date.now());
  const [lastAnswerMs, setLastAnswerMs] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState>({ kind: "idle" });
  const [summary, setSummary] = useState<SessionResult | null>(null);
  const [summaryReward, setSummaryReward] = useState<SessionReward | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const [leaderboard, setLeaderboard] = useState(loadLeaderboard());
  const [hintMessage, setHintMessage] = useState("");
  const [paused, setPaused] = useState(false);
  const answerInputRef = useRef<HTMLInputElement | null>(null);

  const random = Math.random;
  const activeFactMap = session ? sessionFactMap : profile?.gameProgress.factMap ?? {};
  const statusTotals = countByStatus(profile?.gameProgress.factMap ?? {});
  const accuracy = profile?.gameProgress.totalQuestions
    ? Math.round((profile.gameProgress.totalCorrect / profile.gameProgress.totalQuestions) * 100)
    : 0;
  const goalProgress = profile ? dailyGoalProgress(profile) : 0;
  const goalPercent = Math.round((goalProgress / SESSION_QUESTIONS) * 100);
  const currentRank = profile
    ? leaderboard.findIndex((item) => item.nickname.toLowerCase() === profile.nickname.toLowerCase()) + 1
    : 0;

  useEffect(() => {
    if (screen !== "game" || feedback.kind !== "idle" || paused) {
      return undefined;
    }

    const intervalId = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(intervalId);
  }, [feedback.kind, paused, screen]);

  const hardestFacts = useMemo(() => {
    return Object.values(profile?.gameProgress.factMap ?? {})
      .filter((fact) => fact.incorrect > 0)
      .sort((a, b) => b.incorrect - a.incorrect)
      .slice(0, 5);
  }, [profile]);

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0 });
    } catch {
      // jsdom in unit tests does not implement scrolling.
    }
  }, [screen]);

  useEffect(() => {
    if (screen !== "game" || feedback.kind !== "idle" || paused) {
      return undefined;
    }

    const focusId = window.setTimeout(() => {
      answerInputRef.current?.focus();
      answerInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(focusId);
  }, [feedback.kind, paused, screen, session?.askedCount, session?.currentFact?.key]);

  function persistProfile(nextProfile: PlayerProfile | null): void {
    setProfile(nextProfile);
    saveProfile(nextProfile);
  }

  function handleCreateProfile(): void {
    const nickname = nicknameInput.trim();
    if (!nickname) return;

    const created = createProfile(nickname);
    persistProfile(created);
    setSettingsNickname(nickname);
    setScreen("home");
    setNicknameInput("");
  }

  function startGame(): void {
    if (!profile) return;

    const state = createSessionState(SESSION_QUESTIONS, profile.gameProgress.factMap);
    const firstQuestion = nextQuestion(state, FACTS, profile.gameProgress.factMap, random);
    setSession(firstQuestion);
    setSessionFactMap(profile.gameProgress.factMap);
    setAnswerInput("");
    setHintMessage("");
    setFeedback({ kind: "idle" });
    setQuestionStartMs(Date.now());
    setNowMs(Date.now());
    setLastAnswerMs(0);
    setPaused(false);
    setScreen("game");
  }

  function goNextQuestion(): void {
    if (!session) return;
    if (session.askedCount >= session.totalQuestions) return;

    const next = nextQuestion(session, FACTS, sessionFactMap, random);
    setSession(next);
    setAnswerInput("");
    setHintMessage("");
    setFeedback({ kind: "idle" });
    setQuestionStartMs(Date.now());
    setNowMs(Date.now());
  }

  function continueAfterIncorrect(): void {
    if (!session) return;

    if (session.askedCount >= session.totalQuestions) {
      finishSession(session, sessionFactMap);
      return;
    }

    goNextQuestion();
  }

  function finishSession(endedSession: SessionState, finalFactMap: Record<string, FactProgress>): void {
    if (!profile) return;

    const result = buildSessionResult(endedSession, finalFactMap);
    const now = new Date();
    const nowIso = now.toISOString();
    const today = todayIsoDay(now);
    const previousDay = profile.gameProgress.lastSessionAt
      ? todayIsoDay(new Date(profile.gameProgress.lastSessionAt))
      : null;

    const diff = previousDay ? dayDiff(previousDay, today) : null;
    const currentStreak =
      diff === 0
        ? profile.gameProgress.currentStreakDays
        : diff === 1
          ? profile.gameProgress.currentStreakDays + 1
          : 1;
    const bestStreak = Math.max(currentStreak, profile.gameProgress.bestStreakDays);

    const baseNextProgress = {
      ...profile.gameProgress,
      factMap: finalFactMap,
      totalSessions: profile.gameProgress.totalSessions + 1,
      totalQuestions: profile.gameProgress.totalQuestions + result.totalQuestions,
      totalCorrect: profile.gameProgress.totalCorrect + result.correctAnswers,
      lastSessionAt: nowIso,
      currentStreakDays: currentStreak,
      bestStreakDays: bestStreak,
      sessionHistory: [result, ...profile.gameProgress.sessionHistory].slice(0, 20)
    };

    const { nextProgress, reward } = applySessionRewards(
      profile.gameProgress,
      baseNextProgress,
      result
    );

    const nextProfile: PlayerProfile = {
      ...profile,
      updatedAt: nowIso,
      gameProgress: nextProgress
    };

    persistProfile(nextProfile);
    const nextBoard = upsertLocalLeaderboard(leaderboard, nextProfile.nickname, nextProgress);
    setLeaderboard(nextBoard);
    saveLeaderboard(nextBoard);
    setSummary(result);
    setSummaryReward(reward);
    setSession(null);
    setFeedback({ kind: "idle" });
    setHintMessage("");
    setPaused(false);
    setScreen("summary");
  }

  function submitAnswer(): void {
    if (!session || !session.currentFact || feedback.kind !== "idle" || paused) return;
    if (!answerInput.trim()) return;

    const elapsed = Math.max(200, Date.now() - questionStartMs);
    const evaluated = evaluateAnswer(session, sessionFactMap, answerInput, elapsed, random);
    setLastAnswerMs(elapsed);

    if (evaluated.isCorrect) {
      if (evaluated.updatedState.askedCount >= evaluated.updatedState.totalQuestions) {
        finishSession(evaluated.updatedState, evaluated.updatedMap);
        return;
      }

      const next = nextQuestion(evaluated.updatedState, FACTS, evaluated.updatedMap, random);
      setSessionFactMap(evaluated.updatedMap);
      setSession(next);
      setAnswerInput("");
      setHintMessage("");
      setFeedback({ kind: "idle" });
      setQuestionStartMs(Date.now());
      setNowMs(Date.now());
      return;
    }

    setSessionFactMap(evaluated.updatedMap);
    setSession(evaluated.updatedState);
    setFeedback({ kind: "incorrect", expected: evaluated.expected });
  }

  function handleSaveSettings(): void {
    if (!profile) return;
    const nickname = settingsNickname.trim();
    if (!nickname) return;

    const nextProfile: PlayerProfile = {
      ...profile,
      nickname,
      updatedAt: new Date().toISOString()
    };
    persistProfile(nextProfile);

    const nextBoard = upsertLocalLeaderboard(leaderboard, nickname, nextProfile.gameProgress);
    setLeaderboard(nextBoard);
    saveLeaderboard(nextBoard);
    setScreen("home");
  }

  function handleResetProgress(): void {
    if (!profile) return;
    const ok = window.confirm("Сбросить прогресс по умножению для этого профиля?");
    if (!ok) return;

    const nextProfile: PlayerProfile = {
      ...profile,
      updatedAt: new Date().toISOString(),
      gameProgress: createEmptyGameProgress()
    };
    persistProfile(nextProfile);
    const nextBoard = upsertLocalLeaderboard(leaderboard, profile.nickname, nextProfile.gameProgress);
    setLeaderboard(nextBoard);
    saveLeaderboard(nextBoard);
    setScreen("home");
  }

  async function handleShare(): Promise<void> {
    if (!profile || !summary) return;
    const text = buildShareText(profile, summary);
    const result = await shareResult(text);
    if (result === "shared") setShareStatus("Отправлено");
    if (result === "copied") setShareStatus("Текст скопирован");
    if (result === "failed") setShareStatus("Не удалось поделиться");
  }

  function handleHardReset(): void {
    const ok = window.confirm("Очистить данные игры на этом устройстве?");
    if (!ok) return;

    clearAllLocalData();
    setProfile(null);
    setLeaderboard([]);
    setSummary(null);
    setSummaryReward(null);
    setSession(null);
    setSessionFactMap({});
    setHintMessage("");
    setPaused(false);
    setScreen("welcome");
  }

  if (screen === "welcome") {
    return (
      <main className="page welcome-page">
        <section className="panel welcome-panel">
          <span className="section-label">Мастер умножения</span>
          <Sprite name="landscape" className="welcome-scene" />
          <Sprite name="cloud" className="welcome-cloud" />
          <Sprite name="avatar" className="welcome-avatar" size={128} />
          <h1>{GAME_NAME}</h1>
          <p>Тренируй умножение и стань мастером!</p>
          <div className="welcome-chips" aria-hidden="true">
            <span><Sprite name="star" size={28} /> Учись с интересом</span>
            <span><Sprite name="trophy" size={28} /> Становись сильнее</span>
            <span><Sprite name="heart" size={28} /> Легко и весело</span>
          </div>
          <label htmlFor="nickname">Твой никнейм</label>
          <input
            id="nickname"
            value={nicknameInput}
            onChange={(event) => setNicknameInput(event.target.value)}
            maxLength={20}
            placeholder="Например, PixelFox"
          />
          <button onClick={handleCreateProfile}>Начать</button>
        </section>
      </main>
    );
  }

  if (!profile) {
    return null;
  }

  if (screen === "settings") {
    return (
      <main className="page secondary-page">
        <section className="panel">
          <span className="section-label">Профиль</span>
          <h2>Настройки профиля</h2>
          <label htmlFor="settings-nickname">Никнейм</label>
          <input
            id="settings-nickname"
            value={settingsNickname}
            onChange={(event) => setSettingsNickname(event.target.value)}
            maxLength={20}
          />
          <div className="actions two">
            <button onClick={handleSaveSettings}>Сохранить</button>
            <button className="ghost" onClick={() => setScreen("home")}>
              Назад
            </button>
          </div>
          <div className="danger-zone">
            <button className="danger" onClick={handleResetProgress}>
              Сбросить прогресс
            </button>
            <button className="danger ghost" onClick={handleHardReset}>
              Очистить данные игры
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "game" && session) {
    const progressPercent = Math.round((session.askedCount / session.totalQuestions) * 100);
    const displayedTempoMs = feedback.kind === "idle" ? nowMs - questionStartMs : lastAnswerMs;
    const tempoPercent = Math.min(100, Math.round((displayedTempoMs / TARGET_SPEED_MS) * 100));
    const feedbackState = feedback.kind === "idle" ? "idle" : "incorrect";
    const displayedQuestionNumber = getDisplayedQuestionNumber(
      session.askedCount,
      session.totalQuestions,
      feedbackState
    );
    const lastAnswered = isLastAnsweredQuestion(
      session.askedCount,
      session.totalQuestions,
      feedbackState
    );
    const hearts = Math.max(0, 3 - session.incorrectAnswers);

    return (
      <main className="page game-page">
        <section className="panel training-hud">
          <span className="section-label">Экран тренировки</span>
          <div className="hud-row">
            <strong>Вопрос {displayedQuestionNumber} из {session.totalQuestions}</strong>
            <div className="hearts" aria-label="Энергия">
              {Array.from({ length: 3 }).map((_, index) => (
                <Sprite
                  key={index}
                  name="heart"
                  size={30}
                  className={index < hearts ? "" : "disabled"}
                  title={index < hearts ? "Сердце" : "Потерянная энергия"}
                />
              ))}
            </div>
          </div>
          <div className="progress-bar" aria-label="Прогресс тренировки">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="hud-meta">
            <span>Верно: {session.correctAnswers}</span>
            <span>Ошибок: {session.incorrectAnswers}</span>
            <span>Темп: {(displayedTempoMs / 1000).toFixed(1)} сек</span>
          </div>
          <div className="tempo-meter" aria-label="Скорость ответа">
            <span style={{ width: `${tempoPercent}%` }} />
          </div>
        </section>

        <section className="panel question-panel parchment">
          <Sprite name="landscape" className="training-scene" />
          <Sprite name="cube" className="question-cube" size={70} />
          <h2>
            {session.currentFact?.a} × {session.currentFact?.b}
          </h2>
          <input
            ref={answerInputRef}
            inputMode="numeric"
            pattern="[0-9]*"
            value={answerInput}
            onChange={(event) => setAnswerInput(event.target.value.replace(/[^\d]/g, ""))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                submitAnswer();
              }
            }}
            placeholder="Ответ"
            disabled={paused || feedback.kind !== "idle"}
            autoFocus
          />

          {hintMessage && <p className="hint">{hintMessage}</p>}

          {feedback.kind === "idle" ? (
            <div className="actions training-actions">
              <button onClick={submitAnswer} disabled={paused}>
                Подтвердить
              </button>
              <button
                className="ghost"
                onClick={() =>
                  session.currentFact && setHintMessage(makeHint(session.currentFact.a, session.currentFact.b))
                }
                disabled={paused}
              >
                Подсказка
              </button>
              <button className="ghost small" onClick={() => setPaused((value) => !value)}>
                {paused ? "Продолжить" : "Пауза"}
              </button>
              <button className="ghost small" onClick={() => setScreen("home")}>
                Выйти в меню
              </button>
            </div>
          ) : (
            <div className="feedback warn">
              <p>Нормально, тренируем дальше. Верный ответ: {feedback.expected}.</p>
              <button onClick={continueAfterIncorrect}>
                {lastAnswered ? "Показать итоги" : "Продолжить"}
              </button>
            </div>
          )}
        </section>
      </main>
    );
  }

  if (screen === "summary" && summary) {
    const stars = sessionStars(summary);

    return (
      <main className="page summary-page">
        <section className="panel result-panel">
          <span className="section-label">Результат / Прогресс</span>
          <div className="confetti" aria-hidden="true" />
          <Sprite name="avatar" className="result-hero" size={150} />
          <div className="ribbon">Отличная работа!</div>
          <div className="star-row" aria-hidden="true">
            {[1, 2, 3].map((item) => (
              <Sprite
                key={item}
                name="star"
                size={56}
                className={item <= stars ? "" : "disabled"}
              />
            ))}
          </div>
          <div className="summary-stats">
            <p>
              <span>Верных ответов</span> <strong>{summary.correctAnswers} из {summary.totalQuestions}</strong>
            </p>
            <p>
              <span>Фактов на улучшение</span> <strong>{summary.improvedFacts.length}</strong>
            </p>
            <p>
              <span>Новых достижений</span> <strong>{summaryReward?.unlockedAchievements.length ?? 0}</strong>
            </p>
            <p>
              <span>Получено</span> <strong>+{summaryReward?.xpEarned ?? 0} XP и +{summaryReward?.coinsEarned ?? 0} монет</strong>
            </p>
          </div>
          {(summaryReward?.unlockedAchievements.length ?? 0) > 0 && (
            <div className="reward-row">
              {summaryReward?.unlockedAchievements.map((id) => (
                <span key={id} className="reward-chip">
                  <Sprite name={achievementIcon(id)} size={26} />
                  {ACHIEVEMENTS.find((item) => item.id === id)?.title ?? id}
                </span>
              ))}
            </div>
          )}
          <div className="actions">
            <button className="ghost" onClick={() => setScreen("progress")}>
              Мой прогресс
            </button>
            <button className="ghost" onClick={() => setScreen("achievements")}>
              Достижения
            </button>
            <button className="ghost" onClick={() => setScreen("friends")}>
              Друзья
            </button>
            <button onClick={startGame}>Играть ещё раз</button>
            <button className="ghost" onClick={() => setScreen("home")}>
              На главную
            </button>
          </div>
          <button className="ghost small" onClick={handleShare}>
            Поделиться результатом
          </button>
          {shareStatus && <p className="hint">{shareStatus}</p>}
        </section>
      </main>
    );
  }

  if (screen === "progress") {
    return (
      <main className="page secondary-page">
        <section className="panel">
          <span className="section-label">Мой прогресс</span>
          <h2>Мой прогресс</h2>
          <p>
            Точность: <strong>{accuracy}%</strong>, сессий: {profile.gameProgress.totalSessions}, XP:{" "}
            {profile.gameProgress.xp}, уровень: {profile.gameProgress.level}
          </p>
          <div className="legend">
            <span className="fact-mastered">Уверенно</span>
            <span className="fact-review">Почти готово</span>
            <span className="fact-learning">Тренируем</span>
            <span className="fact-new">Новые</span>
          </div>
          <div className="fact-grid">
            {FACTS.map((fact) => {
              const data = activeFactMap[fact.key];
              const status = data?.status ?? "new";
              return (
                <div key={fact.key} className={`fact-item ${statusClass(status)}`}>
                  {fact.key}
                </div>
              );
            })}
          </div>
          <h3>Трудные факты</h3>
          <ul className="simple-list">
            {hardestFacts.length === 0 && <li>Пока пусто. Отличный старт.</li>}
            {hardestFacts.map((fact) => (
              <li key={fact.key}>
                {fact.key}: ошибок {fact.incorrect}, верных {fact.correct}
              </li>
            ))}
          </ul>
          <button className="ghost" onClick={() => setScreen("home")}>
            На главную
          </button>
        </section>
      </main>
    );
  }

  if (screen === "achievements") {
    return (
      <main className="page secondary-page">
        <section className="panel">
          <span className="section-label">Награды</span>
          <h2>Достижения</h2>
          <p>Открыто: {profile.gameProgress.unlockedAchievements.length} / {ACHIEVEMENTS.length}</p>
          <div className="achievements-grid">
            {ACHIEVEMENTS.map((achievement) => {
              const unlocked = profile.gameProgress.unlockedAchievements.includes(achievement.id);
              return (
                <article key={achievement.id} className={`achievement-card ${unlocked ? "unlocked" : "locked"}`}>
                  <Sprite name={achievement.icon} size={48} className={unlocked ? "" : "disabled"} />
                  <h3>{achievement.title}</h3>
                  <p>{achievement.description}</p>
                  <span>{unlocked ? "Открыто" : "Закрыто"}</span>
                </article>
              );
            })}
          </div>
          <button className="ghost" onClick={() => setScreen("home")}>
            На главную
          </button>
        </section>
      </main>
    );
  }

  if (screen === "friends") {
    return (
      <main className="page secondary-page">
        <section className="panel">
          <span className="section-label">Друзья</span>
          <h2>Друзья и рейтинг</h2>
          <p className="hint">Демо-рейтинг на этом устройстве</p>
          <ul className="simple-list">
            {leaderboard.length === 0 && <li>Пока нет записей.</li>}
            {leaderboard.map((entry, idx) => (
              <li key={`${entry.nickname}-${entry.updatedAt}`}>
                {idx + 1}. {entry.nickname} - {entry.score} очков (сессий: {entry.sessions}, прогресс: +
                {entry.progressDelta})
              </li>
            ))}
          </ul>
          <button className="ghost" onClick={() => setScreen("home")}>
            На главную
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page home-page">
      <section className="panel dashboard-shell">
        <span className="section-label">Главная / Дашборд</span>
        <Sprite name="cloud" className="dashboard-cloud one" />
        <Sprite name="cloud" className="dashboard-cloud two" />

        <div className="dashboard-profile">
          <Sprite name="avatar" className="profile-avatar" size={86} />
          <div className="profile-copy">
            <p className="app-brand">{GAME_NAME}</p>
            <h1>Привет, {profile.nickname}</h1>
            <div className="profile-level">
              <span>Уровень {profile.gameProgress.level}</span>
              <div className="xp-track" aria-label="Опыт">
                <span style={{ width: `${Math.min(100, profile.gameProgress.xp % 100)}%` }} />
              </div>
              <strong>{profile.gameProgress.xp} XP</strong>
            </div>
          </div>
          <button className="ghost small" onClick={() => setScreen("settings")}>
            Профиль
          </button>
        </div>

        <div className="dashboard-world">
          <Sprite name="landscape" className="world-bg" />
          <div className="hero-copy">
            <h2>Тренируй умножение и стань мастером!</h2>
          </div>
          <Sprite name="avatar" className="world-hero" size={168} />
          <div className="goal-card">
            <span className="section-label">Сегодняшняя цель</span>
            <div className="goal-head">
              <div>
                <h2>Сегодняшняя цель</h2>
                <p>12 примеров</p>
              </div>
              <Sprite name="chest" size={72} />
            </div>
            <div className="progress-bar">
              <span style={{ width: `${goalPercent}%` }} />
            </div>
            <p>
              Выполнено: {goalProgress} / {SESSION_QUESTIONS}
            </p>
          </div>
        </div>

        <section className="tile-grid">
          <button className="tile-btn" onClick={startGame}>
            <Sprite name="lightning" size={56} />
            <span>Тренировка</span>
          </button>
          <button className="tile-btn" onClick={() => setScreen("progress")}>
            <Sprite name="cube" size={56} />
            <span>Прогресс</span>
          </button>
          <button className="tile-btn" onClick={() => setScreen("achievements")}>
            <Sprite name="trophy" size={56} />
            <span>Достижения</span>
          </button>
          <button className="tile-btn" onClick={() => setScreen("friends")}>
            <Sprite name="coin" size={56} />
            <span>Друзья</span>
          </button>
        </section>

        <section className="metrics-row">
          <article>
            <h3>Серия</h3>
            <p>{profile.gameProgress.currentStreakDays} дн.</p>
          </article>
          <article>
            <h3>Монеты</h3>
            <p>{profile.gameProgress.coins}</p>
          </article>
          <article>
            <h3>Рейтинг</h3>
            <p>{currentRank > 0 ? `#${currentRank}` : "Демо"}</p>
          </article>
          <article>
            <h3>Статусы</h3>
            <p>
              Уверенно: {statusTotals.mastered} | Тренируем: {statusTotals.learning}
            </p>
          </article>
        </section>
      </section>
    </main>
  );
}
