import {
  z,
} from "zod";

import {
  selectRelevantContext,
} from "@/lib/ai-context";

import {
  getDocById,
} from "@/lib/docs";

const Schema =
  z.object({
    docId:
      z.string()
        .length(40),

    mode:
      z.enum([
        "explain",
        "trace",
        "simplify",
        "example",
        "debug",
      ]),

    question:
      z.string()
        .trim()
        .min(1)
        .max(2000),

    selectedText:
      z.string()
        .max(6000)
        .optional(),
  });

const SYSTEM = `
Bạn là Frontend Deep Tutor.

Ngôn ngữ mặc định: tiếng Việt.
Thuật ngữ chuyên ngành: viết tiếng Việt rồi tiếng Anh trong ngoặc, ví dụ trạng thái (state), thành phần (component), bao đóng (closure).
Giữ nguyên tên riêng React, Next.js, TypeScript, JavaScript và mọi identifier, API, code.

Bạn đang hỗ trợ người dùng học frontend từ tài liệu chính thức.

Ưu tiên:
- mental model,
- runtime flow,
- cause -> effect,
- browser/server boundary,
- giải thích biến và function,
- kết nối kiến thức JavaScript -> React -> Next.js.

OFFICIAL CONTEXT được cung cấp bên dưới là nguồn chính.

Không tự thay đổi nội dung tài liệu.
Nếu thông tin người dùng hỏi không có trong context,
hãy nói rõ thay vì bịa.

Mode:

EXPLAIN:
Giải thích sâu từ gốc.

TRACE:
Trace theo thứ tự runtime.

SIMPLIFY:
Giải thích đơn giản trước, sau đó tăng độ sâu.

EXAMPLE:
Tạo ví dụ nhỏ tập trung đúng concept.

DEBUG:
Giải thích triệu chứng -> nguyên nhân -> cách sửa.
`;

export async function POST(
  request: Request,
) {
  const key =
    process.env
      .GROQ_API_KEY;

  if (!key) {
    return Response.json(
      {
        error:
          "GROQ_API_KEY chưa được cấu hình.",
      },
      {
        status: 503,
      },
    );
  }

  const raw =
    await request
      .json()
      .catch(
        () => null,
      );

  const parsed =
    Schema.safeParse(
      raw,
    );

  if (
    !parsed.success
  ) {
    return Response.json(
      {
        error:
          "Invalid request.",
      },
      {
        status: 400,
      },
    );
  }

  const input =
    parsed.data;

  const doc =
    await getDocById(
      input.docId,
    );

  if (!doc) {
    return Response.json(
      {
        error:
          "Document not found.",
      },
      {
        status: 404,
      },
    );
  }

  const context =
    selectRelevantContext(
      doc,
      input.question,
      input.selectedText,
    );

  const prompt = `
SOURCE:
${doc.source}

DOCUMENT:
${doc.title}

OFFICIAL URL:
${doc.originalUrl}

MODE:
${input.mode}

OFFICIAL CONTEXT:
${context}

QUESTION:
${input.question}

Hãy trả lời bằng tiếng Việt.
`;

  let response: Response;
  try {
    response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${key}`,

          "Content-Type":
            "application/json",
        },

        cache:
          "no-store",
        signal: request.signal,

        body:
          JSON.stringify({
            model:
              process.env.GROQ_MODEL,

            messages: [
              {
                role:
                  "system",

                content:
                  SYSTEM,
              },

              {
                role:
                  "user",

                content:
                  prompt,
              },
            ],

            temperature:
              0.2,

            max_completion_tokens:
              1400,

            reasoning_effort:
              "low",

            stream:
              true,
          }),
      },
    );
  } catch {
    return Response.json(
      { error: "Không thể kết nối tới Groq. Vui lòng thử lại." },
      { status: 502 },
    );
  }

  if (
    !response.ok
  ) {
    const detail =
      await response.text();

    console.error(
      detail,
    );

    return Response.json(
      {
        error:
          "Groq request failed.",
      },
      {
        status:
          response.status,
      },
    );
  }

  if (
    !response.body
  ) {
    return Response.json(
      {
        error:
          "Empty Groq stream.",
      },
      {
        status: 502,
      },
    );
  }

  return new Response(
    response.body,
    {
      headers: {
        "Content-Type":
          "text/event-stream; charset=utf-8",

        "Cache-Control":
          "no-cache, no-transform",
      },
    },
  );
}
