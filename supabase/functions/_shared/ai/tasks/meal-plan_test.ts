import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "jsr:@std/assert@^1";
import { AiError } from "../errors.ts";
import { schemaProblems } from "../schema.ts";
import {
  buildMealPlanPrompt,
  MEAL_PLAN_TASK,
  type MealPlanInput,
  runMealPlan,
} from "./meal-plan.ts";
import {
  aiDeps,
  EATERS,
  messages,
  PANTRY,
  SPINACH_PIE,
  TODAY,
} from "./recipe-fixtures.ts";

const INPUT: MealPlanInput = {
  locale: "ro",
  householdId: "hh-1",
  days: [
    { date: "2026-10-30", meals: ["lunch", "dinner"] },
    { date: "2026-10-31", meals: ["dinner"] },
  ],
  servings: 2,
  eaters: [{ name: "Ioana", diets: ["vegetarian"], allergies: [] }],
  pantry: PANTRY,
  savedRecipes: [
    {
      variantId: "var-salad",
      title: "Salată de vinete",
      ingredients: [{ name: "vinete" }, { name: "ceapă" }],
    },
    {
      variantId: "var-soup",
      title: "Ciorbă de legume",
      favourite: true,
      ingredients: [{ name: "morcovi" }, {
        name: "țelină",
        allergens: ["celery"],
      }],
    },
  ],
  preferFavourites: true,
  request: "mese ușoare",
  today: TODAY,
};

const PIE_RECIPE = { title: "Plăcintă cu spanac", cover: 2, ...SPINACH_PIE };
const OMELETTE = {
  title: "Omletă cu mărar",
  cover: 2,
  servings: 2,
  total_minutes: 15,
  ingredients: [
    {
      name: "ouă",
      quantity: 4,
      unit: "pc",
      pantry_ref: "p3",
      allergens: ["eggs"],
    },
    {
      name: "mărar",
      quantity: 1,
      unit: "bunch",
      pantry_ref: "p1",
      allergens: [],
    },
  ],
  steps: ["Bate ouăle.", "Prăjește 5 minute."],
};

interface Plan {
  days: { date: string; meals: Record<string, unknown>[] }[];
  missing: unknown[];
}

const PLAN: Plan = {
  days: [
    {
      date: "2026-10-30",
      meals: [
        { meal: "lunch", uses_pantry: [], saved_recipe_ref: "r1" },
        { meal: "dinner", uses_pantry: ["p2", "p3", "p9"], recipe: PIE_RECIPE },
      ],
    },
    {
      date: "2026-10-31",
      meals: [{ meal: "dinner", uses_pantry: ["p1", "p3"], recipe: OMELETTE }],
    },
  ],
  missing: [{ name: "foi de plăcintă", quantity: 400, unit: "g" }],
};

Deno.test("meal-plan: a strict schema within Meta's nesting limit, on muse-spark-1.3", () => {
  assertEquals(schemaProblems(MEAL_PLAN_TASK.schema), []);
  assertEquals(MEAL_PLAN_TASK.model, "muse-spark-1.3");
});

Deno.test("meal-plan: the prompt lists the days, eaters, pantry by expiry and favourites first", () => {
  const { call, savedRefs } = buildMealPlanPrompt(INPUT);
  const text = call.input as string;
  assertStringIncludes(
    text,
    "Plan these meals:\n- Friday 2026-10-30: lunch, dinner\n- Saturday 2026-10-31: dinner",
  );
  assertStringIncludes(text, "Servings per meal: 2");
  assertStringIncludes(text, "Request: mese ușoare");
  assertStringIncludes(text, "- Ioana: diets: vegetarian");
  assertStringIncludes(text, "[p1] mărar: 1 pc, expires 2026-10-29 (in 1 day)");
  assertStringIncludes(
    text,
    "Saved recipes (prefer favourites):\n" +
      "[r1] Ciorbă de legume, favourite: morcovi, țelină\n" +
      "[r2] Salată de vinete: vinete, ceapă",
  );
  assertEquals(savedRefs.get("r1")?.variantId, "var-soup");
});

Deno.test("meal-plan: a valid plan maps saved recipes, new recipes, pantry use and missing items", async () => {
  const { deps, requests } = aiDeps(PLAN);

  const result = await runMealPlan(INPUT, deps);

  assertEquals(
    result.meals.map((
      m,
    ) => [m.date, m.meal, m.saved?.variantId ?? m.recipe?.title]),
    [
      ["2026-10-30", "lunch", "var-soup"],
      ["2026-10-30", "dinner", "Plăcintă cu spanac"],
      ["2026-10-31", "dinner", "Omletă cu mărar"],
    ],
  );
  assertEquals(result.meals[0].recipe, null);
  assertEquals(result.meals[1].saved, null);
  assertEquals(
    result.meals[1].usesPantry.map((p) => p.productId),
    ["prod-spinach", "prod-eggs"], // unknown p9 dropped
  );
  assertEquals(
    result.meals[2].recipe?.content.ingredients.map((i) => i.product_id),
    ["prod-eggs", "prod-dill"],
  );
  assertEquals(result.missing, PLAN.missing);
  assertEquals(result.allergyConflicts, []);

  const { system } = messages(requests[0]);
  assertStringIncludes(system, "Romanian (ro)");
  assertEquals((requests[0].body as { max_tokens: number }).max_tokens, 24_000);
});

