import { AiError } from "./errors.ts";
import { assertAllowedModel, defaultModel } from "./models.ts";
import { type JsonSchema, schemaProblems, validate } from "./schema.ts";
import {
  type AiUsageRow,
  supabaseUsageSink,
  USAGE_TIMEOUT_MS,
  type UsageSink,
} from "./usage.ts";

export const META_API_URL = "https://api.meta.ai/v1/chat/completions";

/** The first try plus one retry when the reply doesn't match the schema. */
const MAX_ATTEMPTS = 2;
/** For all attempts together: an edge function request gets about 150 s. */
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_IMAGES = 50;
const IMAGE_DATA_URL = /^data:image\/(jpeg|png|webp|gif);base64,./;

export type ReasoningEffort =
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

/** What one edge function asks the model to do. */
export interface AiTask {
  /** The edge function's name: logged as `ai_usage.function` and sent as the schema name. */
  name: string;
  /** Fixed instructions. Keep them identical between calls so the prompt cache hits. */
  system: string;
  /** The reply's shape; see schema.ts for the keywords allowed. */
  schema: JsonSchema;
  /**
   * Defaults to muse-spark-1.3, or muse-spark-1.2 when the input has audio.
   * Any other model is refused (models.ts).
   */
  model?: string;
  /** Omit to let the model choose. */
  reasoningEffort?: ReasoningEffort;
  /**
   * Caps reasoning plus visible output tokens. A reply cut off at this cap
   * fails without a retry, so leave room for reasoning.
   */
  maxTokens?: number;
}

export type ImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export type AiInputPart =
  | { type: "text"; text: string }
  /** An https URL, e.g. a signed Storage URL, or a data URL. */
  | { type: "image"; url: string }
  /** No HEIC: the app converts photos to JPEG first. */
  | { type: "image"; base64: string; mimeType: ImageType }
  | { type: "audio"; base64: string; format: "wav" | "mp3" };

export interface AiCall {
  /** The app's language, e.g. "ro", "en" or "ro-RO" (decision 0006). */
  locale: string;
  input: string | AiInputPart[];
  /** Logged with the usage; null for calls outside a household. */
  householdId?: string | null;
}

export interface AiDeps {
  fetch?: typeof fetch;
  /** Defaults to the META_API_KEY secret. */
  apiKey?: string;
  /** Defaults to inserting into `ai_usage`. */
  usageSink?: UsageSink;
  /** How long the answer waits for the usage sink before giving up on it. */
  usageTimeoutMs?: number;
  timeoutMs?: number;
}

export interface AiResult<T> {
  data: T;
  model: string;
  attempts: number;
  /** Summed over all attempts; null if any attempt's response had no count. */
  usage: { prompt_tokens: number | null; completion_tokens: number | null };
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "input_audio"; input_audio: { data: string; format: string } };

interface ChatRequest {
  model: string;
  messages: { role: "system" | "user"; content: string | ContentPart[] }[];
  response_format: {
    type: "json_schema";
    json_schema: { name: string; schema: JsonSchema; strict: true };
  };
  reasoning_effort?: ReasoningEffort;
  max_tokens?: number;
}

interface ChatCompletion {
  choices?: {
    message?: { content?: unknown; refusal?: unknown };
    finish_reason?: string;
  }[];
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
}

type Reply =
  | { data: unknown }
  | { problem: string; retry: boolean };

/**
 * Calls Muse Spark for one task and returns the reply, checked against the
 * task's schema. Retries once if the reply doesn't match (but not if it was
 * cut off at max_tokens), then throws `invalid_output`. Logs token usage for
 * every API call, retries included.
 *
 * The caller vouches that `T` matches `task.schema`.
 */
