import { type Env, secretKeys } from "../supabase-keys.ts";

/** One row of the `ai_usage` table; `created_at` is set by the database. */
export interface AiUsageRow {
  household_id: string | null;
  function: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
}

export type UsageSink = (row: AiUsageRow) => Promise<void>;

export interface SupabaseSinkOptions {
  fetch?: typeof fetch;
  env?: Env;
}

/**
 * The default sink: inserts each row into `ai_usage` through PostgREST with
 * the project's secret key, so it bypasses RLS. Reads the environment on each
 * call, not at creation.
 */
export function supabaseUsageSink(
  options: SupabaseSinkOptions = {},
): UsageSink {
  return async (row) => {
    const env = options.env ?? ((name: string) => Deno.env.get(name));
    const url = env("SUPABASE_URL")?.replace(/\/+$/, "");
    const [key] = secretKeys(env);
    if (!url || !key) {
      throw new Error("SUPABASE_URL or a secret key is missing");
    }
    const headers: Record<string, string> = {
      apikey: key,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };
    // New sb_secret_ keys go only on apikey; the legacy key is a JWT and
    // also needs to be the bearer token.
    if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;

    const res = await (options.fetch ?? fetch)(`${url}/rest/v1/ai_usage`, {
      method: "POST",
      headers,
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      throw new Error(
        `ai_usage insert failed: HTTP ${res.status} ${await res.text()}`,
      );
    }
    await res.body?.cancel();
  };
}
