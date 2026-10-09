import Link from "next/link";
import { Suspense } from "react";
import Loading from "@/app/loading";
import { getPage } from "@/lib/pagination";
import { TranslatedTitle } from "@/components/translated-title";

import {
  notFound,
} from "next/navigation";

import {
  DOC_SOURCES,
} from "@/types/docs";

import {
  getManifest,
} from "@/lib/docs";

type Props = {
  params: Promise<{
    source: string;
  }>;

  searchParams:
    Promise<{
      page?: string | string[];
    }>;
};

const PAGE_SIZE = 100;

export default function LibraryPage(props: Props) {
  return (
    <Suspense fallback={<Loading />}>
      <LibraryContent {...props} />
    </Suspense>
  );
}

async function LibraryContent({
  params,
  searchParams,
}: Props) {
  const {
    source,
  } =
    await params;

  if (
    !DOC_SOURCES.includes(
      source as never,
    )
  ) {
    notFound();
  }

  const query =
    await searchParams;

  const manifest =
    await getManifest();

  const documents =
    manifest
      .filter(
        (
          item,
        ) =>
          item.source ===
          source,
      )
      .sort(
        (
          a,
          b,
        ) =>
          a.sourcePath.localeCompare(
            b.sourcePath,
          ),
      );

  const totalPages = Math.max(1, Math.ceil(documents.length / PAGE_SIZE));
  const page = getPage(query.page, totalPages);
  const start =
    (
      page -
      1
    ) *
    PAGE_SIZE;

  const visible =
    documents.slice(
      start,
      start +
      PAGE_SIZE,
    );

  return (
    <main className="mx-auto max-w-5xl p-6">
      <p className="text-xs font-bold uppercase tracking-wider text-blue-300">
        Thư viện
      </p>

      <h1 className="mt-2 text-4xl font-bold capitalize">
        {source}
      </h1>

      <p className="mt-3 text-slate-500">
        {
          documents.length
        } tài liệu
      </p>

      <div className="mt-8 border-t border-white/10">
        {visible.map(
          (doc) => (
            <Link
              key={
                doc.id
              }
              href={
                doc.routePath
              }
              className="block border-b border-white/10 py-4 transition hover:bg-white/[0.03]"
            >
              <strong>
                <TranslatedTitle key={doc.id} id={doc.id} title={doc.title} />
              </strong>

              <p className="mt-1 text-xs text-slate-600">
                {
                  doc.sourcePath
                }
              </p>
            </Link>
          ),
        )}
      </div>

      <div className="mt-6 flex gap-3">
        {page > 1 && (
          <Link
            href={`/library/${source}?page=${page - 1}`}
            className="border border-white/15 px-4 py-2"
          >
            ← Trang trước
          </Link>
        )}

        {page <
          totalPages && (
          <Link
            href={`/library/${source}?page=${page + 1}`}
            className="border border-white/15 px-4 py-2"
          >
            Trang sau →
          </Link>
        )}
      </div>
    </main>
  );
}
