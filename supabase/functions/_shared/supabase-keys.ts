export type Env = (name: string) => string | undefined;

const denoEnv: Env = (name) => Deno.env.get(name);

/**
 * The project's secret keys, which bypass RLS: the new `sb_secret_` keys
 * (the "default" one first), then the legacy service_role JWT. Supabase sets
 * both in every edge function.
 */
export function secretKeys(env: Env = denoEnv): string[] {
  const keys: string[] = [];
  const json = env("SUPABASE_SECRET_KEYS");
  if (json) {
    try {
      const named = JSON.parse(json) as Record<string, unknown>;
      const ordered = [named.default, ...Object.values(named)];
      for (const key of ordered) {
        if (typeof key === "string" && key && !keys.includes(key)) {
          keys.push(key);
        }
      }
    } catch {
      // Malformed: fall back to the legacy key.
    }
  }
  const legacy = env("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy && !keys.includes(legacy)) keys.push(legacy);
  return keys;
}

/** True when the request carries one of the secret keys, on `apikey` or as a bearer token. */
export function hasSecretKey(req: Request, keys: string[]): boolean {
  const presented: string[] = [];
  const apikey = req.headers.get("apikey");
  if (apikey) presented.push(apikey);
  const bearer = /^Bearer\s+(\S+)$/i.exec(
    req.headers.get("authorization") ?? "",
  );
  if (bearer) presented.push(bearer[1]);
  return presented.some((p) => keys.some((k) => k !== "" && sameString(p, k)));
}

/** Compares without stopping at the first differing character. */
function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
