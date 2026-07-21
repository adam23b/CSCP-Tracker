"use client";
import Link from "next/link";
import { buildTodayPlan } from "../lib/todayEngine";

const KIND_ICONS = { cards: "⚓", study: "🧭", refresh: "🌊", exam: "⏱", rest: "🌙" };

export default function TodayPlan({ settings, progress, sessions, cards }) {
  const plan = buildTodayPlan({ settings, progress, sessions, cards });

  return (
    <div className="today-card">
      <div className="today-glow" aria-hidden="true" />
      <div className="today-head">
        <div>
          <div className="eyebrow">Orders of the day</div>
          <h2 className="today-headline">{plan.headline}</h2>
          <div className="today-sub">{plan.sub}</div>
        </div>
        {plan.dueCount > 0 && (
          <Link href="/dock" className="dock-cta">
            Start review
            <span className="dock-cta-sub">{plan.dueCount} due</span>
          </Link>
        )}
      </div>
      {plan.items.length > 0 && (
        <ol className="today-list">
          {plan.items.map((item, i) => (
            <li key={i} className="today-item">
              <span className="today-icon">{KIND_ICONS[item.kind] || "•"}</span>
              <span className="today-label">
                {item.href ? <Link href={item.href} className="today-link">{item.label}</Link> : item.label}
              </span>
              <span className="today-min">~{item.minutes} min</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
