/**
 * ChatPanel — Slide-in RAG chat panel with markdown rendering.
 *
 * Props:
 *   isOpen: boolean
 *   onClose: () => void
 *   chat: { messages, isLoading, sendMessage, pendingPrefill, clearPrefill } — from useChat hook
 */
import { useRef, useEffect, useState } from "react";

const SUGGESTION_POOL = [
  "Which APJ campaigns are hitting all targets?",
  "Compare prod_05 vs prod_17a performance",
  "What's the best CPL campaign in February?",
  "Which consented audiences outperform?",
  "Show me campaigns with CTR above 1%",
  "Why is AMS+EMEA CPC so high?",
];

function pickSuggestions() {
  const pool = [...SUGGESTION_POOL];
  const picked = [];
  while (picked.length < 3 && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}

function renderMarkdown(text) {
  if (!text) return "";

  let result = text;

  // Campaign name pills (quoted strings starting with Q — campaign naming convention)
  result = result.replace(
    /"(Q[^"]+)"/g,
    '<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-primary/10 text-primary font-medium max-w-[200px] truncate align-middle" title="$1">&ldquo;$1&rdquo;</span>'
  );

  // Other quoted strings — bold
  result = result.replace(
    /"([^"]+)"/g,
    '<span class="text-on-surface font-semibold">&ldquo;$1&rdquo;</span>'
  );

  // Bold: **text**
  result = result.replace(
    /\*\*(.*?)\*\*/g,
    '<strong class="text-on-surface font-semibold">$1</strong>'
  );

  // Highlight dollar amounts
  result = result.replace(
    /\$[\d,]+\.?\d*/g,
    '<span class="text-tertiary font-medium">$&</span>'
  );

  // Highlight percentages
  result = result.replace(
    /\d+\.?\d*%/g,
    '<span class="font-medium">$&</span>'
  );

  // Bullet points: lines starting with - or •
  // Inline styles guarantee spacing — Tailwind JIT may not compile classes in dynamic HTML
  result = result.replace(
    /^[•·\-]\s+(.+)$/gm,
    '<li style="display:flex;gap:6px;align-items:baseline;margin:0;padding:1px 0;line-height:1.45"><span style="opacity:0.5;flex-shrink:0">–</span><span>$1</span></li>'
  );

  // Wrap consecutive <li> in <ul>, stripping internal newlines so they
  // don't become <br/> tags and create huge vertical gaps
  result = result.replace(
    /(<li[\s\S]*?<\/li>[\n\r]*)+/g,
    (match) => `<ul style="list-style:none;margin:6px 0;padding:0">${match.replace(/[\n\r]+/g, "")}</ul>`
  );

  // Strip emojis (common status emojis Claude uses)
  result = result.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}\u{274C}\u{2705}\u{2611}\u{FE0F}]+/gu, "");

  // Line breaks
  result = result.replace(/\n\n/g, '</p><p style="margin:6px 0 2px">');
  result = result.replace(/\n/g, "<br/>");

  return result;
}

function formatTimestamp(date) {
  if (!date) return "";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function ChatPanel({ isOpen, onClose, chat }) {
  const { messages, isLoading, sendMessage } = chat;
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState(() => pickSuggestions());
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Refresh suggestions when panel opens fresh (no messages)
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setSuggestions(pickSuggestions());
    }
  }, [isOpen]);

  // Auto-send prefilled question when panel opens
  useEffect(() => {
    if (isOpen && chat.pendingPrefill) {
      const q = chat.pendingPrefill;
      chat.clearPrefill();
      chat.sendMessage(q);
    }
  }, [isOpen, chat.pendingPrefill]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />
      )}

      <aside className={`fixed right-0 top-0 h-full w-full lg:w-[380px] z-50
        bg-background/90 backdrop-blur-xl border-l border-white/10
        flex flex-col shadow-2xl transition-transform duration-300
        ${isOpen ? "translate-x-0" : "translate-x-full"}`}>

        <header className="p-6 border-b border-white/10 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">chat_bubble</span>
            </div>
            <div>
              <h2 className="font-headline font-bold text-lg text-white">Ask Your Data</h2>
              <p className="text-[10px] text-outline-variant font-medium uppercase tracking-wider">
                Powered by Claude + Pinecone
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-outline-variant">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        {/* Suggestion pills — only show when conversation is empty */}
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 px-6 pt-4 pb-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => {
                  sendMessage(s);
                  setInput("");
                }}
                className="px-3 py-1.5 rounded-full border border-outline-variant/30 text-[11px] text-on-surface-variant hover:bg-primary/10 hover:border-primary/50 transition-all text-left"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Message area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 no-scrollbar">
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} max-w-[90%]`}>
              {msg.role === "user" ? (
                <>
                  <div className="bg-primary/20 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed border border-primary/10 whitespace-pre-wrap break-words">
                    {msg.content}
                  </div>
                  {msg.timestamp && (
                    <span className="text-[9px] text-outline-variant mt-0.5 px-1 select-none">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <div className="bg-surface-container-high text-on-surface rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-normal max-w-[90%] space-y-1 break-words">
                    {msg.content === "" && isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
                        </div>
                        <span className="text-xs text-outline animate-pulse">Searching campaign data...</span>
                      </div>
                    ) : msg.content ? (
                      <div
                        className="text-sm leading-normal text-on-surface"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                      />
                    ) : (
                      <span className="text-outline italic text-xs">Thinking...</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 ml-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <polyline points="2,12 5,12 7,6 9,18 11,4 13,18 15,10 17,12 22,12" stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[10px] text-outline-variant">Claude AI</span>
                    {msg.timestamp && (
                      <span className="text-[9px] text-outline-variant select-none">
                        &middot; {formatTimestamp(msg.timestamp)}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
          {/* Loading indicator is now inline in the assistant bubble */}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <footer className="p-6 border-t border-white/10 space-y-3">
          <div className="relative">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="w-full bg-surface-container-high border-none rounded-full py-3 pl-5 pr-12 text-sm focus:ring-1 focus:ring-primary placeholder:text-outline-variant"
              placeholder="Type your question..."
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-on-primary shadow-lg disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">send</span>
            </button>
          </div>
          <p className="text-center text-[10px] text-outline uppercase tracking-widest flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
            Grounded in live data
          </p>
        </footer>
      </aside>
    </>
  );
}
