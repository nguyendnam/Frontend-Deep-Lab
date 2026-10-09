import { describe, expect, it } from "vitest";
import { getPage } from "./pagination";
import { parseReadIds } from "./read-progress";
import { consumeAiStream } from "./ai-stream";
import { selectRelevantContext } from "./ai-context";
import type { NormalizedDoc } from "../types/docs";

describe("library pagination", () => {
  it.each([undefined, "NaN", "Infinity", "-1", "0", "1.5", ["2", "3"]])("rejects invalid page %s", (value) => {
    expect(getPage(value, 10)).toBe(1);
  });
  it("clamps pages to available documents", () => {
    expect(getPage("999", 10)).toBe(10);
    expect(getPage("3", 10)).toBe(3);
    expect(getPage("2", 0)).toBe(1);
  });
});

describe("saved read progress", () => {
  it.each([null, "{", "null", "{}", '"foo"'])("recovers from malformed storage %s", (value) => {
    expect(parseReadIds(value)).toEqual([]);
  });
  it("keeps valid IDs from mixed data", () => {
    expect(parseReadIds('["a", 1, null, "b"]')).toEqual(["a", "b"]);
  });
});

function stream(chunks: Uint8Array[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk));
      controller.close();
    },
  });
}

describe("AI streaming", () => {
  it("preserves split UTF-8 characters and a final event without a newline", async () => {
    const bytes = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Tiếng Việt"}}]}\r\n\r\ndata: [DONE]');
    let answer = "";
    await consumeAiStream(stream(Array.from(bytes, (byte) => new Uint8Array([byte]))), (text) => { answer += text; }, new AbortController().signal);
    expect(answer).toBe("Tiếng Việt");
  });
  it("reports provider errors", async () => {
    await expect(consumeAiStream(stream([new TextEncoder().encode('data: {"error":{"message":"Rate limited"}}\n')]), () => {}, new AbortController().signal)).rejects.toThrow("Rate limited");
  });
  it("reports a truncated response", async () => {
    await expect(consumeAiStream(stream([]), () => {}, new AbortController().signal)).rejects.toThrow("before completion");
  });
  it("does not emit text after cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    let answer = "";
    await consumeAiStream(stream([new TextEncoder().encode('data: {"choices":[{"delta":{"content":"old"}}]}\n')]), (text) => { answer += text; }, controller.signal);
    expect(answer).toBe("");
  });
});

it("ranks Vietnamese context using the same normalization as the query", () => {
  const doc = { markdown: Array.from({ length: 6 }, (_, i) => `## Other ${i}\nUnrelated section.`).join("\n") + "\n## Biến\nĐây là biến được khai báo." } as NormalizedDoc;
  expect(selectRelevantContext(doc, "biến")).toContain("Đây là biến");
});
