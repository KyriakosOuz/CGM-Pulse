/**
 * useReport — Streams AI report from /api/report endpoint.
 * Persists last report across panel open/close cycles via ref.
 */
import { useState, useRef, useCallback } from "react";

export function useReport() {
  const [reportText, setReportText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);
  const lastReportRef = useRef("");

  const generate = useCallback(async () => {
    setIsLoading(true);
    setReportText("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/report`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      if (!response.ok) throw new Error("Report generation failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const raw = decoder.decode(value, { stream: true });
        const lines = raw.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;

          try {
            const parsed = JSON.parse(payload);
            if (parsed.chunk) {
              fullText += parsed.chunk;
              setReportText(fullText);
              lastReportRef.current = fullText;
            }
          } catch {
            // Ignore malformed chunks
          }
        }
      }
      setGeneratedAt(new Date());
    } catch (e) {
      setReportText(`Error generating report: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const restoreLastReport = useCallback(() => {
    if (lastReportRef.current && !reportText) {
      setReportText(lastReportRef.current);
    }
  }, [reportText]);

  return {
    reportText,
    isLoading,
    generatedAt,
    generate,
    restoreLastReport,
    hasReport: !!lastReportRef.current,
  };
}