export async function callAi<T>(
  task: AiTask,
  call: AiCall,
  deps: AiDeps = {},
): Promise<AiResult<T>> {
  const problems = schemaProblems(task.schema);
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(task.name)) {
    problems.unshift(
      `task name "${task.name}" must be 1–64 letters, digits, _ or -`,
    );
  }
  if (
    task.maxTokens !== undefined &&
    !(Number.isInteger(task.maxTokens) && task.maxTokens > 0)
  ) {
    problems.push(
      `maxTokens must be a positive integer, not ${task.maxTokens}`,
    );
  }
  if (problems.length > 0) {
    throw new AiError(
      "config",
      `Task ${task.name} can't be sent: ${problems.join("; ")}`,
    );
  }

  const content = toContent(call.input);
  const hasAudio = Array.isArray(content) &&
    content.some((part) => part.type === "input_audio");
  const request: ChatRequest = {
    model: task.model ?? defaultModel(hasAudio),
    messages: [
      // Fixed text first, so repeated calls pay the cached input rate.
      {
        role: "system",
        content: `${task.system}\n\n${languageInstruction(call.locale)}`,
      },
      { role: "user", content },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: task.name, schema: task.schema, strict: true },
    },
  };
  if (task.reasoningEffort) request.reasoning_effort = task.reasoningEffort;
  if (task.maxTokens !== undefined) request.max_tokens = task.maxTokens;

  const apiKey = deps.apiKey ?? Deno.env.get("META_API_KEY");
  if (!apiKey) throw new AiError("config", "The META_API_KEY secret isn't set");

  const sink = deps.usageSink ?? supabaseUsageSink();
  const usageTimeoutMs = deps.usageTimeoutMs ?? USAGE_TIMEOUT_MS;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  const usage: AiResult<T>["usage"] = {
    prompt_tokens: 0,
    completion_tokens: 0,
  };
  try {
    for (let attempt = 1;; attempt++) {
      const completion = await post(
        request,
        hasAudio,
        apiKey,
        deps.fetch ?? fetch,
        abort.signal,
        timeoutMs,
      );
      const row: AiUsageRow = {
        household_id: call.householdId ?? null,
        function: task.name,
        model: request.model,
        prompt_tokens: tokenCount(completion.usage?.prompt_tokens),
        completion_tokens: tokenCount(completion.usage?.completion_tokens),
      };
      usage.prompt_tokens = sum(usage.prompt_tokens, row.prompt_tokens);
      usage.completion_tokens = sum(
        usage.completion_tokens,
        row.completion_tokens,
      );
      await logUsage(sink, row, usageTimeoutMs);

      const reply = readReply(completion, task.schema);
      if ("data" in reply) {
        return {
          data: reply.data as T,
          model: request.model,
          attempts: attempt,
          usage,
        };
      }
      console.warn(
        `[ai] ${task.name}: invalid reply on attempt ${attempt}: ${reply.problem}`,
      );
      if (!reply.retry || attempt >= MAX_ATTEMPTS) {
        throw new AiError(
          "invalid_output",
          `${task.name}: invalid reply after ${attempt} ${
            attempt === 1 ? "attempt" : "attempts"
          }: ${reply.problem}`,
        );
      }
    }
  } finally {
    clearTimeout(timer);
  }
}

/** Null when the response didn't say, so a gap in the counts stays visible. */
function tokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sum(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a + b;
}

/** The only place that sends a request to the Meta API. */
async function post(
  request: ChatRequest,
  hasAudio: boolean,
  apiKey: string,
  fetchFn: typeof fetch,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<ChatCompletion> {
  assertAllowedModel(request.model, hasAudio);
  const timeout = () =>
    new AiError("timeout", `The Meta API didn't answer within ${timeoutMs} ms`);
  let res: Response;
  try {
    res = await fetchFn(META_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal,
    });
  } catch (err) {
    if (signal.aborted) throw timeout();
    throw new AiError("upstream", "Couldn't reach the Meta API", err);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AiError(
      "upstream",
      `The Meta API returned HTTP ${res.status}`,
      body.slice(0, 1000),
    );
  }
  try {
    return await res.json() as ChatCompletion;
  } catch (err) {
    if (signal.aborted) throw timeout();
    throw new AiError(
      "upstream",
      "The Meta API returned a body that isn't JSON",
      err,
    );
  }
}

