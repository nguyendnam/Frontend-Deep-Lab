import { describe, expect, it } from "vitest";
import { normalizeTechnicalTerms, preserveChunkSpacing, protectMarkdown, splitTranslationText, validateTranslationTokens } from "./translation-text";

describe("translation syntax protection", () => {
  it("round trips fenced code, inline code, nested link destinations and brands", () => {
    const source = 'React uses `useState`.\n\n[Read more](https://example.com/foo(bar)#state "Title")\n\n```tsx\nconst title = "Do not translate";\n```\n\nNext.js and TypeScript.';
    const protectedText = protectMarkdown(source);
    expect(protectedText.restore(protectedText.text)).toBe(source);
    expect(protectedText.text).not.toContain('const title');
    expect(protectedText.text).not.toContain('https://example.com');
    expect(protectedText.text).toContain('React');
    expect(protectedText.text).toContain('Next.js');
    expect(protectedText.text).toMatch(/\[Read more\]\(FDLKEEP\d+END\)/);
  });
  it("preserves longer fences with embedded triple backticks", () => {
    const source = '````md\n```js\nconsole.log("hello");\n```\n````\n\nText';
    const protectedText = protectMarkdown(source);
    expect(protectedText.restore(protectedText.text)).toBe(source);
  });
  it("does not translate comments or strings inside examples", () => {
    const source = '~~~js\n// English comment\nconst text = "English string";\n~~~';
    const protectedText = protectMarkdown(source);
    expect(protectedText.text).toMatch(/^FDLKEEP\d+END$/);
    expect(protectedText.restore(protectedText.text)).toBe(source);
  });
  it("rejects missing, duplicated, reordered and invented tokens", () => {
    const source = 'FDLKEEP0END text FDLKEEP1END';
    for (const translated of ['FDLKEEP0END', 'FDLKEEP0END FDLKEEP0END FDLKEEP1END', 'FDLKEEP1END FDLKEEP0END', source + ' FDLKEEP2END']) {
      expect(() => validateTranslationTokens(source, translated)).toThrow();
    }
  });
  it("restores inserted source strings without reinterpreting literal placeholder text", () => {
    const source = '`FDLKEEP0END` and `other`';
    const protectedText = protectMarkdown(source);
    expect(protectedText.restore(protectedText.text)).toBe(source);
  });
});

describe("long document chunks", () => {
  it("retains all whitespace and never splits a protected identifier", () => {
    const source = 'Paragraph FDLKEEP0END.\n\n'.repeat(100);
    const chunks = splitTranslationText(source, 100);
    expect(chunks.join('')).toBe(source);
    expect(chunks.every((chunk) => chunk.length <= 100)).toBe(true);
    expect(chunks.flatMap((chunk) => chunk.match(/FDLKEEP0END/g) ?? [])).toHaveLength(100);
  });
  it("keeps paragraph separators when the model trims its output", () => {
    expect(preserveChunkSpacing('  Original\n\n', 'Bản dịch')).toBe('  Bản dịch\n\n');
    expect(preserveChunkSpacing('original ', 'dịch')).toBe('dịch ');
  });
});

it("places Vietnamese before English while leaving React, code, URLs and existing pairs intact", () => {
  const code = '`const state = render();`';
  const input = `React: render (kết xuất), subroute (đường dẫn con), trạng thái (state), framework. ${code} [Link](https://example.com/state)`;
  const output = normalizeTechnicalTerms(input);
  expect(output).toContain('kết xuất (render)');
  expect(output).toContain('đường dẫn con (subroute)');
  expect(output).toContain('trạng thái (state)');
  expect(output).not.toContain('trạng thái (trạng thái');
  expect(output).toContain('khung phát triển (framework)');
  expect(output).toContain(code);
  expect(output).toContain('https://example.com/state');
  expect(output).toContain('React');
});
