/**
 * Settings.jsx — App configuration page (/settings).
 *
 * Props:
 *   onRefresh: () => void — refresh dashboard data
 */
import { useState } from "react";
import PageHeader from "../components/Shared/PageHeader";
import AlertConfig from "../components/Settings/AlertConfig";
import KPITargets from "../components/Settings/KPITargets";
import DataSettings from "../components/Settings/DataSettings";

const DEFAULT_TARGETS = { cpc: "5.00", ctr: "0.65", cpl: "120.00", conv_rate: "1.00" };

export default function Settings({ onRefresh }) {
  const [targets, setTargets] = useState({ ...DEFAULT_TARGETS });

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        title="Settings"
        subtitle="Configure alerts, KPI targets, and data sync"
      />

      <AlertConfig targets={targets} />
      <KPITargets targets={targets} onTargetsChange={setTargets} />
      <DataSettings onRefresh={onRefresh} />

      {/* About */}
      <div className="bg-surface-container rounded-xl p-6">
        <h3 className="font-headline text-base font-bold mb-3">About CGM Pulse</h3>
        <p className="text-sm text-on-surface-variant mb-4">
          CGM Pulse is a LinkedIn Ads KPI monitoring command center built for Compound Growth Marketing.
          It replaces manual Campaign Manager checks with an AI-enhanced dashboard featuring real-time KPI tracking,
          RAG-powered campaign analysis, and automated threshold alerts.
        </p>
        <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-widest text-outline mb-6">
          <span className="bg-surface-container-high px-3 py-1.5 rounded-full">
            Powered by Claude
          </span>
          <span className="bg-surface-container-high px-3 py-1.5 rounded-full">
            Pinecone RAG
          </span>
          <span className="bg-surface-container-high px-3 py-1.5 rounded-full">
            Voyage AI Embeddings
          </span>
        </div>
        <p className="text-[10px] text-outline mt-4">Version 1.0.0</p>
      </div>
    </div>
  );
}
