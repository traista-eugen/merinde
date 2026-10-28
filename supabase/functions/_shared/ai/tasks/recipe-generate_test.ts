import {
  assert,
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
  PANTRY,
  SPINACH_PIE,
  TODAY,
} from "./recipe-fixtures.ts";
import {
  buildRecipeGeneratePrompt,
  RECIPE_GENERATE_TASK,
  type RecipeGenerateInput,
  runRecipeGenerate,
} from "./recipe-generate.ts";

const INPUT: RecipeGenerateInput = {
  locale: "ro",
  householdId: "hh-1",
  request: "plăcintă cu spanac",
  servings: 4,
  eaters: EATERS,
  pantry: PANTRY,
  today: TODAY,
};
const PIE = { title: "Plăcintă cu spanac", cover: 2, ...SPINACH_PIE };

Deno.test("recipe-generate: a strict schema on muse-spark-1.3", () => {
  assertEquals(schemaProblems(RECIPE_GENERATE_TASK.schema), []);
  assertEquals(RECIPE_GENERATE_TASK.model, "muse-spark-1.3");
});

Deno.test("recipe-generate: the prompt carries the request, eaters and pantry by expiry", () => {
  const { call, pantryRefs } = buildRecipeGeneratePrompt(INPUT);
  const text = call.input as string;
  assertStringIncludes(text, "Request: plăcintă cu spanac");
  assertStringIncludes(text, "Servings: 4");
  assertStringIncludes(text, "- Ioana: diets: vegetarian");
  assertStringIncludes(text, "- Mihai: allergic to: nuts, lactose (milk)");
  assertStringIncludes(text, "Never use anything containing: nuts, milk.");
  assertStringIncludes(
    text,
    "[p1] mărar: 1 pc, expires 2026-10-29 (in 1 day)\n" +
      "[p2] spanac: 500 g, expires 2026-10-30 (in 2 days)\n" +
      "[p3] ouă: 6 pc, expires 2026-11-10 (in 13 days)\n" +
      "[p4] sare: have",
  );
  assert(!text.includes("iaurt"), "items marked out are left out");
  assertEquals(pantryRefs.get("p2")?.productId, "prod-spinach");
  assertEquals(call.householdId, "hh-1");
  assertEquals(
    (buildRecipeGeneratePrompt({ ...INPUT, pantry: undefined }).call
      .input as string)
      .endsWith("Pantry: not used."),
    true,
  );
});

Deno.test("recipe-generate: a valid reply becomes a new recipe with pantry product ids", async () => {
  const { deps, requests, rows } = aiDeps(PIE);

  const result = await runRecipeGenerate(INPUT, deps);

  assertEquals(result.recipe.title, "Plăcintă cu spanac");
  assertEquals(result.recipe.cover, 2);
  assertEquals(result.recipe.content.servings, 4);
  assertEquals(
    result.recipe.content.ingredients.map((
      i,
    ) => [i.name, i.product_id, i.allergens]),
    [
      ["spanac", "prod-spinach", []],
      ["ouă", "prod-eggs", ["eggs"]],
      ["mărar", "prod-dill", []],
      ["foi de plăcintă", null, ["gluten"]],
      ["sare", "prod-salt", []],
    ],
  );
  assertEquals(result.recipe.content.steps, SPINACH_PIE.steps);
  assertEquals(result.allergyConflicts, []);
  assertEquals(result.attempts, 1);
  assertEquals(rows[0].function, "recipe-generate");

  const body = requests[0].body as Record<string, unknown>;
  assertEquals(body.model, "muse-spark-1.3");
  assertEquals(body.reasoning_effort, "medium");
});

Deno.test("recipe-generate: the locale reaches the system prompt", async () => {
  const { deps, requests } = aiDeps(PIE, PIE);
  await runRecipeGenerate(INPUT, deps);
  await runRecipeGenerate({ ...INPUT, locale: "en" }, deps);
  const [ro, en] = requests.map(messages);
  assert(ro.system.startsWith(RECIPE_GENERATE_TASK.system));
  assertStringIncludes(ro.system, "Romanian (ro)");
  assertStringIncludes(en.system, "English (en)");
});

Deno.test("recipe-generate: allergens the model missed are caught by keyword and tagged", async () => {
  const unsafe = {
    ...PIE,
    ingredients: [
      ...PIE.ingredients,
      ingredient("unt", { quantity: 50 }), // milk, untagged
      ingredient("nuci", { quantity: 30, allergens: ["nuts"] }),
    ],
  };
  const { deps } = aiDeps(unsafe);

  const result = await runRecipeGenerate(INPUT, deps);

  assertEquals(
    result.allergyConflicts.map((
      c,
    ) => [c.person, c.allergen, c.ingredient, c.foundBy]),
    [
      ["Mihai", "milk", "unt", ["keyword"]],
      ["Mihai", "nuts", "nuci", ["tag", "keyword"]],
    ],
  );
  const butter = result.recipe.content.ingredients.find((i) =>
    i.name === "unt"
  );
  assertEquals(butter?.allergens, ["milk"]);
});

Deno.test("recipe-generate: replies outside the schema are retried, then rejected", async () => {
  const badCover = { ...PIE, cover: 9 };
  const noSteps = { ...PIE, steps: [] };
  const badUnit = {
    ...PIE,
    ingredients: [ingredient("făină", { unit: "cană" as "cup" })],
  };

  const retried = aiDeps(badCover, PIE);
  assertEquals((await runRecipeGenerate(INPUT, retried.deps)).attempts, 2);

  for (const bad of [badCover, noSteps, badUnit]) {
    const { deps, requests } = aiDeps(bad, bad);
    const err = await assertRejects(
      () => runRecipeGenerate(INPUT, deps),
      AiError,
    );
    assertEquals(err.code, "invalid_output");
    assertEquals(requests.length, 2);
  }
});

Deno.test("recipe-generate: bad input is refused before any request", async () => {
  const { deps, requests } = aiDeps();
  const bad: Partial<RecipeGenerateInput>[] = [
    { request: " " },
    { servings: 0 },
    { servings: 2.5 },
    { eaters: [] },
    { today: "28.10.2026" },
    { locale: "" },
  ];
  for (const change of bad) {
    const err = await assertRejects(
      () => runRecipeGenerate({ ...INPUT, ...change }, deps),
      AiError,
    );
    assertEquals(err.code, "bad_request", JSON.stringify(change));
  }
  assertEquals(requests.length, 0);
});
