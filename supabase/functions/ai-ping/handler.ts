import {
  type AiDeps,
  AiError,
  type AiTask,
  callAi,
  errorResponse,
} from "../_shared/ai/mod.ts";
import { hasSecretKey } from "../_shared/supabase-keys.ts";

/** The smallest useful call: proves the key, the model and structured output work. */
export const PING_TASK: AiTask = {
  name: "ai-ping",
  system: "You are a health check for the Merinde backend. " +
    "Reply with the JSON object the schema describes.",
  schema: {
    type: "object",
    properties: {
      ok: { type: "boolean", description: "Always true." },
      greeting: { type: "string", description: "One short friendly sentence." },
    },
    required: ["ok", "greeting"],
    additionalProperties: false,
  },
  reasoningEffort: "minimal",
  // Reasoning shares this budget; too low and the reply is cut off.
  maxTokens: 2000,
};

interface Pong {
  ok: boolean;
  greeting: string;
}

export interface PingDeps {
  secretKeys: string[];
  ai?: AiDeps;
}

/**
 * POST with an optional `{"locale": "ro"}` body. Only callers holding a
 * secret key get through, since each call spends API credit.
 */
export async function handlePing(
  req: Request,
  deps: PingDeps,
): Promise<Response> {
  if (!hasSecretKey(req, deps.secretKeys)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  let locale = "en";
  const text = await req.text();
  if (text.trim()) {
    try {
      const body = JSON.parse(text);
      if (typeof body?.locale === "string") locale = body.locale;
    } catch {
      return errorResponse(new AiError("bad_request", "The body isn't JSON"));
    }
  }
  try {
    const result = await callAi<Pong>(
      PING_TASK,
      { locale, input: "Say hello to the Merinde team." },
      deps.ai,
    );
    return Response.json({
      ok: result.data.ok,
      greeting: result.data.greeting,
      model: result.model,
      attempts: result.attempts,
      usage: result.usage,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
