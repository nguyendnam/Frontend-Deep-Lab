import ReactMarkdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import type { Root, RootContent } from "hast";

type ArticleBodyProps = {
  markdown: string;
  originalMarkdown?: string;

  originalUrl: string;

  localUrlMap:
    Record<
      string,
      string
    >;
};

function normalizedUrl(
  value: string,
) {
  return value
    .replace(
      /#.*$/,
      "",
    )
    .replace(
      /\/$/,
      "",
    );
}

export function ArticleBody({
  markdown,
  originalMarkdown = markdown,
  originalUrl,
  localUrlMap,
}: ArticleBodyProps) {
  // Keep official English fragment IDs even when heading text is Vietnamese.
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeSlug);
  const originalTree = processor.runSync(processor.parse(originalMarkdown)) as Root;
  const headingIds: string[] = [];
  function visitHeadings(node: Root | RootContent, callback: (node: Extract<RootContent, { type: "element" }>) => void) {
    if (node.type === "element" && /^h[1-6]$/.test(node.tagName)) callback(node);
    if ("children" in node) node.children.forEach((child) => visitHeadings(child, callback));
  }
  visitHeadings(originalTree, (node) => headingIds.push(String(node.properties.id ?? "")));
  function originalAnchors() {
    return (tree: Root) => {
      let index = 0;
      visitHeadings(tree, (node) => {
        if (headingIds[index]) node.properties.id = headingIds[index];
        index++;
      });
    };
  }
  function resolveLink(
    href?: string,
  ) {
    if (!href) {
      return "#";
    }

    if (
      href.startsWith(
        "#",
      )
    ) {
      return href;
    }

    try {
      const absolute =
        new URL(
          href,
          originalUrl,
        );

      const hash =
        absolute.hash;

      absolute.hash = "";

      const local =
        localUrlMap[
          normalizedUrl(
            absolute.toString(),
          )
        ];

      if (local) {
        return (
          local +
          hash
        );
      }

      return new URL(
        href,
        originalUrl,
      ).toString();
    } catch {
      return href;
    }
  }

  return (
    <div className="max-w-none">
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm,
        ]}
        rehypePlugins={[
          rehypeSlug,
          originalAnchors,
        ]}
        components={{
          h1: (
            props,
          ) => (
            <h1
              {...props}
              className="mb-6 mt-10 text-4xl font-bold"
            />
          ),

          h2: (
            props,
          ) => (
            <h2
              {...props}
              className="mb-4 mt-12 border-b border-white/10 pb-3 text-2xl font-bold"
            />
          ),

          h3: (
            props,
          ) => (
            <h3
              {...props}
              className="mb-3 mt-8 text-xl font-bold"
            />
          ),

          p: (
            props,
          ) => (
            <p
              {...props}
              className="my-4 leading-8 text-slate-300"
            />
          ),

          ul: (
            props,
          ) => (
            <ul
              {...props}
              className="my-4 list-disc space-y-2 pl-6 text-slate-300"
            />
          ),

          ol: (
            props,
          ) => (
            <ol
              {...props}
              className="my-4 list-decimal space-y-2 pl-6 text-slate-300"
            />
          ),

          blockquote: (
            props,
          ) => (
            <blockquote
              {...props}
              className="my-5 border-l-4 border-blue-400 bg-blue-400/5 px-5 py-2"
            />
          ),

          pre: (
            props,
          ) => (
            <pre
              {...props}
              className="my-5 overflow-x-auto border border-white/10 bg-[#030810] p-4 text-sm leading-6"
            />
          ),

          code: (
            props,
          ) => (
            <code
              {...props}
              className="font-mono text-blue-200"
            />
          ),

          a: ({
            href,
            ...props
          }) => (
            <a
              {...props}
              href={resolveLink(
                href,
              )}
              className="text-blue-300 underline decoration-blue-400/40 underline-offset-4"
            />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
