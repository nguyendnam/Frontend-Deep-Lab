import {
  getSearchIndex,
} from "@/lib/search-index";

export async function GET(
  request: Request,
) {
  const url =
    new URL(
      request.url,
    );

  const query =
    url.searchParams
      .get("q")
      ?.trim();

  if (
    !query ||
    query.length < 2
  ) {
    return Response.json({
      results: [],
    });
  }

  const index =
    await getSearchIndex();

  const results =
    index
      .search(
        query,
        {
          prefix: true,

          fuzzy: 0.15,

          boost: {
            title: 5,
            description: 2,
          },
        },
      )
      .slice(
        0,
        25,
      )
      .map(
        (
          item:
          Record<
            string,
            unknown
          >,
        ) => ({
          id:
            item.id,

          source:
            item.source,

          kind:
            item.kind,

          title:
            item.title,

          description:
            item.description,

          routePath:
            item.routePath,

          originalUrl:
            item.originalUrl,

          score:
            item.score,
        }),
      );

  return Response.json({
    results,
  });
}