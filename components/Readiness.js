"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { MODULES, dayStr } from "../lib/constants";
import { readiness, readinessLabel } from "../lib/readiness";

const UNTAGGED = "Untagged";

function Bar({ pct }) {
  const label = readinessLabel(pct);
  return (
    <div className="rd-bar" title="Target 80%">
      <div className={`rd-bar-fill rd-${label.cls}`} style={{ width: `${pct || 0}%` }} />
      <div className="rd-bar-target" />
    </div>
  );
}

function Ring({ pct }) {
  const label = readinessLabel(pct);
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - (pct || 0) / 100);
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" className={`rd-ring rd-${label.cls}`}>
      <circle cx="70" cy="70" r={r} className="rd-ring-track" />
      <circle
        cx="70"
        cy="70"
        r={r}
        className="rd-ring-fill"
        strokeDasharray={c}
        strokeDashoffset={pct === null ? c : offset}
        transform="rotate(-90 70 70)"
      />
      <text x="70" y="66" textAnchor="middle" className="rd-ring-num">{pct === null ? "—" : `${pct}%`}</text>
      <text x="70" y="88" textAnchor="middle" className="rd-ring-lbl">{label.text}</text>
    </svg>
  );
}

function Row({ kind, name, pct, count, caret, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`rd-row rd-row-${kind}`} onClick={onClick}>
      <div className="rd-row-head">
        {caret !== undefined && <span className="rd-caret">{caret}</span>}
        <span className="rd-name">{name}</span>
        <span className="rd-pct">{pct === null ? "—" : `${pct}%`}</span>
        <span className="rd-count">{count}</span>
      </div>
      <Bar pct={pct} />
    </Tag>
  );
}

export default function Readiness({ session }) {
  const userId = session.user.id;
  const [cards, setCards] = useState(null);
  const [openModules, setOpenModules] = useState({});
  const [openAreas, setOpenAreas] = useState({});
  const today = dayStr(new Date());

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const { data } = await supabase.from("cards").select("*").eq("user_id", userId);
    setCards(data || []);
  }

  const overall = useMemo(() => readiness(cards || [], today), [cards, today]);

  const byModule = useMemo(() => {
    const map = {};
    MODULES.forEach((m) => (map[m.id] = []));
    (cards || []).forEach((c) => {
      if (!map[c.module_id]) map[c.module_id] = [];
      map[c.module_id].push(c);
    });
    return map;
  }, [cards]);

  function areaGroups(moduleId) {
    const cardsIn = byModule[moduleId] || [];
    const official = MODULES.find((m) => m.id === moduleId)?.areas || [];
    const groups = [];
    official.forEach((area) => {
      const inArea = cardsIn.filter((c) => c.functional_area === area);
      if (inArea.length) groups.push({ area, cards: inArea });
    });
    const untagged = cardsIn.filter((c) => !c.functional_area || !official.includes(c.functional_area));
    if (untagged.length) groups.push({ area: UNTAGGED, cards: untagged });
    return groups;
  }

  function topicGroups(cardsIn) {
    const map = {};
    cardsIn.forEach((c) => {
      const t = (c.topic && c.topic.trim()) || UNTAGGED;
      (map[t] = map[t] || []).push(c);
    });
    return Object.entries(map)
      .map(([topic, cs]) => ({ topic, cards: cs }))
      .sort((a, b) => b.cards.length - a.cards.length);
  }

  if (cards === null) {
    return <p className="empty">Loading readiness…</p>;
  }

  if (cards.length === 0) {
    return (
      <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
        <h2>Exam readiness</h2>
        <div className="empty">
          No cards yet. <Link href="/generate" className="today-link">Generate some flashcards</Link> and your
          readiness by module and topic will build here as you review them in the Dock.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card rd-overall">
        <div className="rd-overall-text">
          <div className="eyebrow">Exam readiness</div>
          <h1 style={{ margin: "6px 0 8px" }}>Overall</h1>
          <div className="rd-stats">
            <span><strong>{overall.count}</strong> cards</span>
            <span className="rd-dot">·</span>
            <span><strong>{overall.mastered}</strong> mastered</span>
            <span className="rd-dot">·</span>
            <span><strong>{overall.learning}</strong> learning</span>
            <span className="rd-dot">·</span>
            <span><strong>{overall.fresh}</strong> new</span>
            {overall.overdue > 0 && (
              <>
                <span className="rd-dot">·</span>
                <span className="rd-overdue"><strong>{overall.overdue}</strong> overdue</span>
              </>
            )}
          </div>
          <p className="rd-method">
            Readiness reflects how well-retained your flashcards are (spaced-repetition progress,
            weighted toward high-yield cards; overdue cards count for less). Review due cards in the
            <Link href="/dock" className="today-link"> Dock</Link> to raise it. Target: 80%.
          </p>
        </div>
        <Ring pct={overall.pct} />
      </div>

      <div className="card">
        <h2>By module &amp; topic</h2>
        <div className="rd-list">
          {MODULES.map((m) => {
            const cardsIn = byModule[m.id] || [];
            const r = readiness(cardsIn, today);
            const open = openModules[m.id];
            const hasCards = cardsIn.length > 0;
            return (
              <div className="rd-module" key={m.id}>
                <Row
                  kind="module"
                  caret={hasCards ? (open ? "▾" : "▸") : "·"}
                  name={`M${m.id} — ${m.title.split(",")[0]}`}
                  pct={r.pct}
                  count={cardsIn.length}
                  onClick={hasCards ? () => setOpenModules((o) => ({ ...o, [m.id]: !o[m.id] })) : undefined}
                />

                {open && hasCards && (
                  <div className="rd-areas">
                    {areaGroups(m.id).map(({ area, cards: areaCards }) => {
                      const ar = readiness(areaCards, today);
                      const key = `${m.id}::${area}`;
                      const aopen = openAreas[key];
                      return (
                        <div key={key}>
                          <Row
                            kind="area"
                            caret={aopen ? "▾" : "▸"}
                            name={area}
                            pct={ar.pct}
                            count={areaCards.length}
                            onClick={() => setOpenAreas((o) => ({ ...o, [key]: !o[key] }))}
                          />
                          {aopen && (
                            <div className="rd-topics">
                              {topicGroups(areaCards).map(({ topic, cards: topicCards }) => {
                                const tr = readiness(topicCards, today);
                                return (
                                  <Row key={topic} kind="topic" name={topic} pct={tr.pct} count={topicCards.length} />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
