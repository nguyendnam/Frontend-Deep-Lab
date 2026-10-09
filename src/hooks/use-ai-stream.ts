"use client";

import { useEffect, useRef, useState } from "react";
import { consumeAiStream } from "@/lib/ai-stream";

type AskInput = {
  docId: string;
  mode: "explain" | "trace" | "simplify" | "example" | "debug";
  question: string;
  selectedText?: string;
};

export function useAiStream() {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => { controller.current?.abort(); }, []);

  async function ask(input: AskInput) {
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setAnswer("");
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: nextController.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${response.status}`);
      }
      if (!response.body) throw new Error("Response has no body.");
      await consumeAiStream(response.body, (text) => {
        if (controller.current === nextController && !nextController.signal.aborted) {
          setAnswer((current) => current + text);
        }
      }, nextController.signal);
    } catch (cause) {
      if (!nextController.signal.aborted && controller.current === nextController) {
        setError(cause instanceof Error ? cause.message : "Unknown error.");
      }
    } finally {
      if (!nextController.signal.aborted && controller.current === nextController) {
        controller.current = null;
        setLoading(false);
      }
    }
  }

  function cancel() {
    controller.current?.abort();
    controller.current = null;
    setLoading(false);
  }

  return { answer, error, loading, ask, cancel };
}
