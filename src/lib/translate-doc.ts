import "server-only";

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ManifestEntry, NormalizedDoc } from "@/types/docs";
import type { DocTranslation } from "@/types/translation";
import { protectMarkdown, splitTranslationText, validateTranslationTokens, preserveChunkSpacing, normalizeTechnicalTerms, TRANSLATION_SYSTEM, TRANSLATION_VERSION } from "./translation-text";

const ROOT = path.join(process.cwd(), "data", "translations", "vi");
const TranslationSchema = z.object({ title: z.string().min(1), description: z.string(), markdown: z.string().min(1) });
const jobs = new Map<string, Promise<DocTranslation>>();
let queue: Promise<unknown> = Promise.resolve();

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export class TranslationError extends Error {
  constructor(message: string, public status = 502, public retryAfter?: number) { super(message); }
}

async function readJson(file: string): Promise<unknown> {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch (error) {
    if (error instanceof SyntaxError || (error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function saveJson(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(value), "utf8");
    await fs.rename(temporary, file);
  } finally {
    await fs.unlink(temporary).catch(() => {});
  }
}

async function requestTranslation(texts: string[], model: string, key: string) {
  const run = async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try {
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(90_000),
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: TRANSLATION_SYSTEM }, { role: "user", content: JSON.stringify({ texts }) }],
          temperature: 0.1,
          max_completion_tokens: Math.min(6000, Math.max(2000, Math.ceil(texts.join("").length * 1.2) + 800)),
          ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
          response_format: { type: "json_object" },
        }),
      });
    } catch {
      throw new TranslationError("Không thể kết nối tới Groq. Vui lòng thử lại.");
    }
    if (response.status === 429) {
      const retryValue = Number(response.headers.get("retry-after"));
      const retryAfter = Number.isFinite(retryValue) && retryValue > 0 ? Math.ceil(retryValue) : 60;
      if (attempt < 2 && retryAfter <= 30) {
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      throw new TranslationError(`Groq đang giới hạn lượt dịch. Hãy thử lại sau ${retryAfter} giây; các phần đã dịch được lưu lại.`, 429, retryAfter);
    }
    if (!response.ok) throw new TranslationError("Groq không thể dịch lúc này. Vui lòng kiểm tra API key hoặc thử lại.", response.status === 401 ? 503 : 502);
    const body = await response.json();
    const choice = body.choices?.[0];
    if (choice?.finish_reason !== "stop") throw new TranslationError("Bản dịch chưa hoàn tất. Vui lòng thử lại.");
    let parsed: unknown;
    try { parsed = JSON.parse(choice.message.content); }
    catch { throw new TranslationError("Groq trả về bản dịch không hợp lệ. Vui lòng thử lại."); }
    const result = z.object({ translations: z.array(z.string().min(1)).length(texts.length) }).safeParse(parsed);
    if (!result.success) throw new TranslationError("Groq trả về bản dịch thiếu nội dung. Vui lòng thử lại.");
    return result.data.translations;
    }
    throw new TranslationError("Groq đang bận. Vui lòng thử lại.");
  };
  // Serialize requests across documents so concurrent readers don't burst the free quota.
  const result = queue.then(run);
  queue = result.catch(() => {});
  return result;
}

async function translate(doc: NormalizedDoc, model: string, key: string, file: string) {
  const saved = TranslationSchema.safeParse(await readJson(file));
  if (saved.success) return saved.data;

  async function batch(texts: string[]) {
    return translateTexts(texts, model, key);
  }

  const metadata = await translateMetadata(doc, model, key);
  const protectedBody = protectMarkdown(doc.markdown);
  const parts: string[] = [];
  for (const chunk of splitTranslationText(protectedBody.text)) {
    if (!/[a-zA-Z]/.test(chunk.replace(/FDLKEEP[A-Z]*\d+END/g, ""))) {
      parts.push(chunk);
    } else {
      const [translated] = await batch([chunk]);
      parts.push(preserveChunkSpacing(chunk, translated));
    }
  }
  const result = {
    ...metadata,
    markdown: protectedBody.restore(parts.join("")),
  };
  await saveJson(file, result);
  return result;
}

