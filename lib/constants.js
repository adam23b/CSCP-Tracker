// Account owner / admin. Only this user can share decks and see Settings.
// Keep in sync with the admin_email in supabase/schema_v5.sql.
export const ADMIN_EMAIL = "adam23b@gmail.com";

// The per-module reference note that "Ask Claude → Add to Required Reading"
// appends to. It's module-level (spans sessions), so it's excluded from the
// session organizer and pinned to the top of its module group.
export const REQUIRED_READING_TITLE = "Required Reading";
export const isReferenceNote = (n) => !!n && n.module_id && n.title === REQUIRED_READING_TITLE;

// `areas` are the official CSCP study-guide functional areas within each module.
// `sessions` maps each area to its ordered list of individual course sessions.
// Both are in official course order; this is the single source of truth for
// ordering notes (and anything else) to match the course.
export const MODULES = [
  {
    id: 1,
    title: "Supply Chains, Demand Mgmt & Forecasting",
    areas: [
      "Introduction to Supply Chains",
      "Demand Analysis and Patterns",
      "Demand Management",
      "Forecasting",
      "Supply and Demand Alignment",
    ],
    sessions: {
      "Introduction to Supply Chains": ["Supply Chain Models", "Supply Chain Maturity and Complexity"],
      "Demand Analysis and Patterns": ["Demand Analysis", "Demand Patterns"],
      "Demand Management": ["Demand Management", "Influencing Demand"],
      "Forecasting": ["Forecasting Principles and Process", "Forecasting Methods", "Measures of Forecast Error"],
      "Supply and Demand Alignment": ["Supply and Demand Alignment", "Sales and Operations Planning"],
    },
  },
  {
    id: 2,
    title: "Global Supply Chain Networks",
    areas: [
      "Supply Chain Design and Optimization",
      "End-to-End Connectivity and Visibility",
      "Supply Chain Metrics and Reports",
    ],
    sessions: {
      "Supply Chain Design and Optimization": ["Supply Chain Design and Management", "Business and IT Requirements", "Technology Analysis and Optimization"],
      "End-to-End Connectivity and Visibility": ["Supply Chain Technology Applications", "Connectivity, Visibility/Sharing, and Legal", "Supply Chain Master Data"],
      "Supply Chain Metrics and Reports": ["Supply Chain Metrics, Reports, and SCOR DS", "Financial and Operational Metrics and Reports"],
    },
  },
  {
    id: 3,
    title: "Sourcing Products and Services",
    areas: [
      "Aligning Sourcing to Demand",
      "Category Strategy for Sourcing",
      "Product Design Influence",
      "Supplier Selection, Contracting, and Use",
    ],
    sessions: {
      "Aligning Sourcing to Demand": ["Make-Versus-Buy, Outsourcing, and Offshoring", "Sourcing Requirements and Total Costs"],
      "Category Strategy for Sourcing": ["Supply Plans, Categories, and Segmentation", "Supply Base Analysis and Right-Sizing"],
      "Product Design Influence": ["Product Design", "Quality, Customization, and Sustainability"],
      "Supplier Selection, Contracting, and Use": ["Supplier Evaluation and Selection", "Contracts", "Purchase Orders"],
    },
  },
  {
    id: 4,
    title: "Internal Operations and Inventory",
    areas: [
      "Planning Operations",
      "Capacity and Production Activity Control",
      "Inventory",
      "Performance and Continuous Improvement",
    ],
    sessions: {
      "Planning Operations": ["Planning Operations", "Materials and Inventory"],
      "Capacity and Production Activity Control": ["Capacity", "Production Activity Control"],
      "Inventory": ["Inventory", "Replenishment Strategies", "Traceability, Accuracy, and Disposition"],
      "Performance and Continuous Improvement": ["Operations, Inventory, and Financial Performance", "Continuous Improvement", "Quality Tools", "Continuous Improvement Methods"],
    },
  },
  {
    id: 5,
    title: "Forward and Reverse Logistics",
    areas: [
      "Logistics and Distribution",
      "Distribution Services and Transportation Choices",
      "Trade Considerations",
      "Reverse Flow",
    ],
    sessions: {
      "Logistics and Distribution": ["Logistics", "Warehousing and Materials-Handling Strategy", "Transportation Strategy"],
      "Distribution Services and Transportation Choices": ["Distribution Services and Delivery Patterns", "Transportation Mode and Carrier Selection"],
      "Trade Considerations": ["Legal, Security, and Regulatory Requirements", "Import/Export Regulations and Documentation", "Trade Zones and Blocs"],
      "Reverse Flow": ["Reverse Logistics", "Waste"],
    },
  },
  {
    id: 6,
    title: "Supply Chain Relationships",
    areas: [
      "Customer Relationships",
      "Supplier and Supply Chain Relationships",
    ],
    sessions: {
      "Customer Relationships": ["Customer Relationships and Segmentation", "Customer Relationship Management", "Customer Service Metrics and Performance"],
      "Supplier and Supply Chain Relationships": ["Supplier Relationships and Segmentation", "Strategic Sourcing and Alliances", "Supplier Performance", "Supply Chain Relationship Management"],
    },
  },
  {
    id: 7,
    title: "Supply Chain Risk",
    areas: [
      "Risk Management and Supply Chain Risks",
      "Risk Analysis and Response",
    ],
    sessions: {
      "Risk Management and Supply Chain Risks": ["Risk Management", "Risk Identification and Supply Chain Risks"],
      "Risk Analysis and Response": ["Risk Analysis", "Risk Responses, Action Plans, and Business Continuity"],
    },
  },
  {
    id: 8,
    title: "Optimization, Sustainability & Technology",
    areas: [
      "Optimizing Supply Chain Strategy and Tactics",
      "Sustainability",
      "Technology Trends",
    ],
    sessions: {
      "Optimizing Supply Chain Strategy and Tactics": ["Business and Supply Chain Strategy", "Supply Chain Strategic Value and Optimization"],
      "Sustainability": ["Sustainable Supply Chains", "Sustainability Guidelines and Standards"],
      "Technology Trends": ["Emerging Technology Trends", "Technology Assessment and Implementation"],
    },
  },
];

// Sessions for a module + area, in course order (empty array if unknown).
export function sessionsFor(moduleId, area) {
  return MODULES.find((m) => m.id === moduleId)?.sessions?.[area] || [];
}

// A sortable key that places a note in official course order:
// [moduleOrder, areaOrder, sessionOrder]. Unknown pieces sort last within their level.
export function courseSortKey(moduleId, area, sessionName) {
  const mIdx = MODULES.findIndex((m) => m.id === moduleId);
  const mod = mIdx >= 0 ? MODULES[mIdx] : null;
  const aIdx = mod ? mod.areas.indexOf(area) : -1;
  const sList = mod && area ? mod.sessions?.[area] || [] : [];
  const sIdx = sessionName ? sList.indexOf(sessionName) : -1;
  return [
    mIdx < 0 ? 999 : mIdx,
    aIdx < 0 ? 999 : aIdx,
    sIdx < 0 ? 999 : sIdx,
  ];
}

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
