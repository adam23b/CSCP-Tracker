"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// The thin bar across the top of every page, shared in look and order with the
// Notes app (www.clashapp.online) and Tracker. Hidden in the full-screen Dock.
const NOTES = "https://www.clashapp.online";

const APPS = [
  { key: "home", label: "Home", href: `${NOTES}/` },
  { key: "notes", label: "Notes", href: `${NOTES}/notes` },
  { key: "tasks", label: "Tasks", href: `${NOTES}/tasks` },
  { key: "projects", label: "Projects", href: `${NOTES}/projects` },
  { key: "opportunities", label: "Job search", href: `${NOTES}/opportunities` },
  { key: "boards", label: "Boards", href: `${NOTES}/boards` },
  { key: "calendar", label: "Calendar", href: `${NOTES}/calendar` },
  { key: "meetings", label: "Meetings", href: `${NOTES}/meetings` },
  { key: "ask", label: "Ask", href: `${NOTES}/ask` },
  { key: "tracker", label: "Tracker", href: "https://tracker.clashapp.online" },
  { key: "cscp", label: "CSCP", href: "/", here: true },
];

export default function AppSwitcher() {
  const pathname = usePathname() || "/";
  if (pathname.startsWith("/dock")) return null;

  return (
    <nav className="appbar" aria-label="Apps">
      <div className="appbar-links">
        {APPS.map((a) =>
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
