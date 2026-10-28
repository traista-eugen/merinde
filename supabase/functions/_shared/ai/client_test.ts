import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
  assertThrows,
} from "jsr:@std/assert@^1";
import {
  type AiCall,
  type AiDeps,
  type AiTask,
  callAi,
  META_API_URL,
} from "./client.ts";
import { AiError } from "./errors.ts";
import { assertAllowedModel } from "./models.ts";
import { completion, memorySink, mockFetch } from "./testing.ts";

const TASK: AiTask = {
  name: "test-dish",
  system: "Suggest one dish.",
  schema: {
    type: "object",
    properties: {
      dish: { type: "string", minLength: 1 },
      cover: { type: "integer", minimum: 1, maximum: 6 },
      note: { type: ["string", "null"] },
    },
    required: ["dish", "cover", "note"],
    additionalProperties: false,
  },
};
const DISH = { dish: "Ciorbă de legume", cover: 3, note: null };
const VALID = JSON.stringify(DISH);
const CALL = { locale: "ro", input: "Something warm", householdId: "hh-1" };

interface Dish {
  dish: string;
  cover: number;
  note: string | null;
}

function setup(...replies: Parameters<typeof mockFetch>[0]) {
  const mock = mockFetch(replies);
  const usage = memorySink();
  const deps: AiDeps = {
    fetch: mock.fetch,
    apiKey: "test-key",
    usageSink: usage.sink,
  };
  return { deps, requests: mock.requests, rows: usage.rows };
}

async function rejectsWith(code: AiError["code"], fn: () => Promise<unknown>) {
  const err = await assertRejects(fn, AiError);
  assertEquals(err.code, code, err.message);
  return err;
}

Deno.test("valid reply: returns the data after one structured-output call", async () => {
  const { deps, requests } = setup(completion(VALID));

  const result = await callAi<Dish>(TASK, CALL, deps);

  assertEquals(result.data, DISH);
  assertEquals(result.model, "muse-spark-1.3");
  assertEquals(result.attempts, 1);
  assertEquals(requests.length, 1);
  const [request] = requests;
  assertEquals(request.url, META_API_URL);
  assertEquals(request.url, "https://api.meta.ai/v1/chat/completions");
  assertEquals(request.headers.get("authorization"), "Bearer test-key");
  const body = request.body as Record<string, unknown>;
  assertEquals(body.model, "muse-spark-1.3");
  assertEquals(body.response_format, {
    type: "json_schema",
    json_schema: { name: "test-dish", schema: TASK.schema, strict: true },
  });
  assertEquals(body.reasoning_effort, undefined);
  assertEquals(body.max_tokens, undefined);
});

Deno.test("locale: the system prompt names the app's language after the fixed instructions", async () => {
  const { deps, requests } = setup(completion(VALID), completion(VALID));

  await callAi(TASK, CALL, deps);
  await callAi(TASK, { ...CALL, locale: "en_GB" }, deps);

  const [ro, en] = requests.map((r) =>
    (r.body as { messages: { role: string; content: unknown }[] }).messages
  );
  assertEquals(ro[0].role, "system");
  assert((ro[0].content as string).startsWith("Suggest one dish.\n\n"));
  assertStringIncludes(ro[0].content as string, "Romanian (ro)");
  assertStringIncludes(en[0].content as string, "British English (en-GB)");
  assertEquals(ro[1], { role: "user", content: "Something warm" });
});

Deno.test("locale: an invalid tag is a bad request and nothing is sent", async () => {
  const { deps, requests } = setup();
  for (const locale of ["", "not a locale", 42 as unknown as string]) {
    await rejectsWith(
      "bad_request",
      () => callAi(TASK, { ...CALL, locale }, deps),
    );
  }
  assertEquals(requests.length, 0);
});

