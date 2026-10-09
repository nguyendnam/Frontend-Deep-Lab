import { z } from "zod";
import { getManifest } from "@/lib/docs";
import { translateTitles, TranslationError } from "@/lib/translate-doc";

export async function POST(request: Request) {
  const parsed = z.object({ docIds: z.array(z.string().regex(/^[a-f0-9]{40}$/)).min(1).max(20) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Yêu cầu dịch tiêu đề không hợp lệ." }, { status: 400 });
  try {
    const ids = new Set(parsed.data.docIds);
    const docs = (await getManifest()).filter((doc) => ids.has(doc.id));
    const titles = await translateTitles(docs);
    return Response.json({ titles }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Title translation failed:", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: error instanceof TranslationError ? error.message : "Chưa thể dịch tiêu đề." }, {
      status: error instanceof TranslationError ? error.status : 502,
      headers: error instanceof TranslationError && error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {},
    });
  }
}
