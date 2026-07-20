"use client";
import { useSession } from "../../lib/useSession";
import Auth from "../../components/Auth";
import NavBar from "../../components/NavBar";

export default function HowItWorksPage() {
  const session = useSession();
  if (session === undefined) return <div className="wrap"><p className="empty">Loading…</p></div>;
  if (!session) return <Auth />;

  return (
    <div className="wrap">
      <NavBar active="how" />
      <div className="card plan-card">
        <div className="eyebrow">Reference</div>
        <h1 style={{ marginTop: 6, marginBottom: 4 }}>How the flashcards work</h1>
        <p className="plan-lead">
          The deck runs on spaced repetition — reviews get scheduled right
          before you're about to forget a card, not on a fixed daily cadence.
        </p>

        <h2>The core idea</h2>
        <p>
          Every card has two pieces of state: a <code>step</code> (0–6) and a{" "}
          <code>due_date</code>. The step is an index into a fixed list of
          intervals, in days:
        </p>
        <table className="plan-table">
          <thead><tr><th>Step</th><th>0</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th></tr></thead>
          <tbody><tr><td>Days until next review</td><td>1</td><td>3</td><td>7</td><td>14</td><td>30</td><td>60</td><td>120</td></tr></tbody>
        </table>
        <p>
          Step 0 means "show me again tomorrow." Step 6 means "I know this
          cold — wait 4 months." A card only shows up in "Today at the dock"
          once its due date has arrived.
        </p>

        <h2>What happens when you grade a card</h2>
        <ul>
          <li><strong>Again</strong> — step resets to 0 → due tomorrow. You didn't know it, so it comes right back.</li>
          <li><strong>Good</strong> — step increases by 1 → due at the next interval out (e.g. 7 days → 14 days).</li>
          <li><strong>Easy</strong> — step increases by 2 → skips an interval ahead, since it clearly needs less repetition.</li>
        </ul>
        <p>
          A card you consistently get right walks through 1 → 3 → 7 → 14 → 30
          → 60 → 120 days between reviews — spacing out right before the
          forgetting curve would otherwise claim it, rather than reviewing on
          a fixed schedule regardless of how well you know it.
        </p>

        <h2>Why this matters for a year-long plan</h2>
        <p>
          New cards always start at step 0, so anything added during Leg 1
          gets tested the very next day while it's fresh — catching whether
          it was actually encoded correctly, not just recognized while
          writing it down. As cards mature, they fall further apart, which is
          what keeps the daily review queue small even as the deck grows into
          the hundreds of cards by Leg 2.
        </p>

        <h2>Where this is simplified</h2>
        <p>
          This is a lighter version of a real spaced-repetition algorithm.
          Tools like Anki or SuperMemo track a per-card "ease factor" that
          adjusts each card's growth rate individually — a card that's
          historically easy for you grows faster than a stubborn one, rather
          than every card following the same fixed sequence of steps. That's
          a reasonable trade-off for a personal tool, and a concrete place to
          extend the logic later if the fixed steps ever feel too slow or too
          fast for how you actually recall things.
        </p>
      </div>
    </div>
  );
}
