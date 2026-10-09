import {
  BookOpen,
} from "lucide-react";

import Link from "next/link";

import {
  GlobalSearch,
} from "@/components/global-search";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#060d17]/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-[1800px] flex-wrap items-center gap-4 px-4 py-3">
        <Link
          href="/learn"
          className="flex shrink-0 items-center gap-2 font-bold"
        >
          <BookOpen className="size-5 text-blue-300" />

          Frontend Deep Lab
        </Link>

        <div className="min-w-[250px] flex-1">
          <GlobalSearch />
        </div>

        <nav className="flex gap-4 text-sm text-slate-400">
          <Link
            href="/learn"
          >
            Học
          </Link>

          <Link
            href="/library/mdn"
          >
            Thư viện
          </Link>
        </nav>
      </div>
    </header>
  );
}
