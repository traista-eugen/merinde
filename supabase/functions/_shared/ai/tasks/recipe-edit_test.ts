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
  STORED_PIE,
  TODAY,
} from "./recipe-fixtures.ts";
import {
  RECIPE_EDIT_TASK,
  type RecipeEditInput,
  runRecipeEdit,
} from "./recipe-edit.ts";

const INPUT: RecipeEditInput = {
  locale: "ro",
  householdId: "hh-1",
  recipe: {
    title: "Plăcintă cu spanac",
    variantName: "Original",
    content: STORED_PIE,
  },
  change: "fără cuptor",
  eaters: [{ name: "Ioana", allergies: [] }],
  pantry: PANTRY,
  today: TODAY,
};

const NEXT = {
  change_note: "Gătită în tigaie în loc de cuptor.",
  servings: 4,
  total_minutes: 30,
  ingredients: [
    ingredient("spanac", { quantity: 500, pantry_ref: "p2" }),
    ingredient("ouă", { quantity: 3, unit: "pc", allergens: ["eggs"] }),
    ingredient("telemea", { quantity: 200, allergens: ["milk"] }),
  ],
  steps: ["Amestecă totul.", "Gătește în tigaie 15 minute pe fiecare parte."],
};

Deno.test("recipe-edit: a strict schema on muse-spark-1.3", () => {
  assertEquals(schemaProblems(RECIPE_EDIT_TASK.schema), []);
  assertEquals(RECIPE_EDIT_TASK.model, "muse-spark-1.3");
});

Deno.test("recipe-edit: sends only the current version and the change, in the app's language", async () => {
  const { deps, requests } = aiDeps(NEXT);
  await runRecipeEdit(INPUT, deps);

  const { system, user } = messages(requests[0]);
  assertStringIncludes(system, "Romanian (ro)");
  assertStringIncludes(user, 'Recipe: Plăcintă cu spanac (variant "Original")');
  assertStringIncludes(user, "Change: fără cuptor");
  assertStringIncludes(
    user,
    '"ingredients":[{"name":"spanac","quantity":500,"unit":"g"}',
  );
  assert(!user.includes("prod-"), "product ids stay out of the prompt");
  assertEquals(
    (requests[0].body as { reasoning_effort: string }).reasoning_effort,
    "low",
  );
});

Deno.test("recipe-edit: returns the next version with its change note, keeping product ids", async () => {
  const { deps } = aiDeps(NEXT);

  const result = await runRecipeEdit(INPUT, deps);

  assertEquals(result.changeNote, "Gătită în tigaie în loc de cuptor.");
  assertEquals(result.content.total_minutes, 30);
  assertEquals(
    result.content.ingredients.map((i) => i.product_id),
    ["prod-spinach", "prod-eggs", "prod-telemea"],
  );
  assertEquals(result.content.steps.length, 2);
  assertEquals(result.allergyConflicts, []);
});

Deno.test("recipe-edit: flags a change that adds an allergen for someone eating", async () => {
  const withCream = {
    ...NEXT,
    ingredients: [
      ...NEXT.ingredients,
      ingredient("smântână", { quantity: 150 }),
    ],
  };
  const { deps } = aiDeps(withCream);

  const result = await runRecipeEdit({ ...INPUT, eaters: EATERS }, deps);

  assertEquals(
    result.allergyConflicts.map((c) =>
      `${c.person}: ${c.ingredient} (${c.foundBy})`
    ),
    ["Mihai: telemea (tag,keyword)", "Mihai: smântână (keyword)"],
  );
});

Deno.test("recipe-edit: a reply without a change note is retried, then rejected", async () => {
  const { change_note: _, ...noNote } = NEXT;
  const { deps, requests } = aiDeps(noNote, noNote);
  const err = await assertRejects(() => runRecipeEdit(INPUT, deps), AiError);
  assertEquals(err.code, "invalid_output");
  assertStringIncludes(err.message, 'missing "change_note"');
  assertEquals(requests.length, 2);
});

Deno.test("recipe-edit: bad input is refused before any request", async () => {
  const { deps, requests } = aiDeps();
  const bad: Partial<RecipeEditInput>[] = [
    { change: "" },
    {
      recipe: {
        ...INPUT.recipe,
        content: { ...STORED_PIE, steps: "x" as unknown as string[] },
      },
    },
    { recipe: { ...INPUT.recipe, variantName: "" } },
    {
      eaters: [
        { name: "Ioana" } as unknown as RecipeEditInput["eaters"][number],
      ],
    },
  ];
  for (const change of bad) {
    const err = await assertRejects(
      () => runRecipeEdit({ ...INPUT, ...change }, deps),
      AiError,
    );
    assertEquals(err.code, "bad_request");
  }
  assertEquals(requests.length, 0);
});
