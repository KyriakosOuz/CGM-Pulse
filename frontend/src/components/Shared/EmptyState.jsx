/**
 * EmptyState — Shown when a list has no items (no results, no data for range, etc.)
 *
 * Props:
 *   icon?: string — Material Symbols icon name (default: "inbox")
 *   title: string — Primary message
 *   message?: string — Secondary explanation
 *   action?: ReactNode — Optional CTA button
 */
export default function EmptyState({ icon = "inbox", title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="material-symbols-outlined text-5xl text-outline-variant mb-4">
        {icon}
      </span>
      <h3 className="font-headline text-base font-semibold text-on-surface mb-2">{title}</h3>
      {message && (
        <p className="text-sm text-on-surface-variant max-w-xs">{message}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
