import { STEP_DAYS, dayStr } from "./constants";

// Readiness is derived from flashcard spaced-repetition state:
// - Each card's mastery = how far it has climbed the SRS ladder (step / max step).
// - Overdue cards count for half — their retention has started to lapse.
// - Cards are weighted by exam priority so high-yield material matters more.
// This measures retention of the cards you have; it is not a quiz score.

const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };
const MAX_STEP = STEP_DAYS.length - 1; // 6

export function cardMastery(card, today) {
  const base = Math.min(Math.max(card.step, 0), MAX_STEP) / MAX_STEP; // 0..1
  const overdue = card.due_date < today;
  return overdue ? base * 0.5 : base;
}

export function readiness(cards, today = dayStr(new Date())) {
  if (!cards || cards.length === 0) {
    return { pct: null, count: 0, mastered: 0, learning: 0, fresh: 0, overdue: 0 };
  }
  let wSum = 0;
  let wm = 0;
  let mastered = 0;
  let learning = 0;
  let fresh = 0;
  let overdue = 0;
  for (const c of cards) {
    const w = PRIORITY_WEIGHT[c.exam_priority] || 2;
    wSum += w;
    wm += w * cardMastery(c, today);
    if (c.due_date < today) overdue++;
    if (c.step <= 0) fresh++;
    else if (c.step >= 5) mastered++;
    else learning++;
  }
  return {
    pct: Math.round((wm / wSum) * 100),
    count: cards.length,
    mastered,
    learning,
    fresh,
    overdue,
  };
}

export function readinessLabel(pct) {
  if (pct === null) return { text: "No cards yet", cls: "none" };
  if (pct >= 80) return { text: "Exam-ready", cls: "ready" };
  if (pct >= 60) return { text: "On track", cls: "ontrack" };
  if (pct >= 40) return { text: "Developing", cls: "developing" };
  return { text: "Needs work", cls: "needswork" };
}
