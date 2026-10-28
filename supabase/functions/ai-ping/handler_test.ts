import { assertEquals } from "jsr:@std/assert@^1";
import { completion, memorySink, mockFetch } from "../_shared/ai/testing.ts";
import { handlePing } from "./handler.ts";

const KEYS = ["sb_secret_abc", "eyJlegacy"];
const PONG = JSON.stringify({ ok: true, greeting: "Salut, echipa Merinde!" });

function ping(headers: Record<string, string>, body?: string) {
  return new Request("http://localhost/ai-ping", {
    method: "POST",
    headers,
    body,
  });
}

function deps(...replies: Response[]) {
  const mock = mockFetch(replies);
  const usage = memorySink();
  return {
    requests: mock.requests,
    rows: usage.rows,
    deps: {
      secretKeys: KEYS,
      ai: { fetch: mock.fetch, apiKey: "test-key", usageSink: usage.sink },
    },
  };
}

Deno.test("ai-ping: callers without a secret key get 401 and spend nothing", async () => {
  const { deps: d, requests } = deps();
  for (
    const headers of [
      {},
      { apikey: "sb_publishable_xyz" },
      { authorization: "Bearer eyJanon" },
      { apikey: "sb_secret_ab" },
    ] as Record<string, string>[]
  ) {
    const res = await handlePing(ping(headers), d);
    assertEquals(res.status, 401);
    await res.body?.cancel();
  }
  assertEquals(requests.length, 0);
});

Deno.test("ai-ping: with a secret key it makes one minimal call and reports it", async () => {
  const { deps: d, requests, rows } = deps(
    completion(PONG, { promptTokens: 60, completionTokens: 40 }),
  );

  const res = await handlePing(
    ping({ apikey: "sb_secret_abc" }, '{"locale":"ro"}'),
    d,
  );

  assertEquals(res.status, 200);
  assertEquals(await res.json(), {
    ok: true,
    greeting: "Salut, echipa Merinde!",
    model: "muse-spark-1.3",
    attempts: 1,
    usage: { prompt_tokens: 60, completion_tokens: 40 },
  });
  const body = requests[0].body as {
    reasoning_effort: string;
    messages: { content: string }[];
  };
  assertEquals(body.reasoning_effort, "minimal");
  assertEquals(body.messages[0].content.includes("Romanian (ro)"), true);
  assertEquals(rows, [{
    household_id: null,
    function: "ai-ping",
    model: "muse-spark-1.3",
    prompt_tokens: 60,
    completion_tokens: 40,
  }]);
});

Deno.test("ai-ping: the legacy service_role key works as a bearer token, locale defaults to en", async () => {
  const { deps: d, requests } = deps(completion(PONG));
  const res = await handlePing(ping({ authorization: "Bearer eyJlegacy" }), d);
  assertEquals(res.status, 200);
  await res.body?.cancel();
  const body = requests[0].body as { messages: { content: string }[] };
  assertEquals(body.messages[0].content.includes("English (en)"), true);
});

Deno.test("ai-ping: errors map to status codes without leaking upstream details", async () => {
  const bad = deps();
  const badJson = await handlePing(
    ping({ apikey: "sb_secret_abc" }, "{"),
    bad.deps,
  );
  assertEquals(badJson.status, 400);
  await badJson.body?.cancel();

  const upstream = deps(
    new Response('{"error":"invalid api key"}', { status: 401 }),
  );
  const res = await handlePing(
    ping({ apikey: "sb_secret_abc" }),
    upstream.deps,
  );
  assertEquals(res.status, 502);
  assertEquals(await res.json(), { error: "upstream" });

  const invalid = deps(completion("{}"), completion("{}"));
  const res2 = await handlePing(
    ping({ apikey: "sb_secret_abc" }),
    invalid.deps,
  );
  assertEquals(res2.status, 502);
  assertEquals(await res2.json(), { error: "invalid_output" });
});
