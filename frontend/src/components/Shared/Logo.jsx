/**
 * Logo — CGM Pulse inline logo with pulse SVG icon + wordmark.
 *
 * Props:
 *   size?: "sm" | "md" | "lg" — controls icon and text size
 */
export default function Logo({ size = "md" }) {
  const iconSize = size === "sm" ? 18 : size === "lg" ? 28 : 24;
  const textClass = size === "sm" ? "text-sm" : size === "lg" ? "text-xl" : "text-lg";

  return (
    <div className="flex items-center gap-2">
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <polyline
          points="2,12 5,12 7,6 9,18 11,4 13,18 15,10 17,12 22,12"
          stroke="url(#pulse)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="pulse" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#A78BFA" />
          </linearGradient>
        </defs>
      </svg>
      <span className={`font-headline font-bold text-white ${textClass} leading-none`}>
        CGM<span className="text-primary">Pulse</span>
      </span>
    </div>
  );
}
