import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { cacheLife } from "next/cache";

import type {
  ManifestEntry,
  NormalizedDoc,
} from "@/types/docs";

const DATA_ROOT =
  path.join(
    process.cwd(),
    "data",
  );

const DOCS_ROOT =
  path.join(
    DATA_ROOT,
    "docs",
  );

export async function getManifest(): Promise<ManifestEntry[]> {
  "use cache";
  cacheLife("hours");

  const raw = await fs.readFile(
    path.join(DATA_ROOT, "manifest.json"),
    "utf8",
  );
  return JSON.parse(raw);
}

const getManifestMaps =
  cache(async () => {
    const manifest =
      await getManifest();

    return {
      byRoute:
        new Map(
          manifest.map(
            (
              item,
            ) => [
              item.routePath,
              item,
            ],
          ),
        ),

      byId:
        new Map(
          manifest.map(
            (
              item,
            ) => [
              item.id,
              item,
            ],
          ),
        ),

      byOriginalUrl:
        new Map(
          manifest.map(
            (
              item,
            ) => [
              normalizeUrl(
                item.originalUrl,
              ),
              item.routePath,
            ],
          ),
        ),
    };
  });

function normalizeUrl(
  value: string,
) {
  try {
    const url =
      new URL(value);

    url.hash = "";

    return url
      .toString()
      .replace(
        /\/$/,
        "",
      );
  } catch {
    return value;
  }
}

async function readDoc(
  file: string,
): Promise<NormalizedDoc> {
  "use cache";
  cacheLife("hours");
  return JSON.parse(
    await fs.readFile(
      path.join(
        DOCS_ROOT,
        file,
      ),
      "utf8",
    ),
  );
}

export async function getDocByRoute(
  routePath: string,
) {
  const {
    byRoute,
  } =
    await getManifestMaps();

  const item =
    byRoute.get(
      routePath,
    );

  if (!item) {
    return null;
  }

  return readDoc(
    item.file,
  );
}

export async function getDocById(
  id: string,
) {
  const {
    byId,
  } =
    await getManifestMaps();

  const item =
    byId.get(id);

  if (!item) {
    return null;
  }

  return readDoc(
    item.file,
  );
}

export async function resolveLocalDocUrl(
  absoluteUrl: string,
) {
  const {
    byOriginalUrl,
  } =
    await getManifestMaps();

  return (
    byOriginalUrl.get(
      normalizeUrl(
        absoluteUrl,
      ),
    ) ?? null
  );
}
