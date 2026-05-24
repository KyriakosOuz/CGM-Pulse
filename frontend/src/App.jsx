/**
 * App.jsx — Root component. Handles routing, layout shell, and global panel state.
 * Sidebar + Header + MobileBottomNav persist across all routes.
 * AIReportPanel and ChatPanel overlay everything as needed.
 */
import { useState } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Sidebar from "./components/Layout/Sidebar";
import Header from "./components/Layout/Header";
import MobileBottomNav from "./components/Layout/MobileBottomNav";
import AIReportPanel from "./components/Panels/AIReportPanel";
import ChatPanel from "./components/Panels/ChatPanel";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Campaigns from "./pages/Campaigns";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import DocsPage from "./pages/DocsPage";
import Logo from "./components/Shared/Logo";
import BackendStatusBanner from "./components/Shared/BackendStatusBanner";
import OfflineTooltip from "./components/Shared/OfflineTooltip";
import { useCampaigns } from "./hooks/useCampaigns";
import { useReport } from "./hooks/useReport";
import { useChat } from "./hooks/useChat";

export default function App() {
  const [activePanel, setActivePanel] = useState(null); // 'report' | 'chat' | null
  const campaignsHook = useCampaigns();
  const report = useReport();
  const chat = useChat();

  const handleOpenReport = () => {
    setActivePanel("report");
    if (!report.hasReport) report.generate();
  };

  const handleOpenChat = (prefill = "") => {
    setActivePanel("chat");
    if (prefill) chat.prefill(prefill);
  };

  return (
    <BrowserRouter>
      <div className="dark min-h-screen bg-background text-on-surface">

        <BackendStatusBanner />

        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar
            onOpenChat={() => handleOpenChat()}
            onOpenReport={handleOpenReport}
          />
        </div>

        {/* Desktop header */}
        <div className="hidden lg:block">
          <Header
            data={campaignsHook.data}
            onGenerateReport={handleOpenReport}
            onRefresh={campaignsHook.refresh}
            campaigns={campaignsHook.data?.campaigns || []}
          />
        </div>

        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-30 bg-background border-b border-white/5 px-4 py-3 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <Logo size="md" />
          </Link>
          <div className="flex gap-2">
            <OfflineTooltip message="Backend paused — AI report unavailable.">
              <button
                onClick={handleOpenReport}
                className="w-9 h-9 flex items-center justify-center text-primary"
                title="AI Report"
              >
                <span className="material-symbols-outlined">auto_awesome</span>
              </button>
            </OfflineTooltip>
            <OfflineTooltip message="Backend paused — chat unavailable.">
              <button
                onClick={() => handleOpenChat()}
                className="w-9 h-9 flex items-center justify-center text-primary"
                title="Chat"
              >
                <span className="material-symbols-outlined">chat_bubble_outline</span>
              </button>
            </OfflineTooltip>
          </div>
        </div>

        {/* Routed page content */}
        <main className={`lg:pl-24 lg:pr-8 px-4 pt-4 pb-28 lg:pb-12 transition-all duration-300
          ${activePanel ? "lg:pr-[400px]" : ""}`}>
          <Routes>
            <Route path="/" element={<Dashboard campaignsHook={campaignsHook} onOpenReport={handleOpenReport} onOpenChat={handleOpenChat} />} />
            <Route path="/analytics" element={<Analytics campaignsHook={campaignsHook} />} />
            <Route path="/campaigns" element={<Campaigns campaignsHook={campaignsHook} onOpenChat={handleOpenChat} />} />
            <Route path="/settings" element={<Settings onRefresh={campaignsHook.refresh} />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        {/* Mobile bottom nav */}
        <div className="lg:hidden">
          <MobileBottomNav
            onOpenChat={() => handleOpenChat()}
            onOpenReport={handleOpenReport}
          />
        </div>

        {/* Panels */}
        <AIReportPanel
          isOpen={activePanel === "report"}
          onClose={() => setActivePanel(null)}
          report={report}
        />
        <ChatPanel
          isOpen={activePanel === "chat"}
          onClose={() => setActivePanel(null)}
          chat={chat}
        />
      </div>
    </BrowserRouter>
  );
}
