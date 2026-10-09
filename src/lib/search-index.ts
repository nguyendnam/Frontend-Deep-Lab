import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import MiniSearch from "minisearch";

const OPTIONS = {
  fields: [
    "title",
    "description",
    "text",
  ],

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
};

let cached:
  MiniSearch | null =
  null;

export async function getSearchIndex() {
  if (cached) {
    return cached;
  }

  const raw =
    await fs.readFile(
      path.join(
        process.cwd(),
        "data",
        "search-index.json",
      ),
      "utf8",
    );

  cached =
    MiniSearch.loadJSON(
      raw,
      OPTIONS,
    );

  return cached;
}