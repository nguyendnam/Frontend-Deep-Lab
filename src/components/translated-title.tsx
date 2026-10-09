"use client";

import { useEffect, useRef, useState } from "react";

const pending = new Map<string, { resolve: (title: string) => void; reject: (error: Error) => void }>();
const requests = new Map<string, Promise<string>>();
let timer: ReturnType<typeof setTimeout> | undefined;
let active = false;

async function flush() {
  if (active || !pending.size) return;
  active = true;
  const batch = [...pending.entries()].slice(0, 20);
  batch.forEach(([id]) => pending.delete(id));
  try {
    const response = await fetch("/api/translate-titles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docIds: batch.map(([id]) => id) }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Chưa thể dịch tiêu đề.");
    batch.forEach(([id, handlers]) => {
      const title = data.titles?.[id];
      if (typeof title === "string") handlers.resolve(title);
      else { requests.delete(id); handlers.reject(new Error("Không tìm thấy tiêu đề.")); }
    });
  } catch (error) {
    batch.forEach(([id, handlers]) => {
      requests.delete(id);
      handlers.reject(error instanceof Error ? error : new Error("Chưa thể dịch tiêu đề."));
    });
  } finally {
    active = false;
    if (pending.size) timer = setTimeout(() => { void flush(); }, 100);
  }
}

function requestTitle(id: string) {
  const existing = requests.get(id);
  if (existing) return existing;
  const promise = new Promise<string>((resolve, reject) => pending.set(id, { resolve, reject }));
  requests.set(id, promise);
  if (!active) {
    clearTimeout(timer);
    timer = setTimeout(() => { void flush(); }, 50);
  }
  return promise;
}

export function TranslatedTitle({ id, title }: { id: string; title: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [translated, setTranslated] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      requestTitle(id).then((value) => { if (alive) setTranslated(value); })
        .catch((cause) => { if (alive) setError(cause.message); });
    }, { rootMargin: "150px" });
    if (ref.current) observer.observe(ref.current);
    return () => { alive = false; observer.disconnect(); };
  }, [id]);
  return <span ref={ref} title={error || title}>{translated ?? (error ? title : "Đang dịch tiêu đề…")}</span>;
}
