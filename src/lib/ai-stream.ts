/** Decode complete SSE lines, including a final line without a newline. */
export async function consumeAiStream(
  stream: ReadableStream<Uint8Array>,
  onText: (text: string) => void,
  signal: AbortSignal,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  function consumeLine(line: string) {
    const clean = line.trim();
    if (!clean.startsWith("data:")) return;
    const data = clean.slice(5).trim();
    if (!data) return;
    if (data === "[DONE]") {
      completed = true;
      return;
    }
    const event = JSON.parse(data);
    if (event.error) {
      throw new Error(event.error.message ?? "AI stream failed.");
    }
    const text = event.choices?.[0]?.delta?.content;
    if (typeof text === "string" && !signal.aborted) onText(text);
  }

  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (!signal.aborted && !completed) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (signal.aborted || completed) break;
        consumeLine(line);
      }
      if (done) {
        if (buffer && !signal.aborted && !completed) consumeLine(buffer);
        if (!signal.aborted && !completed) throw new Error("AI stream ended before completion. Please try again.");
        break;
      }
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
