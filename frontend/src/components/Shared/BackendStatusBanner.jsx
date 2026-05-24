/**
 * BackendStatusBanner — Sticky top banner shown when the backend is unreachable.
 * Disappears automatically once the backend responds successfully again.
 */
import { useIsOffline } from "../../hooks/useBackendStatus";

export default function BackendStatusBanner() {
  const offline = useIsOffline();
  if (!offline) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 w-full bg-amber-500/15 border-b border-amber-500/30 text-amber-200 px-4 py-2 text-[11px] lg:text-xs flex items-center justify-center gap-2 backdrop-blur-md"
    >
      <span className="material-symbols-outlined text-base shrink-0">cloud_off</span>
      <span>
        <strong className="font-semibold">Backend paused.</strong>{" "}
        Live data, AI reports, chat, sync, and alerts are temporarily unavailable.
      </span>
    </div>
  );
}
