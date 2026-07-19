export const MODULES = [
  { id: 1, title: "Supply Chains, Demand Mgmt & Forecasting" },
  { id: 2, title: "Global Supply Chain Networks" },
  { id: 3, title: "Sourcing Products and Services" },
  { id: 4, title: "Internal Operations and Inventory" },
  { id: 5, title: "Forward and Reverse Logistics" },
  { id: 6, title: "Supply Chain Relationships" },
  { id: 7, title: "Supply Chain Risk" },
  { id: 8, title: "Optimization, Sustainability & Technology" },
];

// Proportional split of whatever runway remains between start date and exam date
export const PHASE_RATIOS = [
  { name: "Leg 1 — First Pass", ratio: 0.59, desc: "Read each module once. Build flashcards as you go." },
  { name: "Leg 2 — Consolidate & Interleave", ratio: 0.20, desc: "Spaced-repetition review across all modules + mixed domain practice questions." },
  { name: "Leg 3 — Full Practice Exams", ratio: 0.13, desc: "Timed 150-question mocks. Track weak domains, remediate directly." },
  { name: "Leg 4 — Taper & Sit", ratio: 0.08, desc: "Light review only, no new material. Sit the exam." },
];

export const STEP_DAYS = [1, 3, 7, 14, 30, 60, 120];

export function dayStr(d) {
  return d.toISOString().slice(0, 10);
}

export function phaseBoundaries(startDate, examDate) {
  const start = new Date(startDate);
  const exam = new Date(examDate);
  const totalWeeks = Math.max((exam - start) / (7 * 24 * 3600 * 1000), 1);
  let acc = 0;
  return PHASE_RATIOS.map((p) => {
    acc += p.ratio * totalWeeks;
    return { ...p, weeksEnd: acc, weeks: p.ratio * totalWeeks };
  });
}

export function currentPhaseIndex(startDate, examDate) {
  const start = new Date(startDate);
  const weeksElapsed = (new Date() - start) / (7 * 24 * 3600 * 1000);
  const bounds = phaseBoundaries(startDate, examDate);
  for (let i = 0; i < bounds.length; i++) {
    if (weeksElapsed < bounds[i].weeksEnd) return i;
  }
  return bounds.length - 1;
}
