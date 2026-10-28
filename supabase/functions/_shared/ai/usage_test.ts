import { assertEquals, assertRejects } from "jsr:@std/assert@^1";
import { secretKeys } from "../supabase-keys.ts";
import { mockFetch } from "./testing.ts";
import { type AiUsageRow, supabaseUsageSink } from "./usage.ts";

const ROW: AiUsageRow = {
  household_id: "6f1c1d1e-0000-4000-8000-000000000001",
  function: "recipe-generate",
  model: "muse-spark-1.3",
  prompt_tokens: 3000,
  completion_tokens: 2500,
};

function env(vars: Record<string, string>) {
  return (name: string) => vars[name];
}

Deno.test("default sink: inserts exactly the ai_usage columns with a new secret key on apikey only", async () => {
  const mock = mockFetch([new Response(null, { status: 201 })]);
  const sink = supabaseUsageSink({
    fetch: mock.fetch,
    env: env({
      SUPABASE_URL: "https://ref.supabase.co/",
      SUPABASE_SECRET_KEYS: '{"default":"sb_secret_abc"}',
      SUPABASE_SERVICE_ROLE_KEY: "eyJlegacy",
    }),
  });

  await sink(ROW);

  const [request] = mock.requests;
  assertEquals(request.url, "https://ref.supabase.co/rest/v1/ai_usage");
  assertEquals(request.body, {
    household_id: "6f1c1d1e-0000-4000-8000-000000000001",
    function: "recipe-generate",
    model: "muse-spark-1.3",
    prompt_tokens: 3000,
    completion_tokens: 2500,
  });
  assertEquals(request.headers.get("apikey"), "sb_secret_abc");
  assertEquals(request.headers.get("authorization"), null);
  assertEquals(request.headers.get("prefer"), "return=minimal");
});

Deno.test("default sink: a legacy service_role JWT also goes in Authorization", async () => {
  const mock = mockFetch([new Response(null, { status: 201 })]);
  const sink = supabaseUsageSink({
    fetch: mock.fetch,
    env: env({
      SUPABASE_URL: "https://ref.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "eyJlegacy",
    }),
  });

  await sink(ROW);

  assertEquals(mock.requests[0].headers.get("apikey"), "eyJlegacy");
  assertEquals(
    mock.requests[0].headers.get("authorization"),
    "Bearer eyJlegacy",
  );
});

Deno.test("default sink: a failed insert or missing config throws", async () => {
  const mock = mockFetch([
    new Response('{"message":"relation does not exist"}', { status: 404 }),
  ]);
  const failing = supabaseUsageSink({
    fetch: mock.fetch,
    env: env({
      SUPABASE_URL: "https://ref.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "eyJx",
    }),
  });
  await assertRejects(() => failing(ROW), Error, "HTTP 404");

  const unconfigured = supabaseUsageSink({ fetch: mock.fetch, env: env({}) });
  await assertRejects(() => unconfigured(ROW), Error, "missing");
});

Deno.test("secret keys: the default new key first, then the others, then the legacy key", () => {
  assertEquals(
    secretKeys(env({
      SUPABASE_SECRET_KEYS: '{"backup":"sb_secret_b","default":"sb_secret_a"}',
      SUPABASE_SERVICE_ROLE_KEY: "eyJlegacy",
    })),
    ["sb_secret_a", "sb_secret_b", "eyJlegacy"],
  );
  assertEquals(
    secretKeys(
      env({
        SUPABASE_SECRET_KEYS: "not json",
        SUPABASE_SERVICE_ROLE_KEY: "eyJx",
      }),
    ),
    ["eyJx"],
  );
  assertEquals(secretKeys(env({})), []);
});
