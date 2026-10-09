import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import fg from "fast-glob";
import matter from "gray-matter";
import MiniSearch from "minisearch";

type DocSource = "mdn" | "typescript" | "react" | "next";
type DocKind = "learn" | "reference";

type SourceConfig = {
  source: DocSource;
  root: string;
  patterns: string[];
  revision: string;
};

type NormalizedDoc = {
  id: string;
  source: DocSource;
  kind: DocKind;
  title: string;
  description: string;
  routePath: string;
  originalUrl: string;
  sourcePath: string;
  revision: string;
  category: string[];
  headings: {
    depth: number;
    text: string;
  }[];
  markdown: string;
  plainText: string;
};

type ManifestEntry = Omit<NormalizedDoc, "markdown" | "plainText"> & {
  file: string;
};

const ROOT = process.cwd();

const CACHE_ROOT = path.join(ROOT, ".docs-cache", "repos");
const DATA_ROOT = path.join(ROOT, "data");
const DOCS_ROOT = path.join(DATA_ROOT, "docs");

function toPosix(value: string) {
  return value.replaceAll("\\", "/");
}

async function exists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function runGit(args: string[], cwd?: string) {
  execFileSync("git", args, {
    cwd,
    stdio: "inherit",
  });
}

function gitText(args: string[], cwd: string) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
  }).trim();
}

async function ensureSparseRepo({
  name,
  url,
  ref,
  paths,
}: {
  name: string;
  url: string;
  ref: string;
  paths: string[];
}) {
  const directory = path.join(CACHE_ROOT, name);

  await fs.mkdir(CACHE_ROOT, {
    recursive: true,
  });

  const gitDirectory = path.join(directory, ".git");

  if (!(await exists(gitDirectory))) {
    console.log(`\n[clone] ${name}`);

    runGit([
      "clone",
      "--depth",
      "1",
      "--filter=blob:none",
      "--sparse",
      "--branch",
      ref,
      url,
      directory,
    ]);
  } else {
    console.log(`\n[update] ${name}`);

    runGit(
      ["fetch", "origin", ref, "--depth", "1"],
      directory,
    );

    runGit(["reset", "--hard", "FETCH_HEAD"], directory);
  }

  runGit(["sparse-checkout", "set", ...paths], directory);

  const revision = gitText(["rev-parse", "HEAD"], directory);

  return {
    directory,
    revision,
  };
}

/**
 * Split Markdown while preserving fenced code blocks exactly.
 * This lets us clean MDX/MDN-specific prose without damaging code examples.
 */
function splitOutsideCodeFences(markdown: string) {
  return markdown.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g);
}

/**
 * Remove site-only syntax while preserving the useful inner Markdown.
 *
 * Important: no `s` regex flag is used here, so this works even when the
 * project's TypeScript target is older than ES2018.
 */
