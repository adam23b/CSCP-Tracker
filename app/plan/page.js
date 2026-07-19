"use client";
import { useSession } from "../../lib/useSession";
import Auth from "../../components/Auth";
import NavBar from "../../components/NavBar";

export default function PlanPage() {
  const session = useSession();
  if (session === undefined) return <div className="wrap"><p className="empty">Loading…</p></div>;
  if (!session) return <Auth />;

  return (
    <div className="wrap">
      <NavBar active="plan" />
      <div className="card plan-card">
        <div className="eyebrow">Reference</div>
        <h1 style={{ marginTop: 6, marginBottom: 4 }}>CSCP Study Plan</h1>
        <p className="plan-lead">
          The tracker holds live progress and pace math — this page is the
          "why" and "what" behind it. Worth re-reading at the start of each leg.
        </p>

        <h2>The core idea</h2>
        <p>
          ASCM recommends roughly 100 hours of total study for the CSCP exam.
          Time available varies week to week, so instead of a fixed weekly
          quota, the plan runs on two things:
        </p>
        <ul>
          <li><strong>A pace target</strong> — hours remaining ÷ weeks until your exam date, recalculated continuously on the Route page. Some weeks less, some weeks more — it evens out if the trend stays on track.</li>
          <li><strong>Four sequential legs</strong> — not just one pass through all 8 modules. Retention over several months needs a second and third pass.</li>
        </ul>

        <h2>The four legs</h2>

        <h3>Leg 1 — First Pass (~59% of runway)</h3>
        <p>Go through all 8 modules once, in order. For each module:</p>
        <ul>
          <li>Read or watch the material once.</li>
          <li>After each section, close it and write or say out loud what you just learned, from memory, before moving on.</li>
          <li>Build 5–15 flashcards per module as you go — definitions, formulas, anything you had to look up twice. Add them straight into the deck.</li>
          <li>Sketch process flows by hand where relevant — drawing it sticks better than reading about it.</li>
        </ul>

        <h3>Leg 2 — Consolidate & Interleave (~20% of runway)</h3>
        <p>
          The leg most study plans skip, and the one that matters most for a
          multi-month timeline — parts of Module 1 will be forgotten by the
          time Module 5 is done.
        </p>
        <ul>
          <li>Stop moving module-by-module. Mix modules deliberately each session.</li>
          <li>Work ASCM's official practice questions across domains, not one at a time.</li>
          <li>Keep clearing flashcards daily — this is where spacing pays off.</li>
        </ul>

        <h3>Leg 3 — Full Practice Exams (~13% of runway)</h3>
        <ul>
          <li>Timed, 150 questions, 3.5 hours, full conditions.</li>
          <li>After each one, log which domains were missed and revisit that module directly.</li>
          <li>The exam is scenario-based, not recall-based — this leg trains judgment on ambiguous questions.</li>
        </ul>

        <h3>Leg 4 — Taper & Sit (~8% of runway)</h3>
        <ul>
          <li>Light review only. No new material.</li>
          <li>Keep clearing due flashcards, skim the weakest domain once.</li>
          <li>Schedule the exam with a few days of slack at the end — don't sit it the day the plan ends.</li>
        </ul>
        <p>
          The Route page splits your actual runway (today → exam date) into
          these four legs proportionally — move the exam date and the legs
          resize automatically.
        </p>

        <h2>The 8 modules (ASCM CSCP Exam Content Manual v5.0)</h2>
        <table className="plan-table">
          <thead>
            <tr><th>#</th><th>Module</th><th>Notes</th></tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>Supply Chains, Demand Management, and Forecasting</td><td>Quantitative — forecasting methods, error measures</td></tr>
            <tr><td>2</td><td>Global Supply Chain Networks</td><td>Network design, trade, facility location</td></tr>
            <tr><td>3</td><td>Sourcing Products and Services</td><td>Procurement strategy, supplier selection</td></tr>
            <tr><td>4</td><td>Internal Operations and Inventory</td><td>Most quantitative — inventory formulas, capacity</td></tr>
            <tr><td>5</td><td>Forward and Reverse Logistics</td><td>Transportation modes, warehousing, returns</td></tr>
            <tr><td>6</td><td>Supply Chain Relationships</td><td>Lighter module — collaboration, contracts</td></tr>
            <tr><td>7</td><td>Supply Chain Risk</td><td>Risk identification, mitigation, resilience</td></tr>
            <tr><td>8</td><td>Optimization, Sustainability, and Technology</td><td>Digital supply chain, sustainability, emerging tech</td></tr>
          </tbody>
        </table>
        <p>Modules 1 and 4 carry the most calculation-heavy content — budget slightly more time for them in Leg 1 than for lighter modules like 6 and 7.</p>

        <h2>Retention techniques, and why they're here</h2>
        <ul>
          <li><strong>Active recall</strong> — answering from memory beats rereading, even though it feels harder. Used throughout Leg 1.</li>
          <li><strong>Spaced repetition</strong> — the flashcard deck schedules reviews further apart each time a card's answered right, countering forgetting over a multi-month timeline.</li>
          <li><strong>Interleaving</strong> — mixing modules instead of blocking them (Leg 2) trains telling similar concepts apart, exactly what scenario questions test.</li>
          <li><strong>Elaboration / dual coding</strong> — restating ideas in your own words and sketching flows engages memory differently than reading text alone.</li>
          <li><strong>Practice testing under real conditions</strong> — Leg 3 exists because knowing material and applying it under exam pressure are different skills.</li>
        </ul>

        <h2>Using this alongside the tracker</h2>
        <ul>
          <li>Log every session, even 15 minutes — the pace number stays accurate only if hours are logged consistently.</li>
          <li>Clear the flashcard queue daily if possible — designed to take a few minutes, not a full session.</li>
          <li>Use the Notes page for anything a flashcard can't hold — worked examples, process-flow sketches, longer explanations.</li>
        </ul>
      </div>
    </div>
  );
}