function readReply(completion: ChatCompletion, schema: JsonSchema): Reply {
  const choice = completion.choices?.[0];
  if (choice?.finish_reason === "length") {
    // The same budget would most likely be cut off again.
    return {
      problem:
        "the reply was cut off at max_tokens; raise the task's maxTokens",
      retry: false,
    };
  }
  const message = choice?.message;
  if (typeof message?.refusal === "string" && message.refusal) {
    return { problem: `the model refused: ${message.refusal}`, retry: true };
  }
  if (typeof message?.content !== "string" || !message.content.trim()) {
    return { problem: "the reply is empty", retry: true };
  }
  let data: unknown;
  try {
    data = JSON.parse(message.content);
  } catch {
    return { problem: "the reply isn't valid JSON", retry: true };
  }
  const errors = validate(schema, data);
  if (errors.length > 0) {
    return { problem: errors.slice(0, 10).join("; "), retry: true };
  }
  return { data };
}

/**
 * Waits at most `timeoutMs` for the sink, so a slow, hanging or failing
 * insert never costs the user an answer that's already valid.
 */
async function logUsage(
  sink: UsageSink,
  row: AiUsageRow,
  timeoutMs: number,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const logged = Promise.resolve()
    .then(() => sink(row))
    .catch((err) => console.error("[ai] couldn't log usage", row, err));
  const gaveUp = new Promise<"gave up">((resolve) => {
    timer = setTimeout(() => resolve("gave up"), timeoutMs);
  });
  try {
    if (await Promise.race([logged, gaveUp]) === "gave up") {
      console.error(`[ai] usage log took over ${timeoutMs} ms; moving on`, row);
    }
  } finally {
    clearTimeout(timer);
  }
}

function toContent(input: string | AiInputPart[]): string | ContentPart[] {
  if (typeof input === "string") {
    if (!input.trim()) throw new AiError("bad_request", "The input is empty");
    return input;
  }
  if (!Array.isArray(input) || input.length === 0) {
    throw new AiError("bad_request", "The input is empty");
  }
  if (input.filter((part) => part.type === "image").length > MAX_IMAGES) {
    throw new AiError("bad_request", `At most ${MAX_IMAGES} images per call`);
  }
  return input.map(toContentPart);
}

function toContentPart(part: AiInputPart): ContentPart {
  switch (part.type) {
    case "text":
      return { type: "text", text: part.text };
    case "image": {
      const url = "url" in part
        ? part.url
        : `data:${part.mimeType};base64,${part.base64}`;
      if (!url.startsWith("https://") && !IMAGE_DATA_URL.test(url)) {
        throw new AiError(
          "bad_request",
          "Images must be an https URL or base64 JPEG, PNG, WebP or GIF",
        );
      }
      return { type: "image_url", image_url: { url } };
    }
    case "audio":
      if (!part.base64 || !["wav", "mp3"].includes(part.format)) {
        throw new AiError("bad_request", "Audio must be base64 WAV or MP3");
      }
      return {
        type: "input_audio",
        input_audio: { data: part.base64, format: part.format },
      };
    default:
      throw new AiError(
        "bad_request",
        `Unknown input part type "${(part as { type: unknown }).type}"`,
      );
  }
}

/** Tells the model which language to write in (decision 0006). */
function languageInstruction(locale: unknown): string {
  let tag: string | undefined;
  try {
    if (typeof locale === "string") {
      [tag] = Intl.getCanonicalLocales(locale.replaceAll("_", "-"));
    }
  } catch {
    // Invalid tag: handled below.
  }
  if (!tag) {
    throw new AiError(
      "bad_request",
      `locale ${
        JSON.stringify(locale)
      } isn't a language tag like "ro" or "en-GB"`,
    );
  }
  let language = tag;
  try {
    language = new Intl.DisplayNames(["en"], { type: "language" }).of(tag) ??
      tag;
  } catch {
    // Keep the tag.
  }
  return `Write every human-readable text value in ${language} (${tag}). ` +
    "Keep JSON keys and enum values exactly as the schema defines them.";
}
