import { getClientId } from "@/lib/clientId";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function headers(): HeadersInit {
  return { "Content-Type": "application/json", "X-Client-Id": getClientId() };
}

async function toApiError(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (body?.error) message = body.error;
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(res.status, message);
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers: headers(),
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Is the backend running?");
  }
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

/**
 * POSTs to an SSE endpoint and calls onDelta for each streamed text chunk.
 * Resolves with the full text when the stream finishes.
 */
export async function streamApi(
  path: string,
  body: unknown,
  onDelta: (delta: string, full: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body), signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "Can't reach the server. Is the backend running?");
  }
  if (!res.ok || !res.body) throw await toApiError(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const line = event.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const data = line.slice(6);
      if (data === "[DONE]") return full;
      const parsed = JSON.parse(data) as { delta?: string; error?: string };
      if (parsed.error) throw new ApiError(502, parsed.error);
      if (parsed.delta) {
        full += parsed.delta;
        onDelta(parsed.delta, full);
      }
    }
  }
  return full;
}
