export const DOC_SOURCES = [
  "mdn",
  "typescript",
  "react",
  "next",
] as const;

export type DocSource =
  (typeof DOC_SOURCES)[number];

export type DocKind =
  | "learn"
  | "reference";

export type Heading = {
  depth: number;
  text: string;
};

export type NormalizedDoc = {
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

  headings: Heading[];

  markdown: string;
  plainText: string;
};

export type ManifestEntry = Omit<
  NormalizedDoc,
  "markdown" | "plainText"
> & {
  file: string;
};