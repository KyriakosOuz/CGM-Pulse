/**
 * CampaignCard — Mobile campaign card with mini KPI grid.
 * Clicking navigates to the Campaigns tab with that campaign expanded.
 *
 * Props:
 *   campaign: campaign object from API
 */
import { useNavigate } from "react-router-dom";
import StatusBadge from "../Shared/StatusBadge";

export default function CampaignCard({ campaign }) {
  const navigate = useNavigate();

  const kpis = [
    { label: "CPC", value: `$${Number(campaign.cpc).toFixed(2)}`, status: campaign.kpi_status?.cpc },
    { label: "CTR", value: `${Number(campaign.ctr).toFixed(2)}%`, status: campaign.kpi_status?.ctr },
    { label: "CPL", value: `$${Number(campaign.cpl).toFixed(2)}`, status: campaign.kpi_status?.cpl },
    { label: "CONV", value: `${Number(campaign.conv_rate).toFixed(2)}%`, status: campaign.kpi_status?.conv_rate },
  ];

  return (
    <div
      className="bg-surface-container rounded-xl p-4 space-y-4 cursor-pointer active:bg-surface-container-high transition-colors"
      onClick={() => navigate(`/campaigns?expand=${encodeURIComponent(campaign.name)}`)}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-0.5">
          <h3 className="font-bold text-sm">{campaign.name}</h3>
          <StatusBadge status={campaign.status} />
        </div>
        <span className="material-symbols-outlined text-on-surface-variant/40">chevron_right</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {kpis.map(({ label, value, status }) => (
          <div key={label} className="space-y-1">
            <p className="text-[9px] font-semibold text-on-surface-variant/60 uppercase">{label}</p>
            <p className={`text-xs font-bold ${status === "good" ? "text-tertiary" : "text-error"}`}>
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
