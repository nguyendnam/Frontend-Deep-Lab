"use client";

import {
  BrainCircuit,
  Send,
  Square,
} from "lucide-react";

import {
  FormEvent,
  useState,
} from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TranslatedTitle } from "@/components/translated-title";

import {
  useAiStream,
} from "@/hooks/use-ai-stream";

type Mode =
  | "explain"
  | "trace"
  | "simplify"
  | "example"
  | "debug";

const MODES:
  Mode[] = [
    "explain",
    "trace",
    "simplify",
    "example",
    "debug",
  ];

const MODE_LABELS: Record<Mode, string> = {
  explain: "Giải thích (Explain)",
  trace: "Theo dấu (Trace)",
  simplify: "Đơn giản hóa (Simplify)",
  example: "Ví dụ (Example)",
  debug: "Gỡ lỗi (Debug)",
};

export function AiTutor({
  docId,
  title,
  originalUrl,
}: {
  docId: string;
  title: string;
  originalUrl: string;
}) {
  const [
    mode,
    setMode,
  ] =
    useState<Mode>(
      "explain",
    );

  const [
    question,
    setQuestion,
  ] = useState("");

  const [
    selection,
    setSelection,
  ] = useState("");

  const {
    answer,
    error,
    loading,
    ask,
    cancel,
  } = useAiStream();

  function captureSelection() {
    const value =
      window
        .getSelection()
        ?.toString()
        .trim();

    if (value) {
      setSelection(
        value,
      );
    }
  }

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const clean =
      question.trim();

    if (!clean) {
      return;
    }

    await ask({
      docId,

      mode,

      question:
        clean,

      selectedText:
        selection ||
        undefined,
    });
  }

  return (
    <aside className="xl:sticky xl:top-24 xl:self-start">
      <div className="border border-white/10 bg-[#08121f]">
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-2 font-bold">
            <BrainCircuit className="size-5 text-violet-300" />

            Trợ giảng AI (AI Tutor)
          </div>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            Tài liệu:{" "}
            <TranslatedTitle key={docId} id={docId} title={title} />
          </p>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            {MODES.map(
              (item) => (
                <button
                  key={
                    item
                  }
                  type="button"
                  onClick={() =>
                    setMode(
                      item,
                    )
                  }
                  className={`border px-2 py-1 text-xs capitalize ${
                    mode ===
                    item
                      ? "border-violet-400 bg-violet-400/10 text-violet-200"
                      : "border-white/10 text-slate-500"
                  }`}
                >
                  {MODE_LABELS[item]}
                </button>
              ),
            )}
          </div>

          <button
            type="button"
            onClick={
              captureSelection
            }
            className="w-full border border-blue-400/20 px-3 py-2 text-left text-xs text-blue-300"
          >
            Dùng đoạn đang chọn
          </button>

          {selection && (
            <div className="max-h-32 overflow-y-auto border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-400">
              {
                selection
              }
            </div>
          )}

          <form
            onSubmit={
              submit
            }
            className="space-y-2"
          >
            <textarea
              aria-label="Câu hỏi cho AI Tutor"
              maxLength={2000}
              value={
                question
              }
              onChange={(
                event,
              ) =>
                setQuestion(
                  event.target
                    .value,
                )
              }
              rows={5}
              placeholder="Tại sao đoạn này hoạt động như vậy?"
              className="w-full resize-y border border-white/10 bg-black/20 p-3 text-sm outline-none focus:border-violet-400"
            />

            <div className="flex gap-2">
              <button
                disabled={
                  loading ||
                  !question.trim()
                }
                className="flex flex-1 items-center justify-center gap-2 bg-violet-500 px-3 py-2 text-sm font-bold disabled:opacity-40"
              >
                <Send className="size-4" />

                Hỏi trợ giảng
              </button>

              {loading && (
                <button
                  type="button"
                  onClick={
                    cancel
                  }
                  aria-label="Dừng trả lời"
                  className="border border-red-400/30 px-3 text-red-300"
                >
                  <Square className="size-4" />
                </button>
              )}
            </div>
          </form>

          {error && (
            <div className="border border-red-400/30 bg-red-400/5 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {answer && (
            <div className="border-t border-white/10 pt-4 text-sm leading-7 text-slate-300">
              <ReactMarkdown
                remarkPlugins={[
                  remarkGfm,
                ]}
              >
                {answer}
              </ReactMarkdown>

              <a
                href={
                  originalUrl
                }
                target="_blank"
                rel="noreferrer"
                className="mt-4 block text-xs text-blue-300 underline"
              >
                Nguồn chính thức ↗
              </a>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
