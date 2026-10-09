"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TranslatedTitle } from "@/components/translated-title";

type SearchResult = {
  id: string;
  source: string;
  title: string;
  description: string;
  routePath: string;
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<{
    query: string;
    results: SearchResult[];
    error: string;
  }>({ query: "", results: [], error: "" });
  const clean = query.trim();
  const loading = clean.length >= 2 && search.query !== clean;
  const results = search.query === clean ? search.results : [];

  useEffect(() => {
    if (clean.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(clean)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!controller.signal.aborted) {
          setSearch({ query: clean, results: data.results ?? [], error: "" });
        }
      } catch {
        if (!controller.signal.aborted) {
          setSearch({ query: clean, results: [], error: "Không thể tìm kiếm. Vui lòng thử lại." });
        }
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [clean]);

  return (
    <div className="relative w-full max-w-xl">
      <div className="flex items-center border border-white/15 bg-black/20 px-3">
        <Search className="size-4 text-slate-500" />
        <input aria-label="Tìm kiếm tài liệu" value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }}
          placeholder="Tìm trong MDN, React, TypeScript, Next.js..."
          className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" />
      </div>
      {clean.length >= 2 && (
        <div className="absolute left-0 right-0 top-12 z-50 max-h-[70vh] overflow-y-auto border border-white/15 bg-[#07111f] shadow-2xl">
          {loading && <p role="status" className="p-4 text-sm text-slate-500">Đang tìm kiếm...</p>}
          {!loading && search.error && <p role="alert" className="p-4 text-sm text-red-300">{search.error}</p>}
          {!loading && !search.error && results.length === 0 && <p className="p-4 text-sm text-slate-500">Không tìm thấy kết quả.</p>}
          {results.map((item) => (
            <Link key={item.id} href={item.routePath} onClick={() => setQuery("")}
              className="block border-b border-white/5 p-4 transition hover:bg-white/5">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">{item.source}</span>
                <strong className="text-sm"><TranslatedTitle key={item.id} id={item.id} title={item.title} /></strong>
              </div>
              {item.description && <p className="line-clamp-2 text-xs leading-5 text-slate-500">{item.description}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