Deno.test("retry: an invalid first reply is retried once, then the valid one is returned", async () => {
  const { deps, requests } = setup(
    completion(JSON.stringify({ dish: "Sarmale", cover: 9, note: null })),
    completion(VALID),
  );

  const result = await callAi<Dish>(TASK, CALL, deps);

  assertEquals(result.data, DISH);
  assertEquals(result.attempts, 2);
  assertEquals(requests.length, 2);
  assertEquals(requests[1].body, requests[0].body);
});

Deno.test("retry: non-JSON, refused and empty replies are retried once", async () => {
  const replies = [
    completion("Sure! Here's a dish: soup"),
    Response.json({
      choices: [{
        message: { content: null, refusal: "No." },
        finish_reason: "stop",
      }],
    }),
    completion(""),
  ];
  for (const first of replies) {
    const { deps } = setup(first, completion(VALID));
    const result = await callAi(TASK, CALL, deps);
    assertEquals(result.attempts, 2);
  }
});

Deno.test("cut off at max_tokens: fails at once, since the same budget would be cut off again", async () => {
  const { deps, requests, rows } = setup(
    completion(VALID.slice(0, 20), { finishReason: "length" }),
    completion(VALID),
  );

  const err = await rejectsWith(
    "invalid_output",
    () => callAi({ ...TASK, maxTokens: 500 }, CALL, deps),
  );

  assertEquals(requests.length, 1);
  assertEquals(rows.length, 1);
  assertStringIncludes(err.message, "after 1 attempt:");
  assertStringIncludes(err.message, "max_tokens");
});

Deno.test("invalid twice: fails with invalid_output and says why", async () => {
  const { deps, requests } = setup(
    completion(JSON.stringify({ dish: "Sarmale", cover: 3 })),
    completion(
      JSON.stringify({ dish: "Sarmale", cover: 3, note: null, extra: 1 }),
    ),
  );

  const err = await rejectsWith(
    "invalid_output",
    () => callAi(TASK, CALL, deps),
  );

  assertEquals(requests.length, 2);
  assertStringIncludes(err.message, "test-dish");
  assertStringIncludes(err.message, "after 2 attempts");
  assertStringIncludes(err.message, 'unexpected property "extra"');
});

Deno.test("contributor tier: refused in code, before any request", async () => {
  const { deps, requests } = setup(completion(VALID));
  for (
    const model of [
      "muse-spark-1.3-contributor",
      "muse-spark-1.2-contributor",
      "MUSE-SPARK-1.3-CONTRIBUTOR",
      "muse-spark-1.4-contributor-preview",
    ]
  ) {
    await rejectsWith(
      "model_refused",
      () => callAi({ ...TASK, model }, CALL, deps),
    );
    for (const hasAudio of [false, true]) {
      assertThrows(
        () => assertAllowedModel(model, hasAudio),
        AiError,
        "contributor",
      );
    }
  }
  assertEquals(requests.length, 0);
});

Deno.test("allowlist: only 1.3 for text and images and only 1.2 for audio; anything else is a config error", async () => {
  const { deps, requests } = setup(completion(VALID), completion(VALID));
  const audio = [{
    type: "audio" as const,
    base64: "UklGRg==",
    format: "wav" as const,
  }];
  const image = [{ type: "image" as const, url: "https://example.com/r.jpg" }];
  const refused: [string, AiCall["input"]][] = [
    ["muse-spark-1.2", "Something warm"],
    ["muse-spark-1.2", image],
    ["muse-spark-1.3", audio],
    ["muse-wonder-1.0", "Something warm"],
    ["muse-image-1.0", image],
    ["muse-spark-1.4", "Something warm"],
    ["", "Something warm"],
  ];
  for (const [model, input] of refused) {
    await rejectsWith(
      "config",
      () => callAi({ ...TASK, model }, { ...CALL, input }, deps),
    );
  }
  assertEquals(requests.length, 0);

  await callAi({ ...TASK, model: "muse-spark-1.3" }, CALL, deps);
  await callAi(
    { ...TASK, model: "muse-spark-1.2" },
    { ...CALL, input: audio },
    deps,
  );
  assertEquals(requests.length, 2);
  assertAllowedModel("muse-spark-1.3", false);
  assertAllowedModel("muse-spark-1.2", true);
});

