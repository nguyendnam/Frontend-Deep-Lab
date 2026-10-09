import { notFound } from "next/navigation";
import { Suspense } from "react";
import Loading from "@/app/loading";
import { AiTutor } from "@/components/ai-tutor";
import { ArticleReader } from "@/components/article-reader";
import { getDocByRoute, getManifest } from "@/lib/docs";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root, RootContent } from "mdast";

type Props = {
  params: Promise<{ source: string; slug?: string[] }>;
};

export default function DocPage(props: Props) {
  return <Suspense fallback={<Loading />}><DocContent {...props} /></Suspense>;
}

async function DocContent({ params }: Props) {
  const { source, slug = [] } = await params;
  const routePath = `/docs/${source}` + (slug.length ? `/${slug.join("/")}` : "");
  const doc = await getDocByRoute(routePath);
  if (!doc) notFound();

  const manifest = await getManifest();
  const allUrls = new Map(manifest.map((item) => [item.originalUrl.replace(/#.*$/, "").replace(/\/$/, ""), item.routePath]));
  const localUrlMap: Record<string, string> = {};
  const tree = unified().use(remarkParse).use(remarkGfm).parse(doc.markdown);
  function collectLinks(node: Root | RootContent) {
    if (node.type === "link" || node.type === "definition") {
      try {
        const url = new URL(node.url, doc!.originalUrl);
        url.hash = "";
        const normalized = url.toString().replace(/\/$/, "");
        const local = allUrls.get(normalized);
        if (local) localUrlMap[normalized] = local;
      } catch { /* Invalid source links remain unchanged. */ }
    }
    if ("children" in node) node.children.forEach(collectLinks);
  }
  collectLinks(tree);

  return (
    <main className="mx-auto grid max-w-[1800px] gap-8 px-4 py-8 xl:grid-cols-[minmax(0,1fr)_380px] xl:px-8">
      <ArticleReader key={`article-${doc.id}`} doc={{
        id: doc.id, source: doc.source, kind: doc.kind, originalUrl: doc.originalUrl,
        revision: doc.revision, title: doc.title, description: doc.description, markdown: doc.markdown,
      }} localUrlMap={localUrlMap} />
      <AiTutor key={`tutor-${doc.id}`} docId={doc.id} title={doc.title} originalUrl={doc.originalUrl} />
    </main>
  );
}
