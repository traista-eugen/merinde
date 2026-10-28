import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1";
import { type JsonSchema, schemaProblems, validate } from "./schema.ts";

const RECIPE: JsonSchema = {
  type: "object",
  properties: {
    title: { type: "string", minLength: 1, maxLength: 80 },
    cover: { type: "integer", minimum: 1, maximum: 6 },
    servings: { type: "number", minimum: 0 },
    expires_on: { type: ["string", "null"], format: "date" },
    unit: { type: "string", enum: ["g", "kg", "ml", "l", "piece"] },
    ingredients: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: {
            anyOf: [{ type: "number" }, {
              type: "string",
              pattern: "^to taste$",
            }],
          },
        },
        required: ["name", "quantity"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "cover", "servings", "expires_on", "unit", "ingredients"],
  additionalProperties: false,
};

const GOOD = {
  title: "Mămăligă",
  cover: 2,
  servings: 2.5,
  expires_on: "2026-11-04",
  unit: "g",
  ingredients: [{ name: "mălai", quantity: 250 }, {
    name: "sare",
    quantity: "to taste",
  }],
};

Deno.test("schema: a matching value has no errors", () => {
  assertEquals(schemaProblems(RECIPE), []);
  assertEquals(validate(RECIPE, GOOD), []);
  assertEquals(validate(RECIPE, { ...GOOD, expires_on: null }), []);
});

Deno.test("schema: each kind of mismatch is reported with its path", () => {
  const cases: [unknown, string][] = [
    [{ ...GOOD, title: "" }, "$.title: needs at least 1 characters"],
    [{ ...GOOD, title: "x".repeat(81) }, "$.title: allows at most 80"],
    [{ ...GOOD, cover: 7 }, "$.cover: must be at most 6"],
    [{ ...GOOD, cover: 2.5 }, "$.cover: expected integer, got number"],
    [{ ...GOOD, servings: "2" }, "$.servings: expected number, got string"],
    [{ ...GOOD, expires_on: "2026-02-30" }, "$.expires_on: must be a date"],
    [{ ...GOOD, unit: "cup" }, "$.unit: must be one of"],
    [{ ...GOOD, ingredients: [] }, "$.ingredients: needs at least 1 items"],
    [
      { ...GOOD, ingredients: [{ name: "x", quantity: "lots" }] },
      "$.ingredients[0].quantity: matches none",
    ],
    [
      { ...GOOD, ingredients: [{ name: "x" }] },
      '$.ingredients[0]: missing "quantity"',
    ],
    [{ ...GOOD, extra: true }, '$: unexpected property "extra"'],
    [[GOOD], "$: expected object, got array"],
    [null, "$: expected object, got null"],
  ];
  for (const [value, expected] of cases) {
    const errors = validate(RECIPE, value);
    assertStringIncludes(errors.join("\n"), expected);
  }
});

Deno.test("schema: prototype keys can't slip past additionalProperties", () => {
  for (const key of ["__proto__", "constructor", "toString"]) {
    const value = JSON.parse(
      `{"title":"x","cover":1,"servings":1,"expires_on":null,
      "unit":"g","ingredients":[{"name":"x","quantity":1}],"${key}":{}}`,
    );
    assertStringIncludes(
      validate(RECIPE, value).join(),
      `unexpected property "${key}"`,
    );
  }
});

Deno.test("schema: date-time format", () => {
  const schema: JsonSchema = { type: "string", format: "date-time" };
  assertEquals(validate(schema, "2026-11-04T21:00:00-05:00"), []);
  assertEquals(validate(schema, "2026-11-04T21:00:00.5Z"), []);
  assertEquals(validate(schema, "2026-11-04 21:00").length, 1);
});

Deno.test("schema: strict-mode and unsupported-keyword problems are listed", () => {
  const problems = schemaProblems({
    type: "object",
    properties: {
      a: { type: "string" },
      b: { type: "object", properties: {} },
      c: { type: "array" },
      d: { type: "string", format: "email" } as unknown as JsonSchema,
      e: { oneOf: [] } as unknown as JsonSchema,
      f: { type: "string", pattern: "(" },
    },
    required: ["b", "c", "d", "e", "f", "g"],
    additionalProperties: false,
  }).join("\n");
  for (
    const expected of [
      "$.a: must be required",
      "$.b: objects need additionalProperties: false",
      "$.c: arrays need items",
      '$.d: unsupported format "email"',
      '$.e: unsupported keyword "oneOf"',
      "$.e: needs a type",
      "$.f: invalid pattern",
      'required "g" isn\'t in properties',
    ]
  ) {
    assertStringIncludes(problems, expected);
  }
});

Deno.test("schema: the root must be a plain object, nested at most 10 levels", () => {
  assertStringIncludes(
    schemaProblems({ type: "array", items: { type: "string" } }).join(),
    "root",
  );
  assertStringIncludes(
    schemaProblems({ type: "object", anyOf: [], additionalProperties: false })
      .join(),
    "root",
  );

  let deep: JsonSchema = { type: "string" };
  for (let i = 0; i < 10; i++) {
    deep = {
      type: "object",
      properties: { x: deep },
      required: ["x"],
      additionalProperties: false,
    };
  }
  assertStringIncludes(schemaProblems(deep).join(), "nested deeper than 10");
  assertEquals(
    schemaProblems((deep.properties as Record<string, JsonSchema>).x),
    [],
  );
});
