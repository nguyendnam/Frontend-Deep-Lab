import Link from "next/link";

import {
  getManifest,
} from "@/lib/docs";

const sources = [
  {
    key: "mdn",

    title:
      "Nền tảng web (Web Platform)",

    description:
      "HTML, CSS, JavaScript, giao diện lập trình web (Web APIs) và lộ trình học MDN.",
  },

  {
    key:
      "typescript",

    title:
      "TypeScript",

    description:
      "Sổ tay (Handbook), tài liệu tham khảo và cấu hình TSConfig.",
  },

  {
    key:
      "react",

    title:
      "React",

    description:
      "Bài học chính thức và tài liệu tham khảo React API.",
  },

  {
    key:
      "next",

    title:
      "Next.js",

    description:
      "Tài liệu bộ định tuyến ứng dụng (App Router) khớp với phiên bản Next.js đang dùng.",
  },
];

export default async function LearnPage() {
  const manifest =
    await getManifest();

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
        Frontend Deep Lab
      </p>

      <h1 className="mt-3 max-w-3xl text-5xl font-bold tracking-tight">
        Học từ tài liệu chính thức.
      </h1>

      <p className="mt-5 max-w-2xl leading-8 text-slate-400">
        Tài liệu frontend bằng tiếng Việt, giữ thuật ngữ tiếng Anh để dễ đối chiếu.
        Tìm kiếm tập trung và trợ giảng AI dựa trên nguồn chính thức.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {sources.map(
          (
            source,
          ) => {
            const count =
              manifest.filter(
                (
                  item,
                ) =>
                  item.source ===
                    source.key &&
                  item.kind ===
                    "learn",
              ).length;

            return (
              <Link
                key={
                  source.key
                }
                href={
                  `/library/${source.key}`
                }
                className="border border-white/10 bg-white/[0.02] p-6 transition hover:border-blue-400/40"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-blue-300">
                  {
                    count
                  }{" "}
                  bài học
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  {
                    source.title
                  }
                </h2>

                <p className="mt-3 leading-7 text-slate-500">
                  {
                    source.description
                  }
                </p>
              </Link>
            );
          },
        )}
      </div>
    </main>
  );
}
