"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// The thin bar across the top of every page, shared in look and order with the
// Notes app and Tracker. Links follow the domain family the page was opened on
// (clashapp.online, or tuckertracker.com for networks that block .online).
// The family is read from the browser's address after load (every page here is
// prerendered, so the server cannot know the host); until then the primary
// family's links render, which also keeps server and client markup identical.
// Hidden in the full-screen Dock. Keep in step with lib/apps.ts in the Notes repo.
const HOSTS = {
  clashapp: { notes: "https://www.clashapp.online", tracker: "https://tracker.clashapp.online", sso: true },
  tuckertracker: { notes: "https://notes.tuckertracker.com", tracker: "https://tracker.tuckertracker.com", sso: false },
};

export function familyOf(host) {
  const name = (host || "").split(":")[0].toLowerCase();
  return name === "tuckertracker.com" || name.endsWith(".tuckertracker.com") ? "tuckertracker" : "clashapp";
}

export default function AppSwitcher() {
  const pathname = usePathname() || "/";
  const [family, setFamily] = useState("clashapp");
  useEffect(() => {
    setFamily(familyOf(window.location.hostname));
  }, []);
  if (pathname.startsWith("/dock")) return null;

  const { notes, tracker, sso } = HOSTS[family] || HOSTS.clashapp;
  const apps = [
    { key: "home", label: "Home", href: `${notes}/` },
    { key: "notes", label: "Notes", href: `${notes}/notes` },
    { key: "tasks", label: "Tasks", href: `${notes}/tasks` },
    { key: "projects", label: "Projects", href: `${notes}/projects` },
    { key: "opportunities", label: "Job search", href: `${notes}/opportunities` },
    { key: "boards", label: "Boards", href: `${notes}/boards` },
    { key: "calendar", label: "Calendar", href: `${notes}/calendar` },
    { key: "meetings", label: "Meetings", href: `${notes}/meetings` },
    { key: "ask", label: "Ask", href: `${notes}/ask` },
    { key: "tracker", label: "Tracker", href: sso ? `${tracker}/login?sso=1&next=%2F` : `${tracker}/` },
    { key: "cscp", label: "CSCP", href: "/", here: true },
  ];

  return (
    <nav className="appbar" aria-label="Apps">
      <div className="appbar-links">
        {apps.map((a) =>
          a.here ? (
            <Link key={a.key} href={a.href} aria-current="page">{a.label}</Link>
          ) : (
            <a key={a.key} href={a.href}>{a.label}</a>
          )
        )}
      </div>
    </nav>
  );
}
