"use client";

import { useEffect, useState } from "react";
import { ArticleBody } from "@/components/article-body";
import { ReadButton } from "@/components/read-button";
import type { DocTranslation } from "@/types/translation";

type Props = {
  doc: DocTranslation & { id: string; source: string; kind: string; originalUrl: string; revision: string };
  localUrlMap: Record<string, string>;
};

export function ArticleReader({ doc, localUrlMap }: Props) {
  const [language, setLanguage] = useState<"vi" | "en">("vi");
  const [translation, setTranslation] = useState<DocTranslation | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docId: doc.id }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Không thể tải bản dịch.");
        if (!controller.signal.aborted) setTranslation(data.translation);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải bản dịch.");
      }
    }
    void load();
    return () => controller.abort();
  }, [doc.id, attempt]);

  const content = language === "en" ? doc : translation;
  return (
    <article className="min-w-0">
      <div className="mb-8 border-b border-white/10 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="border border-blue-400/30 bg-blue-400/5 px-2 py-1 text-xs font-bold uppercase text-blue-300">{doc.source}</span>
          <span className="text-xs text-slate-500">{doc.kind === "learn" ? "Bài học" : "Tài liệu tham khảo"}</span>
          <div className="ml-auto flex gap-2" aria-label="Ngôn ngữ bài viết">
            <button type="button" aria-pressed={language === "vi"} onClick={() => setLanguage("vi")}
              className={`border px-3 py-2 text-sm ${language === "vi" ? "border-blue-400 text-blue-200" : "border-white/15 text-slate-400"}`}>Tiếng Việt</button>
            <button type="button" aria-pressed={language === "en"} onClick={() => setLanguage("en")}
              className={`border px-3 py-2 text-sm ${language === "en" ? "border-blue-400 text-blue-200" : "border-white/15 text-slate-400"}`}>Bản gốc (English)</button>
          </div>
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">{content?.title ?? "Đang dịch tài liệu sang tiếng Việt…"}</h1>
        {content?.description && <p className="mt-4 max-w-3xl leading-7 text-slate-400">{content.description}</p>}
        <div className="mt-5 flex flex-wrap gap-3">
          <ReadButton id={doc.id} />
          <a href={doc.originalUrl} target="_blank" rel="noreferrer" className="border border-white/15 px-3 py-2 text-sm text-slate-300">Mở nguồn chính thức ↗</a>
        </div>
        {language === "vi" && translation && <p className="mt-4 text-xs text-slate-500">Bản dịch AI · Thuật ngữ có tiếng Anh trong ngoặc · Có thể đối chiếu với bản gốc.</p>}
      </div>
      {language === "vi" && !translation && !error && (
        <div role="status" className="border border-blue-400/20 bg-blue-400/5 p-6 leading-8 text-slate-300">
          Đang chuẩn bị bản tiếng Việt. Bài dài có thể cần vài phút ở lần mở đầu tiên. Bạn có thể đọc bản gốc trong lúc chờ.
        </div>
      )}
      {language === "vi" && !translation && error && (
        <div role="alert" className="border border-red-400/30 p-5 text-red-300">
          <p>{error}</p>
          <button type="button" onClick={() => { setError(""); setAttempt((value) => value + 1); }} className="mt-3 border border-white/20 px-3 py-2 text-sm">Thử dịch lại</button>
        </div>
      )}
      {content && <div lang={language}><ArticleBody markdown={content.markdown} originalMarkdown={doc.markdown} originalUrl={doc.originalUrl} localUrlMap={localUrlMap} /></div>}
    </article>
  );
}
