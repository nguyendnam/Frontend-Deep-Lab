import fs from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3000";
const manifest = JSON.parse(await fs.readFile("data/manifest.json", "utf8"));
const cases = [
  ["/learn", 200],
  ["/library/mdn?page=Infinity", 200],
  ["/library/react?page=999999", 200],
  ["/library/invalid", 404],
  ["/docs/react/missing-document", 404],
  ...["mdn", "typescript", "react", "next"].map((source) => [
    manifest.find((doc) => doc.source === source).routePath, 200,
  ]),
];

for (const [route, expected] of cases) {
  const response = await fetch(new URL(route, base));
  const body = await response.text();
  const streamedNotFound = expected === 404 && response.status === 200 && body.includes("NEXT_HTTP_ERROR_FALLBACK;404");
  if ((!streamedNotFound && response.status !== expected) || (expected === 200 && /NEXT_HTTP_ERROR_FALLBACK;(?:404|500)|Internal Server Error/.test(body))) {
    throw new Error(`${route}: ${response.status}`);
  }
  console.log(`PASS ${streamedNotFound ? "streamed 404" : response.status} ${route}`);
}

const response = await fetch(new URL("/api/search?q=useState", base));
const { results } = await response.json();
if (!response.ok || !results.some((item) => item.title.includes("useState"))) {
  throw new Error("Search did not return useState");
}
console.log(`PASS search: ${results.length} results`);
const short = await (await fetch(new URL("/api/search?q=a", base))).json();
if (short.results.length) throw new Error("Short search should return no results");

const ai = await fetch(new URL("/api/ai", base), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
if (![400, 503].includes(ai.status)) throw new Error(`AI invalid request: ${ai.status}`);
console.log(`PASS invalid AI request: ${ai.status}`);

const html = await (await fetch(new URL("/learn", base))).text();
const cssPaths = [...html.matchAll(/href="([^"]+\.css(?:\?[^"]*)?)"/g)].map((match) => match[1]);
const styles = await Promise.all(cssPaths.map(async (url) => (await fetch(new URL(url, base))).text()));
if (!styles.some((css) => css.includes(".text-5xl"))) throw new Error("Tailwind utility CSS missing");
console.log("PASS compiled Tailwind CSS");