Deno.test("models: Spark 1.3 for text and images, 1.2 only when the input has audio", async () => {
  const { deps, requests } = setup(
    completion(VALID),
    completion(VALID),
    completion(VALID),
  );

  await callAi(TASK, CALL, deps);
  await callAi(TASK, {
    ...CALL,
    input: [{ type: "image", url: "https://example.com/receipt.jpg" }],
  }, deps);
  const audio = await callAi(TASK, {
    ...CALL,
    input: [{ type: "audio", base64: "UklGRg==", format: "wav" }],
  }, deps);

  assertEquals(
    requests.map((r) => (r.body as { model: string }).model),
    ["muse-spark-1.3", "muse-spark-1.3", "muse-spark-1.2"],
  );
  assertEquals(audio.model, "muse-spark-1.2");
});

Deno.test("images: sent as image_url parts, by https URL or as a base64 data URL", async () => {
  const { deps, requests } = setup(completion(VALID));

  await callAi(TASK, {
    ...CALL,
    input: [
      { type: "text", text: "Read this receipt" },
      {
        type: "image",
        url: "https://example.supabase.co/storage/v1/object/sign/r.jpg",
      },
      { type: "image", base64: "/9j/4AAQ", mimeType: "image/jpeg" },
    ],
  }, deps);

  const user =
    (requests[0].body as { messages: { content: unknown }[] }).messages[1];
  assertEquals(user.content, [
    { type: "text", text: "Read this receipt" },
    {
      type: "image_url",
      image_url: {
        url: "https://example.supabase.co/storage/v1/object/sign/r.jpg",
      },
    },
    {
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64,/9j/4AAQ" },
    },
  ]);
});

Deno.test("images: plain http, HEIC and too many images are bad requests", async () => {
  const { deps, requests } = setup();
  const image = { type: "image" as const, url: "https://example.com/a.jpg" };
  const inputs = [
    [{ type: "image" as const, url: "http://example.com/a.jpg" }],
    [{
      type: "image" as const,
      base64: "AAAA",
      mimeType: "image/heic" as "image/jpeg",
    }],
    Array(51).fill(image),
    [],
  ];
  for (const input of inputs) {
    await rejectsWith(
      "bad_request",
      () => callAi(TASK, { ...CALL, input }, deps),
    );
  }
  assertEquals(requests.length, 0);
});

Deno.test("usage: one ai_usage row per API call, retries included", async () => {
  const { deps, rows } = setup(
    completion("not json", { promptTokens: 1200, completionTokens: 300 }),
    completion(VALID, { promptTokens: 1200, completionTokens: 250 }),
  );

  const result = await callAi(TASK, CALL, deps);

  assertEquals(rows, [
    {
      household_id: "hh-1",
      function: "test-dish",
      model: "muse-spark-1.3",
      prompt_tokens: 1200,
      completion_tokens: 300,
    },
    {
      household_id: "hh-1",
      function: "test-dish",
      model: "muse-spark-1.3",
      prompt_tokens: 1200,
      completion_tokens: 250,
    },
  ]);
  assertEquals(result.usage, { prompt_tokens: 2400, completion_tokens: 550 });
});

Deno.test("usage: logged when both replies are invalid, and household_id defaults to null", async () => {
  const { deps, rows } = setup(completion("{}"), completion("{}"));

  await rejectsWith(
    "invalid_output",
    () => callAi(TASK, { locale: "en", input: "hi" }, deps),
  );

  assertEquals(rows.length, 2);
  assertEquals(rows[0].household_id, null);
});

Deno.test("usage: a failing sink doesn't fail the call", async () => {
  const mock = mockFetch([completion(VALID)]);
  const result = await callAi(TASK, CALL, {
    fetch: mock.fetch,
    apiKey: "test-key",
    usageSink: () => Promise.reject(new Error("ai_usage is missing")),
  });
  assertEquals(result.data, DISH);
});

