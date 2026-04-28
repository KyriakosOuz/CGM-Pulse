/**
 * useChat — Manages chat message history and streams answers from /api/chat.
 * Updated to support prefill(question) for opening the chat panel
 * with a pre-written question from another page.
 */
import { useState, useCallback } from "react";
import { startChatStream } from "../api/client";

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingPrefill, setPendingPrefill] = useState("");

  const sendMessage = useCallback(async (question) => {
    const userMsg = { role: "user", content: question, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "", timestamp: new Date() }]);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const response = await startChatStream(question, history);
      if (!response.ok) throw new Error("Chat failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const raw = decoder.decode(value, { stream: true });
        for (const line of raw.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.chunk) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: updated[updated.length - 1].content + parsed.chunk,
                };
                return updated;
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `Sorry, I encountered an error: ${e.message}`,
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  /**
   * prefill — store a question that ChatPanel will auto-send when it opens.
   */
  const prefill = useCallback((question) => {
    setPendingPrefill(question);
  }, []);

  const clearPrefill = useCallback(() => setPendingPrefill(""), []);

  return { messages, isLoading, sendMessage, prefill, pendingPrefill, clearPrefill };
}
