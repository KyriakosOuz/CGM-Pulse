/**
 * AIReportPanel — Slide-in panel showing AI-generated performance report.
 * Streams content from POST /api/report with styled section rendering.
 *
 * Props:
 *   isOpen: boolean
 *   onClose: () => void
 *   report: { reportText, isLoading, generatedAt, generate, restoreLastReport, hasReport }
 */
import { useState, useEffect } from "react";
import OfflineTooltip from "../Shared/OfflineTooltip";

function renderReport(text) {
  if (!text) return "";

  let result = text;

  // ── 1. Text-level formatting FIRST (before any HTML injection) ──

  // Bold campaign names (quoted strings) — must run before HTML with class="..." is injected
  result = result.replace(
    /"([^"]+)"/g,
    '\u201c<b class="text-on-surface font-semibold">$1</b>\u201d'
  );

  // Highlight dollar amounts
  result = result.replace(
    /\$[\d,]+\.?\d*/g,
    '<span class="text-tertiary font-mono font-medium">$&</span>'
  );

  // Highlight percentages
  result = result.replace(
    /\d+\.?\d*%/g,
    '<span class="font-mono">$&</span>'
  );

  // ── 2. Structural HTML (section headers, bullets, line breaks) ──

  const sections = {
    "HEALTH SUMMARY": { icon: "monitor_heart", color: "text-primary" },
    "TOP PERFORMERS": { icon: "trending_up", color: "text-tertiary" },
    "UNDERPERFORMING": { icon: "warning", color: "text-amber-400" },
    "RECOMMENDATIONS": { icon: "lightbulb", color: "text-primary" },
  };

  Object.entries(sections).forEach(([name, style]) => {
    result = result.replace(
      new RegExp(name, "g"),
      `<div class="flex items-center gap-2 mt-6 mb-2 first:mt-0">` +
        `<span class="material-symbols-outlined text-sm ${style.color}">${style.icon}</span>` +
        `<span class="text-[10px] font-bold uppercase tracking-widest ${style.color}">${name}</span>` +
        `</div>`
    );
  });

  // Bullet recommendations (• or - at start of line)
  result = result.replace(
    /^[•·\-]\s+(.+)$/gm,
    '<div class="flex gap-3 items-start p-3 rounded-lg bg-surface-container-high border border-outline-variant/10 mb-2">' +
      '<span class="material-symbols-outlined text-primary text-sm shrink-0 mt-0.5">arrow_forward</span>' +
      '<span class="text-sm text-on-surface-variant leading-relaxed">$1</span></div>'
  );

  // Paragraphs + line breaks
  result = result.replace(/\n\n/g, '<div class="h-2"></div>');
  result = result.replace(/\n/g, "<br/>");

  return result;
}

export default function AIReportPanel({ isOpen, onClose, report }) {
  const { reportText, isLoading, generatedAt, generate, restoreLastReport, hasReport } = report;
  const [phase, setPhase] = useState("");

  // Restore last report when panel reopens
  useEffect(() => {
    if (isOpen) restoreLastReport();
  }, [isOpen]);

  // Progress phases while loading
  useEffect(() => {
    if (!isLoading) {
      setPhase("");
      return;
    }
    setPhase("Analyzing campaigns...");
    const t1 = setTimeout(() => setPhase("Identifying top performers..."), 1500);
    const t2 = setTimeout(() => setPhase("Generating recommendations..."), 3000);
    const t3 = setTimeout(() => setPhase(""), 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [isLoading]);

  function handleExportPDF() {
    const content = document.getElementById("ai-report-content");
    if (!content) return;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>CGM Pulse — AI Report</title>
        <style>
          body { font-family: Inter, sans-serif; padding: 40px; color: #1a1a1a; max-width: 800px; margin: 0 auto; }
          h1 { font-size: 24px; margin-bottom: 8px; }
          p { line-height: 1.6; margin-bottom: 12px; }
          .header { border-bottom: 2px solid #eee; padding-bottom: 16px; margin-bottom: 24px; }
          .meta { font-size: 12px; color: #888; margin-top: 4px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>CGM Pulse — AI Report</h1>
          <p class="meta">Generated: ${new Date().toLocaleString()}</p>
        </div>
        ${content.innerText
          .split("\n")
          .filter(l => l.trim())
          .map(l => `<p>${l}</p>`)
          .join("")}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside className={`fixed right-0 top-0 h-full w-full lg:w-[380px] z-50
        bg-slate-900/70 backdrop-blur-xl border-l border-white/10
        flex flex-col shadow-2xl transition-transform duration-300
        ${isOpen ? "translate-x-0" : "translate-x-full"}`}>

        {/* Gradient accent bar */}
        <div className="h-0.5 w-full bg-gradient-to-r from-primary via-primary-container to-transparent" />

        <header className="p-6 border-b border-white/10 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">auto_awesome</span>
            </div>
            <div>
              <h2 className="font-headline font-bold text-lg text-white">AI Report</h2>
              <p className="text-[10px] text-outline-variant font-medium">
                {isLoading ? "Generating..." : "Powered by Claude"}
              </p>
              {generatedAt && !isLoading && (
                <p className="text-[10px] text-outline-variant">
                  Last generated: {generatedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-outline-variant"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        {/* Loading phase indicator */}
        {phase && (
          <div className="px-4 py-2 border-b border-outline-variant/10">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[11px] text-outline-variant italic">{phase}</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {reportText ? (
            <div
              id="ai-report-content"
              className="p-6 text-sm text-on-surface-variant leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderReport(reportText) }}
            />
          ) : !isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 h-full min-h-[240px]">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">auto_awesome</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-on-surface">No report generated yet</p>
                <p className="text-xs text-outline-variant mt-1">Click the button below to analyze your campaigns</p>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="p-6 border-t border-white/10 space-y-3">
          <OfflineTooltip message="Backend paused — report generation unavailable.">
            <button
              onClick={generate}
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-br from-primary to-primary-container text-on-primary-container font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-opacity"
            >
              <span className="material-symbols-outlined text-sm">
                {isLoading ? "hourglass_empty" : hasReport ? "refresh" : "auto_awesome"}
              </span>
              {isLoading ? "Generating..." : hasReport ? "Regenerate Report" : "Generate AI Report"}
            </button>
          </OfflineTooltip>
          <button
            onClick={handleExportPDF}
            disabled={!reportText}
            className="w-full py-2.5 text-on-surface-variant font-medium hover:text-white hover:bg-white/5 transition-all rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-base">picture_as_pdf</span>
            Export as PDF
          </button>
        </footer>
      </aside>
    </>
  );
}
