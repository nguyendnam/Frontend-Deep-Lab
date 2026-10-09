import { z } from "zod";
import { getDocById } from "@/lib/docs";
import { translateDoc, TranslationError } from "@/lib/translate-doc";

export async function POST(request: Request) {
  const parsed = z.object({ docId: z.string().regex(/^[a-f0-9]{40}$/) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Yêu cầu dịch không hợp lệ." }, { status: 400 });
  try {
    const doc = await getDocById(parsed.data.docId);
    if (!doc) return Response.json({ error: "Không tìm thấy tài liệu." }, { status: 404 });
    const translation = await translateDoc(doc);
    return Response.json({ translation }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof TranslationError) {
      return Response.json({ error: error.message }, {
        status: error.status,
        headers: error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {},
      });
    }
    console.error("Document translation failed:", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Chưa thể tạo bản dịch. Vui lòng thử lại." }, { status: 502 });
  }
}
