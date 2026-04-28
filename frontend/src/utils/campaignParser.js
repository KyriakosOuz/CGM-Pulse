export function parseCampaignName(name) {
  if (!name) return null;
  const parts = name.split(" | ").map(p => p.trim());

  return {
    quarter: parts[0] || "",
    product: parts[1] || "",
    region: parts[2] || "",
    consent: parts[3] || "",
    audience: parts[4] || "",
    stage: parts[5] || "",
    type: parts[6] || "",
    format: parts[7] || "",
    full: name,
  };
}

export function formatCampaignShort(name) {
  const p = parseCampaignName(name);
  if (!p) return name;
  return [p.product, p.region, p.type].filter(Boolean).join(" · ");
}

export function CampaignNameDisplay({ name, showFull = false }) {
  const p = parseCampaignName(name);
  if (!p) return <span>{name}</span>;

  return (
    <div className="space-y-0.5" title={name}>
      <p className="text-sm font-medium text-on-surface truncate">
        {p.product} · {p.region}
      </p>
      <div className="flex items-center gap-1 flex-wrap">
        {p.stage && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-outline-variant">
            {p.stage}
          </span>
        )}
        {p.type && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-outline-variant">
            {p.type}
          </span>
        )}
        {p.consent && p.consent !== "Consented" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-error/10 text-error">
            {p.consent}
          </span>
        )}
      </div>
    </div>
  );
}