function normalizeProse(source: DocSource, value: string) {
  let result = value;

  // React heading anchors, e.g. "## State {/state/}".
  result = result.replace(/\s+\{\/[^}]+\/\}/g, "");

  // MDX JSX comments.
  result = result.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");

  // HTML comments outside code blocks.
  result = result.replace(/<!--[\s\S]*?-->/g, "");

  // MDN KumaScript macros. Keep the first quoted argument when possible.
  if (source === "mdn") {
    result = result.replace(/\{\{([\s\S]*?)\}\}/g, (_match, inner: string) => {
      if (/PreviousMenu|NextMenu/i.test(inner)) {
        return "";
      }

      const argument = inner.match(/["'`]([^"'`]+)["'`]/)?.[1];
      return argument ? `\`${argument}\`` : "";
    });
  }

  // Remove single-line MDX imports/exports that are meaningful only to the
  // original documentation site. Multiline exports are intentionally left
  // alone instead of risking deletion of real prose.
  result = result.replace(/^\s*import\s+[^\n]+$/gm, "");
  result = result.replace(/^\s*export\s+\{[^\n]*\}\s*;?$/gm, "");

  // Remove MDX wrapper component tags while preserving their children:
  // <Note>hello</Note> -> hello
  result = result.replace(
    /<\/?[A-Z][A-Za-z0-9_.-]*(?:\s[^<>]*?)?>/g,
    "",
  );

  // Remove self-closing MDX components:
  // <SomeWidget foo="bar" /> -> ""
  result = result.replace(
    /<[A-Z][A-Za-z0-9_.-]*(?:\s[^<>]*?)?\/>/g,
    "",
  );

  return result;
}

function normalizeMarkdown(source: DocSource, markdown: string) {
  return splitOutsideCodeFences(markdown)
    .map((part) => {
      if (part.startsWith("```") || part.startsWith("~~~")) {
        return part;
      }

      return normalizeProse(source, part);
    })
    .join("")
    .trim();
}

function markdownToPlainText(markdown: string) {
  return markdown
    .replace(/```[^\n]*\n/g, "")
    .replace(/```/g, "")
    .replace(/~~~[^\n]*\n/g, "")
    .replace(/~~~/g, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_>#~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstHeading(markdown: string) {
  return markdown.match(/^#\s+(.+)$/m)?.[1];
}

function extractHeadings(markdown: string) {
  const headings: {
    depth: number;
    text: string;
  }[] = [];

  const regex = /^(#{1,4})\s+(.+)$/gm;

  for (const match of markdown.matchAll(regex)) {
    headings.push({
      depth: match[1].length,
      text: match[2].replace(/[`*_]/g, "").trim(),
    });
  }

  return headings;
}

/**
 * Convert an arbitrary path segment into a deterministic URL-safe segment.
 * Unsafe characters are encoded instead of being deleted so two different
 * source paths do not silently collapse to the same route.
 */
function safeSegment(value: string) {
  const trimmed = value.trim().toLowerCase();

  let result = "";

  for (const character of trimmed) {
    if (/[a-z0-9._-]/.test(character)) {
      result += character;
      continue;
    }

    if (/\s/.test(character)) {
      result += "-";
      continue;
    }

    const codePoint = character.codePointAt(0)?.toString(16) ?? "unknown";
    result += `_u${codePoint}_`;
  }

  return result.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}

function cleanSegment(value: string) {
  return safeSegment(
    value
      .replace(/^\d+-/, "")
      .replace(/\.(md|mdx|html)$/i, ""),
  );
}

function pathSegments(value: string) {
  return value
    .split("/")
    .filter(Boolean)
    .map(cleanSegment)
    .filter(Boolean);
}

/**
 * MDN repository paths already encode special web identifiers in filenames
 * such as `--_star_`. Do not run them through the generic numeric-prefix
 * cleanup or a destructive slugifier.
 */
function mdnPathSegments(sourcePath: string) {
  const relative = sourcePath
    .replace(/^files\/en-us\//i, "")
    .replace(/\/index\.md$/i, "")
    .replace(/\.md$/i, "");

  return relative
    .split("/")
    .filter(Boolean)
    .map(safeSegment)
    .filter(Boolean);
}

function routeInfo({
  source,
  sourcePath,
  data,
}: {
  source: DocSource;
  sourcePath: string;
  data: Record<string, unknown>;
}) {
  switch (source) {
    case "mdn": {
      const segments = mdnPathSegments(sourcePath);

      const fallbackSlug = segments.join("/");
      const rawSlug = typeof data.slug === "string" ? data.slug : fallbackSlug;

      return {
        // Internal route: repository path keeps MDN's special identifier
        // encoding and therefore stays collision-resistant.
        segments,

        // Official URL: MDN frontmatter slug remains the source of truth.
        originalUrl: `https://developer.mozilla.org/en-US/docs/${rawSlug}`,
      };
    }

    case "react": {
      const relative = sourcePath
        .replace(/^src\/content\//, "")
        .replace(/\.(md|mdx)$/i, "")
        .replace(/\/index$/i, "");

      return {
        segments: pathSegments(relative),
        originalUrl: `https://react.dev/${relative}`,
      };
    }

    case "typescript": {
      if (typeof data.permalink === "string") {
        const permalink = data.permalink;

        const internal = permalink
          .replace(/^\/docs\//, "")
          .replace(/\.html$/i, "");

        return {
          segments: pathSegments(internal),
          originalUrl: `https://www.typescriptlang.org${permalink}`,
        };
      }

      const relative = sourcePath
        .replace(/^packages\/documentation\/copy\/en\//, "")
        .replace(
          /^packages\/tsconfig-reference\/copy\/en\/options\//,
          "tsconfig/",
        )
        .replace(/\.(md|mdx)$/i, "")
        .replace(/\/index$/i, "");

      return {
        segments: pathSegments(relative),
        originalUrl: `https://github.com/microsoft/TypeScript-Website/blob/v2/${sourcePath}`,
      };
    }

    case "next": {
      const relative = sourcePath
        .replace(/\.(md|mdx)$/i, "")
        .replace(/\/index$/i, "");

      const segments = relative
        .split("/")
        .filter(Boolean)
        .map((segment) => segment.replace(/^\d+-/, ""))
        .filter((segment) => segment !== "index")
        .map(safeSegment)
        .filter(Boolean);

      return {
        segments,
        originalUrl: segments.length
          ? `https://nextjs.org/docs/${segments.join("/")}`
          : "https://nextjs.org/docs",
      };
    }

    default: {
      const exhaustive: never = source;
      throw new Error(`Unsupported docs source: ${exhaustive}`);
    }
  }
}

function detectKind(source: DocSource, sourcePath: string): DocKind {
  if (source === "mdn") {
    return sourcePath.includes("learn_web_development/") ? "learn" : "reference";
  }

  if (source === "react") {
    return sourcePath.includes("src/content/learn/") ? "learn" : "reference";
  }

  if (source === "typescript") {
    const learning =
      sourcePath.includes("handbook-v2/") ||
      sourcePath.includes("/tutorials/") ||
      sourcePath.includes("/getting-started/");

    return learning ? "learn" : "reference";
  }

  return sourcePath.includes("01-app/01-getting-started/") ? "learn" : "reference";
}

function makeId(source: DocSource, routePath: string) {
  return createHash("sha1")
    .update(`${source}:${routePath}`)
    .digest("hex");
}

/**
 * Claim an internal route without dropping a document.
 *
 * In the rare case that two upstream documents still normalize to the same
 * route, add a deterministic hash based on sourcePath. The same source file
 * will therefore receive the same fallback route on every sync.
 */
function claimRoutePath({
  desiredRoutePath,
  sourcePath,
  routePaths,
}: {
  desiredRoutePath: string;
  sourcePath: string;
  routePaths: Map<string, string>;
}) {
  const previous = routePaths.get(desiredRoutePath);

  if (!previous) {
    routePaths.set(desiredRoutePath, sourcePath);
    return desiredRoutePath;
  }

  if (previous === sourcePath) {
    return desiredRoutePath;
  }

  const suffix = createHash("sha1")
    .update(sourcePath)
    .digest("hex")
    .slice(0, 8);

  const candidate = `${desiredRoutePath}--${suffix}`;
  const candidateOwner = routePaths.get(candidate);

  if (candidateOwner && candidateOwner !== sourcePath) {
    throw new Error(
      [
        "Unable to resolve route collision:",
        `route: ${desiredRoutePath}`,
        `existing: ${previous}`,
        `incoming: ${sourcePath}`,
        `candidate: ${candidate}`,
        `candidate owner: ${candidateOwner}`,
      ].join("\n"),
    );
  }

  console.warn(
    [
      "",
      "[route collision resolved]",
      `  route:    ${desiredRoutePath}`,
      `  existing: ${previous}`,
      `  incoming: ${sourcePath}`,
      `  resolved: ${candidate}`,
      "",
    ].join("\n"),
  );

  routePaths.set(candidate, sourcePath);
  return candidate;
}

async function getSources(): Promise<SourceConfig[]> {
  const mdn = await ensureSparseRepo({
    name: "mdn",
    url: "https://github.com/mdn/content.git",
    ref: "main",
    paths: [
      "files/en-us/learn_web_development",
      "files/en-us/web",
    ],
  });

  const react = await ensureSparseRepo({
    name: "react",
    url: "https://github.com/reactjs/react.dev.git",
    ref: "main",
    paths: [
      "src/content/learn",
      "src/content/reference",
    ],
  });

  const typescript = await ensureSparseRepo({
    name: "typescript",
    url: "https://github.com/microsoft/TypeScript-Website.git",
    ref: "v2",
    paths: [
      "packages/documentation/copy/en",
      "packages/tsconfig-reference/copy/en/options",
    ],
  });

  const nextPackagePath = path.join(
    ROOT,
    "node_modules",
    "next",
    "package.json",
  );

  const nextPackage = JSON.parse(
    await fs.readFile(nextPackagePath, "utf8"),
  ) as {
    version: string;
  };

  const nextDocsRoot = path.join(
    ROOT,
    "node_modules",
    "next",
    "dist",
    "docs",
  );

  if (!(await exists(nextDocsRoot))) {
    throw new Error(
      [
        "This installed Next.js package does not contain node_modules/next/dist/docs.",
        `Installed version: ${nextPackage.version}`,
        "Update Next.js to a version that bundles version-matched docs, then run docs:sync again.",
      ].join("\n"),
    );
  }

  return [
    {
      source: "mdn",
      root: mdn.directory,
      patterns: [
        "files/en-us/learn_web_development/**/*.md",
        "files/en-us/web/**/*.md",
      ],
      revision: mdn.revision,
    },
    {
      source: "react",
      root: react.directory,
      patterns: [
        "src/content/learn/**/*.{md,mdx}",
        "src/content/reference/**/*.{md,mdx}",
      ],
      revision: react.revision,
    },
    {
      source: "typescript",
      root: typescript.directory,
      patterns: [
        "packages/documentation/copy/en/**/*.md",
        "packages/tsconfig-reference/copy/en/options/**/*.md",
      ],
      revision: typescript.revision,
    },
    {
      source: "next",
      root: nextDocsRoot,
      patterns: ["**/*.{md,mdx}"],
      revision: `next@${nextPackage.version}`,
    },
  ];
}

async function main() {
  console.log("\nFrontend Deep Lab Docs Sync\n");

  const sources = await getSources();

  await fs.rm(DATA_ROOT, {
    recursive: true,
    force: true,
  });

  await fs.mkdir(DOCS_ROOT, {
    recursive: true,
  });

  const manifest: ManifestEntry[] = [];

  const miniSearch = new MiniSearch({
    fields: ["title", "description", "text"],
    storeFields: [
      "id",
      "source",
      "kind",
      "title",
      "description",
      "routePath",
      "originalUrl",
    ],
    idField: "id",
  });

  const routePaths = new Map<string, string>();

  const sourceCounts = new Map<DocSource, number>();
  let collisionCount = 0;

  for (const config of sources) {
    console.log(`\n[index] ${config.source}`);

    const files = await fg(config.patterns, {
      cwd: config.root,
      absolute: true,
      onlyFiles: true,
      unique: true,
    });

    let count = 0;

    for (const file of files) {
      const sourcePath = toPosix(path.relative(config.root, file));

      const raw = await fs.readFile(file, "utf8");
      const parsed = matter(raw);

      const markdown = normalizeMarkdown(config.source, parsed.content);

      if (!markdown) {
        continue;
      }

      const info = routeInfo({
        source: config.source,
        sourcePath,
        data: parsed.data as Record<string, unknown>,
      });

      const desiredRoutePath =
        `/docs/${config.source}` +
        (info.segments.length ? `/${info.segments.join("/")}` : "");

      const previousOwner = routePaths.get(desiredRoutePath);

      const routePath = claimRoutePath({
        desiredRoutePath,
        sourcePath,
        routePaths,
      });

      if (previousOwner && previousOwner !== sourcePath) {
        collisionCount += 1;
      }

      const title = String(
        parsed.data.title ??
          parsed.data["short-title"] ??
          firstHeading(markdown) ??
          path.basename(sourcePath),
      );

      const description = String(
        parsed.data.description ?? parsed.data.oneline ?? "",
      );

      const id = makeId(config.source, routePath);
      const category = info.segments.slice(0, -1);

      const doc: NormalizedDoc = {
        id,
        source: config.source,
        kind: detectKind(config.source, sourcePath),
        title,
        description,
        routePath,
        originalUrl: info.originalUrl,
        sourcePath,
        revision: config.revision,
        category,
        headings: extractHeadings(markdown),
        markdown,
        plainText: markdownToPlainText(markdown),
      };

      const fileName = `${id}.json`;

      await fs.writeFile(
        path.join(DOCS_ROOT, fileName),
        JSON.stringify(doc),
        "utf8",
      );

      manifest.push({
        id: doc.id,
        source: doc.source,
        kind: doc.kind,
        title: doc.title,
        description: doc.description,
        routePath: doc.routePath,
        originalUrl: doc.originalUrl,
        sourcePath: doc.sourcePath,
        revision: doc.revision,
        category: doc.category,
        headings: doc.headings,
        file: fileName,
      });

      miniSearch.add({
        id: doc.id,
        source: doc.source,
        kind: doc.kind,
        title: doc.title,
        description: doc.description,
        routePath: doc.routePath,
        originalUrl: doc.originalUrl,
        text: doc.plainText,
      });

      count += 1;
    }

    sourceCounts.set(config.source, count);
    console.log(`✓ ${count} documents`);
  }

  manifest.sort(
    (a, b) =>
      a.source.localeCompare(b.source) ||
      a.sourcePath.localeCompare(b.sourcePath),
  );

  await fs.writeFile(
    path.join(DATA_ROOT, "manifest.json"),
    JSON.stringify(manifest),
    "utf8",
  );

  await fs.writeFile(
    path.join(DATA_ROOT, "search-index.json"),
    JSON.stringify(miniSearch),
    "utf8",
  );

  await fs.writeFile(
    path.join(DATA_ROOT, "sync-meta.json"),
    JSON.stringify(
      {
        syncedAt: new Date().toISOString(),
        sources: Object.fromEntries(
          sources.map((source) => [source.source, source.revision]),
        ),
        sourceCounts: Object.fromEntries(sourceCounts),
        routeCollisionsResolved: collisionCount,
        documents: manifest.length,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log("\n────────────────────────────");
  console.log(`✓ ${manifest.length} documents indexed`);
  console.log(`✓ ${collisionCount} route collisions resolved`);
  console.log("✓ search index built");
  console.log("✓ sync complete\n");
}

main().catch((error: unknown) => {
  console.error("\nDocs sync failed.\n");

  if (error instanceof Error) {
    console.error(error.stack ?? error.message);
  } else {
    console.error(error);
  }

  process.exit(1);
});
