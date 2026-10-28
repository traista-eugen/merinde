import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "jsr:@std/assert@^1";
import { AiError } from "../errors.ts";
import { schemaProblems } from "../schema.ts";
import {
  aiDeps,
  EATERS,
  ingredient,
  messages,
  STORED_PIE,
  TODAY,
} from "./recipe-fixtures.ts";
import {
  RECIPE_VARIANT_TASK,
  type RecipeVariantInput,
  runRecipeVariant,
} from "./recipe-variant.ts";

const INPUT: RecipeVariantInput = {
  locale: "ro",
  recipe: {
    title: "Plăcintă cu spanac",
    variantName: "Original",
    content: STORED_PIE,
  },
  request: "fără ouă",
  eaters: [{ name: "Ioana", allergies: [] }],
  today: TODAY,
};

const NO_EGGS = {
  variant_name: "Fără ouă",
  change_note: "Ouăle sunt înlocuite cu iaurt.",
  servings: 4,
  total_minutes: 50,
  ingredients: [
    ingredient("spanac", { quantity: 500 }),
    ingredient("iaurt", { quantity: 150, allergens: ["milk"] }),
    ingredient("telemea", { quantity: 200, allergens: ["milk"] }),
  ],
  steps: ["Amestecă totul.", "Coace 40 de minute."],
};

Deno.test("recipe-variant: a strict schema on muse-spark-1.3", () => {
  assertEquals(schemaProblems(RECIPE_VARIANT_TASK.schema), []);
  assertEquals(RECIPE_VARIANT_TASK.model, "muse-spark-1.3");
});

Deno.test("recipe-variant: returns a named variant and keeps known product ids", async () => {
  const { deps, requests } = aiDeps(NO_EGGS);

  const result = await runRecipeVariant(INPUT, deps);

  assertEquals(result.variantName, "Fără ouă");
  assertEquals(result.changeNote, "Ouăle sunt înlocuite cu iaurt.");
  assertEquals(
    result.content.ingredients.map((i) => [i.name, i.product_id]),
    [["spanac", "prod-spinach"], ["iaurt", null], ["telemea", "prod-telemea"]],
  );
  assertEquals(result.allergyConflicts, []);
  const { system, user } = messages(requests[0]);
  assertStringIncludes(system, "Romanian (ro)");
  assertStringIncludes(user, "Wanted: fără ouă");
  assertStringIncludes(user, "Pantry: not used.");
});

Deno.test('recipe-variant: "Variant without them" sends the missing items', async () => {
  const { deps, requests } = aiDeps(NO_EGGS);
  await runRecipeVariant(
    { ...INPUT, request: undefined, missing: ["ouă", "telemea"] },
    deps,
  );
  const { user } = messages(requests[0]);
  assertStringIncludes(
    user,
    "Without: ouă, telemea. Replace them or leave them out.",
  );
});

Deno.test("recipe-variant: flags conflicts for the people eating", async () => {
  const { deps } = aiDeps(NO_EGGS);
  const result = await runRecipeVariant({ ...INPUT, eaters: EATERS }, deps);
  assertEquals(
    result.allergyConflicts.map((c) => [c.person, c.allergy, c.ingredient]),
    [["Mihai", "lactose", "iaurt"], ["Mihai", "lactose", "telemea"]],
  );
});

Deno.test("recipe-variant: a too-long name is retried, then rejected", async () => {
  const longName = { ...NO_EGGS, variant_name: "x".repeat(41) };
  const { deps, requests } = aiDeps(longName, longName);
  const err = await assertRejects(() => runRecipeVariant(INPUT, deps), AiError);
  assertEquals(err.code, "invalid_output");
  assertStringIncludes(err.message, "variant_name");
  assertEquals(requests.length, 2);
});

Deno.test("recipe-variant: needs a request or missing items", async () => {
  const { deps, requests } = aiDeps();
  for (
    const change of [{ request: undefined }, { request: " ", missing: [" "] }]
  ) {
    const err = await assertRejects(
      () => runRecipeVariant({ ...INPUT, ...change }, deps),
      AiError,
    );
    assertEquals(err.code, "bad_request");
  }
  assertEquals(requests.length, 0);
});
