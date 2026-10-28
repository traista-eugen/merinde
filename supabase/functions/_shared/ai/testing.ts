// Test helpers: a fetch that never touches the network, and a usage sink
// that keeps rows in memory.
import type { AiUsageRow, UsageSink } from "./usage.ts";

export interface RecordedRequest {
  url: string;
  headers: Headers;
  /** The parsed JSON body. */
  body: unknown;
  signal?: AbortSignal | null;
}

type Reply =
  | Response
  | ((request: RecordedRequest) => Response | Promise<Response>);

/** Answers each request with the next reply in order; fails if it runs out. */
export function mockFetch(replies: Reply[]) {
  const requests: RecordedRequest[] = [];
  const queue = [...replies];
  const fetchMock =
    (async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : input.url;
      const request: RecordedRequest = {
        url,
        headers: new Headers(init.headers),
        body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
        signal: init.signal,
      };
      requests.push(request);
      const reply = queue.shift();
      if (!reply) throw new Error(`unexpected request to ${url}`);
      return typeof reply === "function" ? await reply(request) : reply;
    }) as typeof fetch;
  return { fetch: fetchMock, requests };
}

/** A chat completion as the Meta API returns it. */
export function completion(
  content: string,
  options: {
    promptTokens?: number;
    completionTokens?: number;
    finishReason?: string;
  } = {},
): Response {
  const promptTokens = options.promptTokens ?? 100;
  const completionTokens = options.completionTokens ?? 20;
  return Response.json({
    id: "chatcmpl-test",
    object: "chat.completion",
    model: "muse-spark-1.3",
    choices: [{
      index: 0,
      message: { role: "assistant", content },
      finish_reason: options.finishReason ?? "stop",
    }],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  });
}

export function memorySink(): { rows: AiUsageRow[]; sink: UsageSink } {
  const rows: AiUsageRow[] = [];
  return {
    rows,
    sink: (row) => {
      rows.push(row);
      return Promise.resolve();
    },
  };
}
