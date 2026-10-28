import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "jsr:@std/assert@^1";
import { type AiDeps, AiError, schemaProblems } from "../mod.ts";
import { completion, memorySink, mockFetch } from "../testing.ts";
import {
  buildLabelReadCall,
  LABEL_READ_SCHEMA,
  LABEL_READ_TASK,
  type LabelNutrition,
  type LabelReadInput,
  type LabelReadResult,
  MAX_LABEL_PHOTOS,
  normaliseLabel,
  runLabelRead,
} from "./label-read.ts";

const TODAY = "2026-10-28";
const PHOTO = {
  type: "image" as const,
  base64: "/9j/4AAQSkZJRg",
  mimeType: "image/jpeg" as const,
};
const INPUT: LabelReadInput = {
  locale: "ro",
  householdId: "hh-1",
  images: [PHOTO],
  today: TODAY,
};

const NUTRITION: LabelNutrition = {
  per: "100g",
  kcal: 60,
  fat: 3.5,
  carbs: 3.9,
  sugars: 3.9,
  protein: 3.1,
  salt: 0.1,
};

function result(overrides: Partial<LabelReadResult> = {}): LabelReadResult {
  return {
    expiry: {
      expires_on: "2026-11-14",
      kind: "best_before",
      raw_text: "A se consuma de preferință înainte de 14.11.2026",
    },
    nutrition: NUTRITION,
    ...overrides,
  };
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

interface Body {
  model: string;
  messages: { role: string; content: string | Record<string, unknown>[] }[];
  response_format: { json_schema: { name: string; strict: boolean } };
  reasoning_effort?: string;
  max_tokens?: number;
}

Deno.test("the schema passes the gateway's strict-mode rules", () => {
  assertEquals(schemaProblems(LABEL_READ_SCHEMA), []);
});

Deno.test("valid output: expiry and nutrition come back after one Spark 1.3 call with the photo", async () => {
  const { deps, requests, rows } = setup(completion(JSON.stringify(result())));

  const out = await runLabelRead(INPUT, deps);

  assertEquals(out.model, "muse-spark-1.3");
  assertEquals(out.attempts, 1);
  assertEquals(out.data, result());
  const body = requests[0].body as Body;
  assertEquals(body.model, "muse-spark-1.3");
  assertEquals(body.response_format.json_schema.name, "label-read");
  assertEquals(body.response_format.json_schema.strict, true);
  assertEquals(body.reasoning_effort, "low");
  assertEquals(body.max_tokens, LABEL_READ_TASK.maxTokens);
  const user = body.messages[1].content as Record<string, unknown>[];
  assertEquals(user.map((p) => p.type), ["text", "image_url"]);
  assertStringIncludes(user[0].text as string, "expiry date and the nutrition");
  assertEquals(
    (user[1].image_url as { url: string }).url,
    "data:image/jpeg;base64,/9j/4AAQSkZJRg",
  );
  assertEquals(rows.length, 1);
  assertEquals(rows[0].function, "label-read");
  assertEquals(rows[0].household_id, "hh-1");
});

Deno.test("a photo with only a date, or only a table, gives null for the other part", async () => {
  const { deps } = setup(
    completion(JSON.stringify(result({ nutrition: null }))),
    completion(JSON.stringify(result({ expiry: null }))),
    completion(JSON.stringify({ expiry: null, nutrition: null })),
  );

  assertEquals((await runLabelRead(INPUT, deps)).data.nutrition, null);
  assertEquals((await runLabelRead(INPUT, deps)).data.expiry, null);
  assertEquals((await runLabelRead(INPUT, deps)).data, {
    expiry: null,
    nutrition: null,
  });
});

Deno.test("locale: the system prompt names the language; the fixed part doesn't change", async () => {
  const { deps, requests } = setup(
    completion(JSON.stringify(result())),
    completion(JSON.stringify(result())),
  );

  await runLabelRead(INPUT, deps);
  await runLabelRead({ ...INPUT, locale: "en-GB", focus: "expiry" }, deps);

  const [ro, en] = requests.map((r) =>
    (r.body as Body).messages[0].content as string
  );
  assertStringIncludes(ro, "Romanian (ro)");
  assertStringIncludes(en, "British English (en-GB)");
  assert(ro.startsWith(LABEL_READ_TASK.system));
  assert(en.startsWith(LABEL_READ_TASK.system));
  // The Romanian wording the issue asks for is in the instructions.
  assertStringIncludes(ro, "A se consuma de preferință înainte de");
  assertStringIncludes(ro, "Expiră la");
  assertStringIncludes(ro, "Never read a date month first");
});

Deno.test("schema rejection: an invalid first reply is retried once", async () => {
  const bad = result({
    expiry: { expires_on: "14.11.2026", kind: "best_before", raw_text: "EXP" },
  });
  const { deps, requests, rows } = setup(
    completion(JSON.stringify(bad)),
    completion(JSON.stringify(result())),
  );

  const out = await runLabelRead(INPUT, deps);

  assertEquals(out.attempts, 2);
  assertEquals(out.data.expiry?.expires_on, "2026-11-14");
  assertEquals(requests.length, 2);
  assertEquals(rows.length, 2);
});

Deno.test("schema rejection: wrong shapes twice end in invalid_output", async () => {
  const expiry = result().expiry!;
  const cases: unknown[] = [
    result({ expiry: { ...expiry, expires_on: "11/2026" } }),
    result({ expiry: { ...expiry, expires_on: "2026-02-30" } }),
    result({ expiry: { ...expiry, kind: "expired" as never } }),
    result({ expiry: { ...expiry, raw_text: "" } }),
    result({ nutrition: { ...NUTRITION, per: "100 g" as never } }),
    result({ nutrition: { ...NUTRITION, fat: -1 } }),
    result({ nutrition: { ...NUTRITION, kcal: "60" as never } }),
    result({ nutrition: { per: "100g", kcal: 60 } as never }),
    { ...result(), best_before: "2026-11-14" },
    { expiry: null },
  ];
  for (const bad of cases) {
    const json = JSON.stringify(bad);
    const { deps } = setup(completion(json), completion(json));
    const err = await assertRejects(() => runLabelRead(INPUT, deps), AiError);
    assertEquals(err.code, "invalid_output", json.slice(0, 80));
  }
});

Deno.test("focus: the prompt says what to read, and the other part is dropped from the result", async () => {
  const { deps, requests } = setup(
    completion(JSON.stringify(result())),
    completion(JSON.stringify(result())),
  );

  const expiryOnly = await runLabelRead({ ...INPUT, focus: "expiry" }, deps);
  const nutritionOnly = await runLabelRead(
    { ...INPUT, focus: "nutrition" },
    deps,
  );

  assertEquals(expiryOnly.data.nutrition, null);
  assertEquals(expiryOnly.data.expiry?.expires_on, "2026-11-14");
  assertEquals(nutritionOnly.data.expiry, null);
  assertEquals(nutritionOnly.data.nutrition, NUTRITION);
  const texts = requests.map((r) =>
    ((r.body as Body).messages[1].content as { text?: string }[])[0].text
  );
  assertStringIncludes(texts[0]!, "Read only the expiry date");
  assertStringIncludes(texts[1]!, "Read only the nutrition table");
});

Deno.test("expiry: dates that can't be right are dropped", () => {
  const expiry = (expires_on: string) => ({
    expiry: { expires_on, kind: "unknown" as const, raw_text: " EXP  x " },
    nutrition: null,
  });
  const read = (date: string) =>
    normaliseLabel(expiry(date), TODAY, "both").expiry?.expires_on ?? null;

  assertEquals(read("2026-11-14"), "2026-11-14");
  // Passed recently: kept, the app asks "Use it anyway?".
  assertEquals(read("2026-10-27"), "2026-10-27");
  assertEquals(read("2025-10-28"), "2025-10-28");
  // A misread year, or a production date.
  assertEquals(read("2025-10-01"), null);
  assertEquals(read("2018-03-01"), null);
  // About ten years ahead is the limit.
  assertEquals(read("2036-01-01"), "2036-01-01");
  assertEquals(read("2037-01-01"), null);
  assertEquals(
    normaliseLabel(expiry("2026-11-14"), TODAY, "both").expiry?.raw_text,
    "EXP x",
  );
});

Deno.test("nutrition: impossible tables are dropped whole, plausible ones are rounded", () => {
  const table = (change: Partial<LabelNutrition>) =>
    normaliseLabel(
      result({ expiry: null, nutrition: { ...NUTRITION, ...change } }),
      TODAY,
      "both",
    ).nutrition;

  assertEquals(table({})?.protein, 3.1);
  assertEquals(table({ kcal: 61.2345 })?.kcal, 61.23);
  // Only some values printed is fine.
  assertEquals(
    table({ sugars: null, salt: null, protein: null })?.carbs,
    3.9,
  );
  // kJ read as kcal.
  assertEquals(table({ kcal: 1650 }), null);
  assertEquals(table({ fat: 150 }), null);
  assertEquals(table({ salt: 120 }), null);
  assertEquals(table({ sugars: 20, carbs: 10 }), null);
  assertEquals(table({ fat: 60, carbs: 30, protein: 20 }), null);
  assertEquals(table({ kcal: Number.NaN }), null);
  // Sugars within rounding of carbs are fine.
  assertEquals(table({ sugars: 4.2, carbs: 3.9 })?.sugars, 4.2);
  assertEquals(
    table({
      kcal: null,
      fat: null,
      carbs: null,
      sugars: null,
      protein: null,
      salt: null,
    }),
    null,
  );
  // Drinks: per 100 ml with up to 900 kcal (oil) is allowed.
  assertEquals(
    table({
      per: "100ml",
      kcal: 828,
      fat: 91.9,
      carbs: 0,
      sugars: 0,
      protein: 0,
      salt: 0,
    })?.kcal,
    828,
  );
});

Deno.test("input: an unusable request is a bad_request and nothing is sent", async () => {
  const { deps, requests } = setup();
  const bad: Partial<LabelReadInput>[] = [
    { images: [] },
    { images: Array(MAX_LABEL_PHOTOS + 1).fill(PHOTO) },
    { images: [{ type: "audio", base64: "AAAA", format: "wav" } as never] },
    { images: [{ ...PHOTO, mimeType: "image/heic" as never }] },
    { today: "tomorrow" },
    { focus: "everything" as never },
    { locale: "not a locale" },
  ];
  for (const change of bad) {
    const err = await assertRejects(
      () => runLabelRead({ ...INPUT, ...change }, deps),
      AiError,
    );
    assertEquals(err.code, "bad_request", JSON.stringify(change).slice(0, 80));
  }
  assertEquals(requests.length, 0);
  assertEquals(
    (buildLabelReadCall({
      ...INPUT,
      images: Array(MAX_LABEL_PHOTOS).fill(PHOTO),
    }).input as unknown[]).length,
    MAX_LABEL_PHOTOS + 1,
  );
});
