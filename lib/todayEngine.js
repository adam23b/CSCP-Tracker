import { MODULES, dayStr, phaseBoundaries, currentPhaseIndex } from "./constants";

// Turns raw state into marching orders: what to do today, in order, with times.
// Inputs:
//   settings: { start_date, exam_date, target_hours }
//   progress: { [moduleId]: 'todo' | 'progress' | 'done' }
//   sessions: [{ module_id, minutes, logged_at }]
//   cards:    [{ module_id, due_date, step }]
// Output: { headline, sub, totalMinutes, items: [{ kind, label, minutes, href }] }

const SECONDS_PER_CARD = 30;
const STALE_DAYS = 14;

export function buildTodayPlan({ settings, progress, sessions, cards }) {
  const items = [];
  const today = dayStr(new Date());

  // --- Pace math ---
  const totalHours = sessions.reduce((a, s) => a + s.minutes / 60, 0);
  const remaining = Math.max(settings.target_hours - totalHours, 0);
  const weeksLeft = Math.max(
    (new Date(settings.exam_date) - new Date()) / (7 * 24 * 3600 * 1000),
    0.15
  );
  const perWeekHrs = remaining / weeksLeft;
  // A sensible daily ask: spread the weekly need over ~5 study days, keep it humane.
  const dailyTargetMin = Math.min(Math.max(Math.round((perWeekHrs * 60) / 5 / 5) * 5, 15), 120);

  // --- Cards due ---
  const dueCount = cards.filter((c) => c.due_date <= today).length;
  const cardMinutes = Math.max(Math.ceil((dueCount * SECONDS_PER_CARD) / 60), 1);
  if (dueCount > 0) {
    items.push({
      kind: "cards",
      label: `Clear ${dueCount} due card${dueCount === 1 ? "" : "s"}`,
      minutes: cardMinutes,
      href: "/dock",
    });
  }

  // --- Where are we in the plan? ---
  const legIndex = currentPhaseIndex(settings.start_date, settings.exam_date);
  const legs = phaseBoundaries(settings.start_date, settings.exam_date);

  // --- Module staleness (days since last logged session per module) ---
  const lastTouched = {};
  sessions.forEach((s) => {
    const d = s.logged_at ? s.logged_at.slice(0, 10) : null;
    if (d && (!lastTouched[s.module_id] || d > lastTouched[s.module_id])) {
      lastTouched[s.module_id] = d;
    }
  });
  const staleModules = MODULES.filter((m) => {
    const st = progress[m.id];
    if (st !== "done" && st !== "progress") return false;
    const last = lastTouched[m.id];
    if (!last) return true;
    const days = (new Date(today) - new Date(last)) / (24 * 3600 * 1000);
    return days >= STALE_DAYS;
  }).sort((a, b) => (lastTouched[a.id] || "0000") < (lastTouched[b.id] || "0000") ? -1 : 1);

  // --- Current module: first not done, preferring one already in progress ---
  const inProgress = MODULES.find((m) => progress[m.id] === "progress");
  const nextTodo = MODULES.find((m) => progress[m.id] !== "done");
  const current = inProgress || nextTodo;

  const studyMinutes = Math.max(dailyTargetMin - (dueCount > 0 ? cardMinutes : 0), 10);

  if (legIndex === 0) {
    // Leg 1 — First Pass: push forward on the current module.
    if (current) {
      items.push({
        kind: "study",
        label: `Continue Module ${current.id} — ${current.title.split(",")[0]}`,
        minutes: studyMinutes,
      });
    }
    if (staleModules.length > 0 && staleModules[0].id !== current?.id) {
      items.push({
        kind: "refresh",
        label: `Quick refresh: Module ${staleModules[0].id} — ${staleModules[0].title.split(",")[0]} (untouched ${STALE_DAYS}+ days)`,
        minutes: 5,
      });
    }
  } else if (legIndex === 1) {
    // Leg 2 — Interleave: mix two modules on purpose.
    const a = staleModules[0] || current || MODULES[0];
    const b = staleModules[1] || (current && current.id !== a.id ? current : MODULES.find((m) => m.id !== a.id));
    items.push({
      kind: "study",
      label: `Interleave: practice questions across Module ${a.id} and Module ${b.id}`,
      minutes: studyMinutes,
    });
  } else if (legIndex === 2) {
    // Leg 3 — Practice exams.
    items.push({
      kind: "exam",
      label: "Timed practice block — full exam conditions, then log weak domains as notes",
      minutes: Math.max(studyMinutes, 45),
    });
  } else {
    // Leg 4 — Taper.
    if (staleModules.length > 0) {
      items.push({
        kind: "refresh",
        label: `Light review: Module ${staleModules[0].id} — ${staleModules[0].title.split(",")[0]}`,
        minutes: Math.min(studyMinutes, 20),
      });
    } else {
      items.push({ kind: "rest", label: "Light review only — no new material this close in", minutes: 15 });
    }
  }

  const totalMinutes = items.reduce((a, i) => a + i.minutes, 0);

  // --- Headline ---
  let headline, sub;
  if (items.length === 0) {
    headline = "All clear";
    sub = "Nothing due and nothing scheduled. Log any study you do.";
  } else if (dueCount === 0 && legIndex === 0) {
    headline = `Today · ~${totalMinutes} min`;
    sub = `Leg ${legIndex + 1} of 4 — ${legs[legIndex].name.split("—")[1].trim()}`;
  } else {
    headline = `Today · ~${totalMinutes} min`;
    sub = `Leg ${legIndex + 1} of 4 — ${legs[legIndex].name.split("—")[1].trim()}`;
  }

  return { headline, sub, totalMinutes, items, dueCount, legIndex };
}
