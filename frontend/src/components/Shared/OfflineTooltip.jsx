/**
 * OfflineTooltip — Wraps an interactive child element. When the backend is
 * offline, it: (1) blocks clicks, (2) dims the child, (3) shows a CSS tooltip
 * on hover, and (4) sets a `title` attribute as a fallback. When online,
 * children render unchanged.
 */
import { cloneElement, isValidElement } from "react";
import { useIsOffline } from "../../hooks/useBackendStatus";

const DEFAULT_MESSAGE = "Backend paused — this action is unavailable.";

export default function OfflineTooltip({ children, message = DEFAULT_MESSAGE }) {
  const offline = useIsOffline();

  if (!offline || !isValidElement(children)) return children;

  const blockedChild = cloneElement(children, {
    "aria-disabled": "true",
    "data-offline": "true",
    title: message,
    onClick: (e) => {
      e.preventDefault();
      e.stopPropagation();
    },
    className: `${children.props.className || ""} opacity-50 cursor-not-allowed`.trim(),
  });

  return (
    <span className="relative inline-flex group">
      {blockedChild}
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-9 px-2.5 py-1 rounded-md bg-slate-900 border border-amber-500/40 text-amber-200 text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-[60] shadow-lg">
        {message}
      </span>
    </span>
  );
}
