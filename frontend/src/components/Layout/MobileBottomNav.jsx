/**
 * MobileBottomNav.jsx — Fixed bottom navigation for mobile (< lg).
 * Uses NavLink for active tab highlighting.
 *
 * Props:
 *   onOpenChat: () => void
 *   onOpenReport: () => void
 */
import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/", icon: "dashboard", label: "Dashboard" },
  { to: "/analytics", icon: "analytics", label: "Analytics" },
  { to: "/campaigns", icon: "campaign", label: "Campaigns" },
  { to: "/settings", icon: "settings", label: "Settings" },
  { to: "/docs", icon: "menu_book", label: "Docs" },
];

export default function MobileBottomNav({ onOpenChat, onOpenReport }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-surface-container-low/95 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-4 z-40">
      {TABS.map(({ to, icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-colors
            ${isActive
              ? "text-primary"
              : "text-on-surface-variant"
            }`
          }
        >
          <span className="material-symbols-outlined text-2xl">{icon}</span>
          <span className="text-[10px] font-semibold">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
