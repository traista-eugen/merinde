import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "jsr:@std/assert@^1";
import {
  type AiDeps,
  AiError,
  type JsonSchema,
  schemaProblems,
} from "../mod.ts";
import { completion, memorySink, mockFetch } from "../testing.ts";
import {
  buildReceiptParseCall,
  type CandidateProduct,
  MAX_CANDIDATES,
  MAX_RECEIPT_PHOTOS,
  normaliseReceipt,
  RECEIPT_PARSE_SCHEMA,
  RECEIPT_PARSE_TASK,
  type ReceiptLine,
  type ReceiptParseInput,
  type ReceiptParseResult,
  runReceiptParse,
} from "./receipt-parse.ts";

const TODAY = "2026-10-28";
const PHOTO = {
  type: "image" as const,
  base64: "/9j/4AAQSkZJRg",
  mimeType: "image/jpeg" as const,
};
const GARLIC: CandidateProduct = {
  id: "p-garlic",
  name: "Garlic",
  brand: null,
};
const SOUR_CREAM: CandidateProduct = {
  id: "p-cream",
  name: "Sour cream 20%",
  brand: "Napolact",
};
const INPUT: ReceiptParseInput = {
  locale: "ro",
  householdId: "hh-1",
  images: [PHOTO],
  candidates: [GARLIC, SOUR_CREAM],
  today: TODAY,
};

function line(overrides: Partial<ReceiptLine> = {}): ReceiptLine {
  return {
    raw_text: "GARL 250G 4,99 B",
    name: "Garlic",
    quantity: 1,
    unit: "piece",
    unit_price: 4.99,
    regular_price: 4.99,
    paid_price: 4.99,
    discount: null,
    discount_label: null,
    loyalty_card_needed: false,
    pack_size: { amount: 250, unit: "g" },
    is_food: true,
    product_id: "p-garlic",
    new_product_name: null,
    uncertain: false,
    ...overrides,
  };
}

