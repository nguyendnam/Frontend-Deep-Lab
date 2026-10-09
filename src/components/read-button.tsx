"use client";

import { Check } from "lucide-react";
import { useSyncExternalStore } from "react";
import { parseReadIds } from "@/lib/read-progress";

const KEY = "frontend-deep-lab:read";
const CHANGE_EVENT = "frontend-deep-lab:read-changed";
let memoryIds: string[] | null = null;

function readIds() {
  if (memoryIds) return memoryIds;
  try {
    return parseReadIds(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) notify();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, notify);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, notify);
  };
}

export function ReadButton({ id }: { id: string }) {
  const read = useSyncExternalStore(subscribe, () => readIds().includes(id), () => false);

  function toggle() {
    const ids = readIds();
    const next = ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      memoryIds = null;
    } catch {
      memoryIds = next;
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <button type="button" onClick={toggle} aria-pressed={read}
      className={`flex items-center gap-2 border px-3 py-2 text-sm font-bold ${read
        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
        : "border-white/15 text-slate-300"}`}>
      <Check className="size-4" />
      {read ? "Đã đọc" : "Đánh dấu đã đọc"}
    </button>
  );
}
