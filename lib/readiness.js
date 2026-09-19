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

// Weight of a real quiz/practice score vs flashcard retention when both exist.
// Quiz performance is the more exam-real signal, so it's weighted higher.
export const QUIZ_WEIGHT = 0.6;

export function blendReadiness(flashcardPct, quizPct) {
  if (flashcardPct === null && (quizPct === null || quizPct === undefined)) return null;
  if (quizPct === null || quizPct === undefined) return flashcardPct;
  if (flashcardPct === null) return Math.round(quizPct);
  return Math.round(QUIZ_WEIGHT * quizPct + (1 - QUIZ_WEIGHT) * flashcardPct);
}

export function avgOrNull(nums) {
  const vals = nums.filter((n) => n !== null && n !== undefined);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function readinessLabel(pct) {
  if (pct === null) return { text: "No cards yet", cls: "none" };
  if (pct >= 80) return { text: "Exam-ready", cls: "ready" };
  if (pct >= 60) return { text: "On track", cls: "ontrack" };
  if (pct >= 40) return { text: "Developing", cls: "developing" };
  return { text: "Needs work", cls: "needswork" };
}

// Rank the official functional areas from weakest to strongest by the same
// blended readiness the Readiness page shows, so the user can jump straight
// into practice where they most need it. An area is only ranked once it has
// some signal (flashcards or a saved quiz score) — you can't call an area weak
// when there's nothing to measure. `quizMap` is keyed `${moduleId}::${area}`.
export function weakestAreas(modules, cards, quizMap = {}, today = dayStr(new Date()), limit = 3) {
  const byArea = {};
  (cards || []).forEach((c) => {
    const key = `${c.module_id}::${c.functional_area}`;
    (byArea[key] = byArea[key] || []).push(c);
  });
  const rows = [];
  (modules || []).forEach((m) => {
    (m.areas || []).forEach((area) => {
      const key = `${m.id}::${area}`;
      const areaCards = byArea[key] || [];
      const f = readiness(areaCards, today).pct;
      const q = quizMap[key];
      const quiz = q === undefined ? null : q;
      const combined = blendReadiness(f, quiz);
      if (combined === null) return; // no signal yet
      rows.push({ moduleId: m.id, moduleTitle: m.title, area, pct: combined, cardCount: areaCards.length, quiz });
    });
  });
  // Weakest first; break ties toward areas with more cards (more to review).
  rows.sort((a, b) => a.pct - b.pct || b.cardCount - a.cardCount);
  return limit ? rows.slice(0, limit) : rows;
}
