import type { Response } from "express";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { config } from "../config.js";
import { toHttpError } from "../middleware/errorHandler.js";
import { openai } from "../services/openaiService.js";

/**
 * Streams a chat completion to the client as Server-Sent Events:
 * `data: {"delta": "..."}` chunks, then `data: [DONE]`.
 */
export async function streamCompletion(res: Response, messages: ChatCompletionMessageParam[]): Promise<void> {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  const send = (payload: unknown) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

  try {
    const stream = await openai.chat.completions.create(
      { model: config.model, messages, stream: true },
      { signal: controller.signal },
    );
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) send({ delta });
    }
  } catch (err) {
    if (controller.signal.aborted) return;
    console.error("[sse] stream failed:", err);
    send({ error: toHttpError(err).message });
  }
  if (!res.writableEnded) {
    res.write("data: [DONE]\n\n");
    res.end();
  }
}