async function translateTexts(texts: string[], model: string, key: string) {
    const batchFile = path.join(ROOT, "chunks", `${hash([TRANSLATION_VERSION, model, texts])}.json`);
    const savedBatch = z.array(z.string()).length(texts.length).safeParse(await readJson(batchFile));
    if (savedBatch.success) return savedBatch.data;
    for (let attempt = 0; attempt < 2; attempt++) {
      const translated = await requestTranslation(texts, model, key);
      try {
        texts.forEach((text, index) => validateTranslationTokens(text, translated[index]));
      } catch {
        if (attempt === 0) continue;
        throw new TranslationError("Bản dịch làm thay đổi code hoặc liên kết. Vui lòng thử lại.");
      }
      await saveJson(batchFile, translated);
      return translated;
    }
    throw new TranslationError("Không thể dịch phần tài liệu này.");
}

async function translateMetadata(doc: Pick<NormalizedDoc, "title" | "description">, model: string, key: string) {
  const title = protectMarkdown(doc.title);
  const description = protectMarkdown(doc.description);
  const metaInputs = description.text ? [title.text, description.text] : [title.text];
  const meta = await translateTexts(metaInputs, model, key);
  const translatedTitle = title.restore(meta[0]);
  const translatedDescription = description.text ? description.restore(meta[1]) : "";
  return {
    title: translatedTitle,
    description: translatedDescription,
  };
}

export async function translateDoc(doc: NormalizedDoc): Promise<DocTranslation> {
  const model = process.env.GROQ_TRANSLATION_MODEL || process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  const file = path.join(ROOT, `${hash([TRANSLATION_VERSION, model, doc.id, doc.revision, doc.title, doc.description, doc.markdown])}.json`);
  const existing = jobs.get(file);
  if (existing) return existing;
  const job = (async () => {
    const cached = TranslationSchema.safeParse(await readJson(file));
    if (cached.success) return normalizeDoc(cached.data);
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new TranslationError("Chưa cấu hình GROQ_API_KEY để dịch tài liệu.", 503);
    return normalizeDoc(await translate(doc, model, key, file));
  })();
  jobs.set(file, job);
  try { return await job; }
  finally { jobs.delete(file); }
}

function normalizeDoc(translation: DocTranslation): DocTranslation {
  return {
    title: normalizeTechnicalTerms(translation.title),
    description: normalizeTechnicalTerms(translation.description),
    markdown: normalizeTechnicalTerms(translation.markdown),
  };
}

export async function translateTitles(docs: Pick<ManifestEntry, "id" | "title">[]) {
  const model = process.env.GROQ_TRANSLATION_MODEL || process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  const result: Record<string, string> = {};
  const pending: { id: string; title: string; file: string }[] = [];
  for (const doc of docs) {
    const file = path.join(ROOT, "titles", `${hash([TRANSLATION_VERSION, model, doc.title])}.json`);
    const saved = z.string().min(1).safeParse(await readJson(file));
    if (saved.success) result[doc.id] = normalizeTechnicalTerms(saved.data);
    else pending.push({ ...doc, file });
  }
  if (!pending.length) return result;
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new TranslationError("Chưa cấu hình GROQ_API_KEY để dịch tiêu đề.", 503);
  const protectedTitles = pending.map((doc) => protectMarkdown(doc.title));
  const translated = await translateTexts(protectedTitles.map((title) => title.text), model, key);
  for (let index = 0; index < pending.length; index++) {
    const title = normalizeTechnicalTerms(protectedTitles[index].restore(translated[index]));
    result[pending[index].id] = title;
    await saveJson(pending[index].file, title);
  }
  return result;
}