function receipt(
  overrides: Partial<ReceiptParseResult> = {},
): ReceiptParseResult {
  return {
    is_receipt: true,
    shop: { chain: "Lidl", branch: "Calea Moșilor" },
    date: "2026-10-27",
    time: "18:42",
    currency: "RON",
    total: 10.28,
    lines: [
      line(),
      line({
        raw_text: "SMANTANA 20% 400G 8,29 A",
        name: "Sour cream",
        regular_price: 8.29,
        unit_price: 8.29,
        paid_price: 5.29,
        discount: 3,
        discount_label: "Lidl Plus",
        loyalty_card_needed: true,
        pack_size: { amount: 400, unit: "g" },
        product_id: "p-cream",
      }),
    ],
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

function propertyNames(schema: JsonSchema): string[] {
  return [
    ...Object.keys(schema.properties ?? {}),
    ...Object.values(schema.properties ?? {}).flatMap(propertyNames),
    ...(schema.items ? propertyNames(schema.items) : []),
  ];
}

Deno.test("the schema passes the gateway's strict-mode rules", () => {
  assertEquals(schemaProblems(RECEIPT_PARSE_SCHEMA), []);
});

Deno.test("the schema has no field that could hold a card number, loyalty id or name", () => {
  const names = propertyNames(RECEIPT_PARSE_SCHEMA);
  assertEquals(
    names.filter((n) =>
      /card|loyalty|customer|cashier|client|iban|phone|email/i.test(n)
    ),
    ["loyalty_card_needed"],
  );
  assertEquals(
    (RECEIPT_PARSE_SCHEMA.properties!.lines.items!.properties!
      .loyalty_card_needed as JsonSchema).type,
    "boolean",
  );
});

Deno.test("valid output: header, lines and discount come back after one Spark 1.3 call", async () => {
  const { deps, requests, rows } = setup(completion(JSON.stringify(receipt())));

  const result = await runReceiptParse(INPUT, deps);

  assertEquals(result.model, "muse-spark-1.3");
  assertEquals(result.attempts, 1);
  assertEquals(result.data.shop, { chain: "Lidl", branch: "Calea Moșilor" });
  assertEquals(result.data.date, "2026-10-27");
  assertEquals(result.data.total, 10.28);
  assertEquals(result.data.lines.length, 2);
  const [garlic, cream] = result.data.lines;
  assertEquals(garlic.product_id, "p-garlic");
  assertEquals(garlic.new_product_name, null);
  assertEquals(garlic.pack_size, { amount: 250, unit: "g" });
  // The discount stays on its item (#41).
  assertEquals(
    [
      cream.regular_price,
      cream.discount,
      cream.paid_price,
      cream.discount_label,
      cream.loyalty_card_needed,
      cream.uncertain,
    ],
    [8.29, 3, 5.29, "Lidl Plus", true, false],
  );

  const body = requests[0].body as Body;
  assertEquals(body.model, "muse-spark-1.3");
  assertEquals(body.response_format.json_schema.name, "receipt-parse");
  assertEquals(body.response_format.json_schema.strict, true);
  assertEquals(body.reasoning_effort, "medium");
  assertEquals(body.max_tokens, RECEIPT_PARSE_TASK.maxTokens);
  assertEquals(rows.length, 1);
  assertEquals(rows[0].function, "receipt-parse");
  assertEquals(rows[0].household_id, "hh-1");
});

Deno.test("the request carries today's date, the candidates and every photo", async () => {
  const { deps, requests } = setup(completion(JSON.stringify(receipt())));

  await runReceiptParse({
    ...INPUT,
    images: [PHOTO, { ...PHOTO, mimeType: "image/png" }],
  }, deps);

  const user = (requests[0].body as Body).messages[1].content as Record<
    string,
    unknown
  >[];
  assertEquals(user.map((part) => part.type), [
    "text",
    "image_url",
    "image_url",
  ]);
  const text = user[0].text as string;
  assertStringIncludes(text, "Today is 2026-10-28.");
  assertStringIncludes(
    text,
    JSON.stringify([
      { id: "p-garlic", name: "Garlic" },
      { id: "p-cream", name: "Sour cream 20%", brand: "Napolact" },
    ]),
  );
  assertEquals(
    (user[1].image_url as { url: string }).url,
    "data:image/jpeg;base64,/9j/4AAQSkZJRg",
  );
  assertStringIncludes(
    (user[2].image_url as { url: string }).url,
    "data:image/png;base64,",
  );
});

Deno.test("no candidates: the prompt says every line is a new product", () => {
  const call = buildReceiptParseCall({ ...INPUT, candidates: [] });
  const parts = call.input as { type: string; text?: string }[];
  assertStringIncludes(parts[0].text!, "no candidate products");
});

Deno.test("locale: the system prompt names the language; the fixed part and the privacy rule are always there", async () => {
  const { deps, requests } = setup(
    completion(JSON.stringify(receipt())),
    completion(JSON.stringify(receipt())),
  );

  await runReceiptParse(INPUT, deps);
  await runReceiptParse({ ...INPUT, locale: "en_GB", candidates: [] }, deps);

  const [ro, en] = requests.map((r) =>
    (r.body as Body).messages[0].content as string
  );
  assertStringIncludes(ro, "Romanian (ro)");
  assertStringIncludes(en, "British English (en-GB)");
  for (const system of [ro, en]) {
    assert(system.startsWith(RECEIPT_PARSE_TASK.system));
    assertStringIncludes(system, "Never put personal data in any field");
    assertStringIncludes(system, "no payment card numbers");
    assertStringIncludes(system, "no loyalty-card or customer numbers");
    assertStringIncludes(system, "no names of the cashier or the customer");
    // raw_text must survive the language instruction untranslated.
    assertStringIncludes(system, "Never translate, expand or correct it");
  }
});

Deno.test("schema rejection: an invalid first reply is retried once", async () => {
  const bad = receipt();
  bad.lines[0].paid_price = -4.99;
  const { deps, requests, rows } = setup(
    completion(JSON.stringify(bad)),
    completion(JSON.stringify(receipt())),
  );

  const result = await runReceiptParse(INPUT, deps);

  assertEquals(result.attempts, 2);
  assertEquals(result.data.lines.length, 2);
  assertEquals(requests.length, 2);
  assertEquals(rows.length, 2);
});

Deno.test("schema rejection: wrong shapes twice end in invalid_output", async () => {
  const withLine = (change: Partial<ReceiptLine>) =>
    receipt({ lines: [line(change)] });
  const cases: unknown[] = [
    receipt({ currency: "lei" }),
    receipt({ time: "6:42 pm" }),
    receipt({ date: "27.10.2026" }),
    receipt({ total: -1 }),
    receipt({ shop: { chain: "Lidl" } as never }),
    withLine({ unit: "buc" as never }),
    withLine({ pack_size: { amount: 250 } as never }),
    withLine({ raw_text: "" }),
    withLine({ uncertain: "maybe" as never }),
    { ...receipt(), card_number: "4111" },
    { ...receipt(), lines: [{ ...line(), cashier: "Ana" }] },
    { ...receipt(), lines: "none" },
  ];
  for (const bad of cases) {
    const json = JSON.stringify(bad);
    const { deps } = setup(completion(json), completion(json));
    const err = await assertRejects(
      () => runReceiptParse(INPUT, deps),
      AiError,
    );
    assertEquals(err.code, "invalid_output", json.slice(0, 80));
  }
});

Deno.test("personal data in the model's reply never reaches the result", async () => {
  const dirty = receipt({
    shop: { chain: "Mega Image", branch: "Dorobanți, tel 0721 234 567" },
    lines: [
      line(),
      // Lines about the payment card, the loyalty card, the cashier and a person.
      line({
        raw_text: "CARD 4111 1111 1111 1111 49,98",
        name: "Card payment",
        paid_price: 49.98,
        product_id: null,
        new_product_name: "Card payment",
      }),
      line({
        raw_text: "Card client: 9876 5432 1098",
        name: "Loyalty card",
        paid_price: 0,
        product_id: null,
      }),
      line({
        raw_text: "Casier: Ioana Popescu",
        name: "Ioana Popescu",
        paid_price: 0,
        product_id: null,
      }),
      // A product line that mentions the program but not its number is kept,
      // and personal bits in its other fields are cleaned.
      line({
        raw_text: "SMANTANA 20% 400G 8,29 A",
        name: "Sour cream",
        regular_price: 8.29,
        paid_price: 5.29,
        discount: 3,
        discount_label: "Lidl Plus 123456789",
        loyalty_card_needed: true,
        product_id: null,
        new_product_name: "Smântână ana.pop@example.com",
      }),
    ],
  });
  const { deps } = setup(completion(JSON.stringify(dirty)));

  const result = await runReceiptParse(INPUT, deps);

  assertEquals(result.data.lines.map((l) => l.raw_text), [
    "GARL 250G 4,99 B",
    "SMANTANA 20% 400G 8,29 A",
  ]);
  assertEquals(result.data.shop.branch, "Dorobanți, tel");
  const cream = result.data.lines[1];
  assertEquals(cream.discount_label, null);
  assertEquals(cream.new_product_name, "Smântână");
  const everything = JSON.stringify(result.data);
  for (
    const secret of [
      "4111",
      "9876",
      "Popescu",
      "Ioana",
      "0721",
      "ana.pop",
      "123456789",
    ]
  ) {
    assert(!everything.includes(secret), `${secret} leaked: ${everything}`);
  }
});

Deno.test("matching: only candidate ids are kept; the rest become proposed new products", () => {
  const out = normaliseReceipt(
    receipt({
      lines: [
        line({ product_id: "p-garlic", new_product_name: "ignored" }),
        line({
          raw_text: "BANANE 1,2KG",
          name: "Bananas",
          product_id: "made-up-id",
          new_product_name: null,
        }),
        line({
          raw_text: "PAINE ALBA",
          name: "White bread",
          product_id: null,
          new_product_name: "Pâine albă",
        }),
        line({
          raw_text: "LAPTE 1L",
          name: "Milk",
          product_id: null,
          new_product_name: null,
        }),
      ],
    }),
    { today: TODAY, candidateIds: new Set(["p-garlic"]) },
  );

  assertEquals(
    out.lines.map((l) => [l.product_id, l.new_product_name, l.uncertain]),
    [
      ["p-garlic", null, false],
      [null, "Bananas", true], // invented id: propose new, flag for review
      [null, "Pâine albă", false],
      [null, "Milk", false], // neither set: fall back to the plain name
    ],
  );
});

Deno.test("prices: money is rounded and a line whose prices don't add up is flagged", () => {
  const out = normaliseReceipt(
    receipt({
      total: 10.279999999999999,
      lines: [
        line({
          paid_price: 5.290000000000001,
          regular_price: 8.29,
          discount: 3,
        }),
        line({
          raw_text: "A",
          name: "A",
          regular_price: 8.29,
          discount: 3,
          paid_price: 8.29,
        }),
        line({
          raw_text: "B",
          name: "B",
          regular_price: 5,
          discount: null,
          paid_price: 4,
        }),
        line({
          raw_text: "C",
          name: "C",
          regular_price: null,
          discount: null,
          paid_price: 4,
        }),
        line({
          raw_text: "D",
          name: "D",
          discount: 0,
          discount_label: "Promo",
        }),
      ],
    }),
    { today: TODAY, candidateIds: new Set(["p-garlic"]) },
  );

  assertEquals(out.total, 10.28);
  assertEquals(out.lines.map((l) => l.paid_price), [5.29, 8.29, 4, 4, 4.99]);
  assertEquals(out.lines.map((l) => l.uncertain), [
    false,
    true,
    true,
    false,
    false,
  ]);
  // A zero discount is no discount, and loses its label.
  assertEquals([out.lines[4].discount, out.lines[4].discount_label], [
    null,
    null,
  ]);
});

Deno.test("header: a purchase date in the future is dropped, other fields stay", () => {
  const out = normaliseReceipt(
    receipt({ date: "2026-10-29" }),
    { today: TODAY, candidateIds: new Set() },
  );
  assertEquals(out.date, null);
  assertEquals([out.time, out.currency, out.shop.chain], [
    "18:42",
    "RON",
    "Lidl",
  ]);
  assertEquals(
    normaliseReceipt(receipt({ date: "2026-10-28" }), {
      today: TODAY,
      candidateIds: new Set(),
    }).date,
    "2026-10-28",
  );
});

Deno.test("not a receipt: everything is emptied, whatever else the model returned", async () => {
  const junk = receipt({ is_receipt: false });
  const { deps } = setup(completion(JSON.stringify(junk)));

  const result = await runReceiptParse(INPUT, deps);

  assertEquals(result.data, {
    is_receipt: false,
    shop: { chain: null, branch: null },
    date: null,
    time: null,
    currency: null,
    total: null,
    lines: [],
  });
});

Deno.test("input: an unusable request is a bad_request and nothing is sent", async () => {
  const { deps, requests } = setup();
  const many = (n: number): CandidateProduct[] =>
    Array.from(
      { length: n },
      (_, i) => ({ id: `p${i}`, name: `Product ${i}` }),
    );
  const bad: Partial<ReceiptParseInput>[] = [
    { images: [] },
    { images: Array(MAX_RECEIPT_PHOTOS + 1).fill(PHOTO) },
    { images: [{ type: "text", text: "hi" } as never] },
    { images: [{ ...PHOTO, mimeType: "image/heic" as never }] },
    { today: "2026-13-01" },
    { locale: "" },
    { candidates: many(MAX_CANDIDATES + 1) },
    { candidates: [{ id: "", name: "x" }] },
    { candidates: [{ id: "a", name: "  " }] },
    { candidates: "all" as never },
  ];
  for (const change of bad) {
    const err = await assertRejects(
      () => runReceiptParse({ ...INPUT, ...change }, deps),
      AiError,
    );
    assertEquals(err.code, "bad_request", JSON.stringify(change).slice(0, 80));
  }
  assertEquals(requests.length, 0);

  // At the limits, and with a very long candidate name, the call is built.
  const call = buildReceiptParseCall({
    ...INPUT,
    images: Array(MAX_RECEIPT_PHOTOS).fill(PHOTO),
    candidates: [...many(MAX_CANDIDATES - 1), {
      id: "long",
      name: "x".repeat(500),
    }],
  });
  const text = (call.input as { text?: string }[])[0].text!;
  assertStringIncludes(text, JSON.stringify("x".repeat(120)));
  assert(!text.includes("x".repeat(121)));
});
