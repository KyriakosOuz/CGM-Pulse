/**
 * Sidebar.jsx — Fixed left navigation for desktop (lg+).
 * Uses NavLink for active route highlighting.
 *
 * Props:
 *   onOpenChat: () => void
 *   onOpenReport: () => void
 */
import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", icon: "dashboard", label: "Dashboard" },
  { to: "/analytics", icon: "analytics", label: "Analytics" },
  { to: "/campaigns", icon: "campaign", label: "Campaigns" },
  { to: "/settings", icon: "settings", label: "Settings" },
  { to: "/docs", icon: "menu_book", label: "Docs" },
];

export default function Sidebar({ onOpenChat, onOpenReport }) {
  return (
    <aside className="fixed left-0 top-0 h-screen w-20 bg-surface-container-low flex flex-col items-center py-6 z-40">
      {/* Logo — icon only in narrow sidebar */}
      <div className="mb-8 flex flex-col items-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polyline points="2,12 5,12 7,6 9,18 11,4 13,18 15,10 17,12 22,12" stroke="url(#pulse-sb)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <defs><linearGradient id="pulse-sb" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#7C3AED" /><stop offset="100%" stopColor="#A78BFA" /></linearGradient></defs>
        </svg>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col items-center gap-2 flex-1">
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `w-14 h-14 flex flex-col items-center justify-center gap-1 rounded-xl transition-colors
              ${isActive
                ? "bg-primary/10 text-primary"
                : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`
            }
            title={label}
          >
            <span className="material-symbols-outlined text-2xl">{icon}</span>
            <span className="text-[9px] tracking-tight font-medium uppercase mt-1 leading-none">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-2 mt-auto">
        <button
          onClick={onOpenReport}
          className="w-14 h-14 flex flex-col items-center justify-center gap-1 rounded-xl text-primary hover:bg-primary/10 transition-colors"
          title="AI Report"
        >
          <span className="material-symbols-outlined text-2xl">auto_awesome</span>
          <span className="text-[9px] tracking-tight font-medium uppercase mt-1 leading-none">Report</span>
        </button>
        <button
          onClick={onOpenChat}
          className="w-14 h-14 flex flex-col items-center justify-center gap-1 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
          title="Chat"
        >
          <span className="material-symbols-outlined text-2xl">chat_bubble_outline</span>
          <span className="text-[9px] tracking-tight font-medium uppercase mt-1 leading-none">Ask AI</span>
        </button>
      </div>
    </aside>
  );
}
