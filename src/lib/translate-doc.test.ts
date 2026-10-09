import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { NormalizedDoc } from "../types/docs";

const { files } = vi.hoisted(() => ({ files: new Map<string, string>() }));
vi.mock("server-only", () => ({}));
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { default: {
  ...actual,
  readFile: vi.fn(async (file: string, options?: "utf8") => {
    if (!String(file).replaceAll("\\", "/").includes("/data/translations/vi/")) return actual.readFile(file, options);
    if (!files.has(file)) throw Object.assign(new Error("missing"), { code: "ENOENT" });
    return files.get(file);
  }),
  mkdir: vi.fn(async () => {}),
  writeFile: vi.fn(async (file: string, value: string) => { files.set(file, value); }),
  rename: vi.fn(async (from: string, to: string) => { files.set(to, files.get(from)!); files.delete(from); }),
  unlink: vi.fn(async (file: string) => { files.delete(file); }),
} };
});

const doc: NormalizedDoc = {
  id: "a".repeat(40), source: "react", kind: "learn", title: "React guide",
  description: "Learn React", revision: "revision-1", routePath: "/docs/react/state",
  originalUrl: "https://react.dev/learn/state", sourcePath: "learn/state.md", category: [], headings: [],
  markdown: '# Guide\n\nReact uses `useState`.\n\n```js\nconst [state, setState] = useState(0);\n```', plainText: "React state",
};

function successfulResponse(_url: unknown, init: RequestInit) {
  const input = JSON.parse(JSON.parse(String(init.body)).messages[1].content);
  return Promise.resolve(Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ translations: input.texts }) } }] }));
}

beforeEach(() => {
  vi.resetModules();
  files.clear();
  vi.stubEnv("GROQ_API_KEY", "test-key");
  vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-20b");
  vi.stubEnv("GROQ_TRANSLATION_MODEL", "");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("document translations", () => {
  it("persists a full translation and makes no further provider calls on a cache hit", async () => {
    const fetch = vi.fn(successfulResponse);
    vi.stubGlobal("fetch", fetch);
    const { translateDoc } = await import("./translate-doc");
    expect(await translateDoc(doc)).toEqual({ title: doc.title, description: doc.description, markdown: doc.markdown });
    const calls = fetch.mock.calls.length;
    expect(calls).toBe(2);
    await translateDoc(doc);
    expect(fetch).toHaveBeenCalledTimes(calls);
  });
  it("deduplicates simultaneous readers of the same uncached article", async () => {
    const fetch = vi.fn(successfulResponse);
    vi.stubGlobal("fetch", fetch);
    const { translateDoc } = await import("./translate-doc");
    await Promise.all([translateDoc(doc), translateDoc(doc), translateDoc(doc)]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("invalidates the translation when source content changes and reuses unchanged chunks", async () => {
    const fetch = vi.fn(successfulResponse);
    vi.stubGlobal("fetch", fetch);
    const { translateDoc } = await import("./translate-doc");
    await translateDoc(doc);
    const result = await translateDoc({ ...doc, markdown: doc.markdown + '\n\nNew content.' });
    expect(result.markdown).toContain('New content.');
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("exposes the free-tier retry window and does not cache an error", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '60' } })).mockImplementation(successfulResponse);
    vi.stubGlobal("fetch", fetch);
    const { translateDoc } = await import("./translate-doc");
    await expect(translateDoc(doc)).rejects.toMatchObject({ status: 429, retryAfter: 60 });
    expect(files.size).toBe(0);
    await expect(translateDoc(doc)).resolves.toMatchObject({ markdown: doc.markdown });
  });
  it("rejects truncated model output instead of storing incomplete documentation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] })));
    const { translateDoc } = await import("./translate-doc");
    await expect(translateDoc(doc)).rejects.toThrow('chưa hoàn tất');
    expect(files.size).toBe(0);
  });
  it("serves saved translations without requiring an API key", async () => {
    vi.stubGlobal("fetch", vi.fn(successfulResponse));
    const { translateDoc } = await import("./translate-doc");
    await translateDoc(doc);
    vi.stubEnv("GROQ_API_KEY", "");
    await expect(translateDoc(doc)).resolves.toMatchObject({ title: doc.title });
  });
});
