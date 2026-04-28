/**
 * StatusBadge — Displays campaign status (Active/Paused).
 *
 * Props:
 *   status: "Active" | "Paused"
 */
export default function StatusBadge({ status }) {
  const isActive = status === "Active";
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter
      ${isActive
        ? "bg-tertiary/10 text-tertiary"
        : "bg-outline-variant/20 text-on-surface-variant"
      }`}>
      {status}
    </span>
  );
}