Deno.test("meal-plan: flags allergens in saved and new recipes, per meal", async () => {
  const celeryAllergic = { name: "Mihai", allergies: ["celery", "eggs"] };
  const { deps } = aiDeps(PLAN);

  const result = await runMealPlan(
    { ...INPUT, eaters: [celeryAllergic] },
    deps,
  );

  assertEquals(
    result.allergyConflicts.map((c) => [c.where, c.ingredient, c.foundBy]),
    [
      ["2026-10-30 lunch", "țelină", ["tag", "keyword"]],
      ["2026-10-30 dinner", "ouă", ["tag", "keyword"]],
      ["2026-10-31 dinner", "ouă", ["tag", "keyword"]],
    ],
  );
});

Deno.test("meal-plan: a meal with both a saved and a new recipe is retried, then accepted", async () => {
  const both = structuredClone(PLAN);
  Object.assign(both.days[0].meals[0], { recipe: PIE_RECIPE });
  const { deps, requests } = aiDeps(both, PLAN);

  const result = await runMealPlan(INPUT, deps);

  assertEquals(result.attempts, 2);
  assertEquals(requests.length, 2);
});

Deno.test("meal-plan: a plan outside the schema twice is rejected", async () => {
  const badMeal = structuredClone(PLAN);
  Object.assign(badMeal.days[1].meals[0], { meal: "brunch" });
  const { deps } = aiDeps(badMeal, badMeal);
  const err = await assertRejects(() => runMealPlan(INPUT, deps), AiError);
  assertEquals(err.code, "invalid_output");
});

Deno.test("meal-plan: a missing meal or an unknown saved recipe fails clearly", async () => {
  const missingDinner = structuredClone(PLAN);
  missingDinner.days[1].meals = [];
  missingDinner.days[1].meals.push({ ...PLAN.days[0].meals[0], meal: "lunch" });
  const unknownRef = structuredClone(PLAN);
  unknownRef.days[0].meals[0].saved_recipe_ref = "r7";

  for (
    const [plan, message] of [
      [missingDinner, "no dinner on 2026-10-31"],
      [unknownRef, "unknown saved recipe r7"],
    ] as const
  ) {
    const { deps, requests } = aiDeps(plan);
    const err = await assertRejects(() => runMealPlan(INPUT, deps), AiError);
    assertEquals(err.code, "invalid_output");
    assertStringIncludes(err.message, message);
    assertEquals(requests.length, 1);
  }
});

Deno.test("meal-plan: bad input is refused before any request", async () => {
  const { deps, requests } = aiDeps();
  const day = { date: "2026-10-30", meals: ["dinner" as const] };
  const bad: Partial<MealPlanInput>[] = [
    { days: [] },
    {
      days: Array.from(
        { length: 8 },
        (_, i) => ({ ...day, date: `2026-11-0${i + 1}` }),
      ),
    },
    { days: [day, day] },
    { days: [{ date: "2026-10-30", meals: [] }] },
    { days: [{ date: "2026-10-30", meals: ["brunch" as "lunch"] }] },
    { days: [{ date: "2026-10-30", meals: ["lunch", "lunch"] }] },
    { servings: 0 },
    { eaters: [] },
    { pantry: [{ name: "spanac" } as MealPlanInput["pantry"][number]] },
    { pantry: [{ ...PANTRY[1], expiresOn: "30.10.2026" }] },
    {
      savedRecipes: [{
        variantId: "v",
        title: "x",
      }] as unknown as MealPlanInput[
        "savedRecipes"
      ],
    },
  ];
  for (const change of bad) {
    const err = await assertRejects(
      () => runMealPlan({ ...INPUT, ...change }, deps),
      AiError,
    );
    assertEquals(err.code, "bad_request", JSON.stringify(change));
  }
  assertEquals(requests.length, 0);
});

Deno.test("meal-plan: Spark gets EATERS' allergies in the prompt", () => {
  const text = buildMealPlanPrompt({ ...INPUT, eaters: EATERS }).call
    .input as string;
  assertStringIncludes(text, "Never use anything containing: nuts, milk.");
});
