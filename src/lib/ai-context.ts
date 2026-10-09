import type {
  NormalizedDoc,
} from "@/types/docs";

function tokens(
  value: string,
) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .split(
      /[^a-z0-9_]+/,
    )
    .filter(
      (item) =>
        item.length >= 3,
    );
}

function score(
  section: string,
  queryTokens: string[],
) {
  const text = tokens(section).join(" ");

  let result = 0;

  for (
    const token
    of queryTokens
  ) {
    if (
      text.includes(
        token,
      )
    ) {
      result += 1;
    }
  }

  return result;
}

export function selectRelevantContext(
  doc: NormalizedDoc,

  question: string,

  selectedText?: string,
) {
  const sections =
    doc.markdown
      .split(
        /(?=^#{1,3}\s)/gm,
      )
      .filter(Boolean);

  const queryTokens =
    tokens(
      [
        question,
        selectedText ?? "",
      ].join(" "),
    );

  const ranked =
    sections
      .map(
        (
          section,
        ) => ({
          section,

          score:
            score(
              section,
              queryTokens,
            ),
        }),
      )
      .sort(
        (
          a,
          b,
        ) =>
          b.score -
          a.score,
      );

  const best =
    ranked
      .slice(
        0,
        5,
      )
      .map(
        (
          item,
        ) =>
          item.section,
      )
      .join(
        "\n\n",
      );

  const combined =
    [
      selectedText
        ? `SELECTED TEXT:\n${selectedText}`
        : "",

      `RELEVANT OFFICIAL DOCUMENTATION:\n${best}`,
    ]
      .filter(Boolean)
      .join(
        "\n\n",
      );

  return combined.slice(
    0,
    18_000,
  );
}