Deno.test("usage: a sink that never answers doesn't hold up or lose the answer", async () => {
  const mock = mockFetch([completion("not json"), completion(VALID)]);
  const started = Date.now();
  const result = await callAi<Dish>(TASK, CALL, {
    fetch: mock.fetch,
    apiKey: "test-key",
    usageSink: () => new Promise<void>(() => {}),
    usageTimeoutMs: 20,
  });
  assertEquals(result.data, DISH);
  assertEquals(result.attempts, 2);
  assert(Date.now() - started < 1_000, "waited too long for the sink");
});

Deno.test("usage: a missing count is recorded as null, not 0", async () => {
  const { deps, rows } = setup(
    Response.json({
      choices: [{ message: { content: VALID }, finish_reason: "stop" }],
      usage: { prompt_tokens: 80 },
    }),
    Response.json({
      choices: [{ message: { content: VALID }, finish_reason: "stop" }],
    }),
  );

  const first = await callAi(TASK, CALL, deps);
  const second = await callAi(TASK, CALL, deps);

  assertEquals(
    rows.map((r) => [r.prompt_tokens, r.completion_tokens]),
    [[80, null], [null, null]],
  );
  assertEquals(first.usage, { prompt_tokens: 80, completion_tokens: null });
  assertEquals(second.usage, { prompt_tokens: null, completion_tokens: null });
});

Deno.test("config: maxTokens must be a positive integer; 0 isn't treated as unset", async () => {
  const { deps, requests } = setup();
  for (const maxTokens of [0, -1, 1.5, Number.NaN]) {
    const err = await rejectsWith(
      "config",
      () => callAi({ ...TASK, maxTokens }, CALL, deps),
    );
    assertStringIncludes(err.message, "maxTokens");
  }
  assertEquals(requests.length, 0);
});

Deno.test("config: a missing META_API_KEY fails before any request", async () => {
  const { deps, requests } = setup();
  await rejectsWith(
    "config",
    () => callAi(TASK, CALL, { ...deps, apiKey: "" }),
  );
  assertEquals(requests.length, 0);
});

Deno.test("config: a schema strict mode can't take is refused before any request", async () => {
  const { deps, requests } = setup();
  const loose: AiTask = {
    ...TASK,
    schema: { type: "object", properties: { dish: { type: "string" } } },
  };
  const err = await rejectsWith("config", () => callAi(loose, CALL, deps));
  assertStringIncludes(err.message, "additionalProperties");
  assertStringIncludes(err.message, "must be required");
  assertEquals(requests.length, 0);
});

Deno.test("request: reasoning effort and max_tokens are sent when the task sets them", async () => {
  const { deps, requests } = setup(completion(VALID));
  await callAi(
    { ...TASK, reasoningEffort: "low", maxTokens: 4000 },
    CALL,
    deps,
  );
  const body = requests[0].body as Record<string, unknown>;
  assertEquals(body.reasoning_effort, "low");
  assertEquals(body.max_tokens, 4000);
});

Deno.test("upstream: an HTTP error isn't retried and isn't logged as usage", async () => {
  const { deps, requests, rows } = setup(
    new Response('{"error":{"message":"rate limited"}}', { status: 429 }),
  );
  const err = await rejectsWith("upstream", () => callAi(TASK, CALL, deps));
  assertStringIncludes(err.message, "429");
  assertEquals(requests.length, 1);
  assertEquals(rows.length, 0);
});

Deno.test("timeout: a request that never answers fails with timeout", async () => {
  const { deps } = setup(({ signal }) =>
    new Promise<Response>((_, reject) => {
      signal?.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError")));
    })
  );
  await rejectsWith(
    "timeout",
    () => callAi(TASK, CALL, { ...deps, timeoutMs: 10 }),
  );
});
