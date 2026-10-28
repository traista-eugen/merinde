// meal-plan (#11): meals for the chosen days and meals, using the food that
// expires soonest first, plus what's missing. Each meal reuses a saved recipe
// or comes with a new one, so it can link to a recipe variant.
import {
  type AllergyConflict,
  type Eater,
  findAllergyConflicts,
  type IngredientToCheck,
} from "../../allergy.ts";
import {
  type AiCall,
  type AiDeps,
  AiError,
  type AiResult,
  type AiTask,
  callAi,
  type JsonSchema,
  TEXT_MODEL,
} from "../mod.ts";
import {
  COVER_RULE,
  COVER_SCHEMA,
  describeEaters,
  describePantry,
  type ModelContent,
  type NewRecipe,
  optionalText,
  type PantryItem,
  RECIPE_RULES,
  recipeSchema,
  requireDate,
  requireEaters,
  requireServings,
  TITLE_SCHEMA,
  toStoredContent,
  type Unit,
  UNIT_SCHEMA,
} from "./recipe-common.ts";

export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type Meal = typeof MEALS[number];

const MAX_DAYS = 7;
const MAX_SAVED_RECIPES = 50;

export interface PlanDay {
  date: string;
  meals: Meal[];
}

/** A recipe variant the plan may reuse, e.g. a favourite. */
export interface SavedRecipe {
  variantId: string;
  title: string;
  favourite?: boolean;
  /** Its current ingredients, so the model knows what it uses and code can check allergies. */
  ingredients: IngredientToCheck[];
}

export interface MealPlanInput {
  locale: string;
  householdId?: string | null;
  /** 1 to 7 days, each with the meals to plan. */
  days: PlanDay[];
  servings: number;
  eaters: Eater[];
  pantry: PantryItem[];
  savedRecipes?: SavedRecipe[];
  preferFavourites?: boolean;
  /** Optional wish, e.g. "light dinners". */
  request?: string;
  /** The household's date (YYYY-MM-DD), for expiry. */
  today: string;
}

export interface PlannedMeal {
  date: string;
  meal: Meal;
  /** Set when the meal reuses a saved recipe. */
  saved: { variantId: string; title: string } | null;
  /** Set when the meal comes with a new recipe. */
  recipe: NewRecipe | null;
  /** Pantry items it uses; the app shows "uses spinach, dill". */
  usesPantry: PantryItem[];
}

export interface MissingItem {
  name: string;
  quantity: number | null;
  unit: Unit | null;
}

export interface MealPlanResult {
  /** In the order of the requested days and meals. */
  meals: PlannedMeal[];
  /** For the shopping list (#12). */
  missing: MissingItem[];
  /** With `where` set to "<date> <meal>". */
  allergyConflicts: AllergyConflict[];
  model: string;
  attempts: number;
  usage: AiResult<unknown>["usage"];
}

interface OutputMeal {
  meal: Meal;
  uses_pantry: string[];
  saved_recipe_ref?: string;
  recipe?: ModelContent & { title: string; cover: number };
}

interface Output {
  days: { date: string; meals: OutputMeal[] }[];
  missing: MissingItem[];
}

const MEAL_SCHEMA: JsonSchema = { type: "string", enum: [...MEALS] };
const USES_PANTRY_SCHEMA: JsonSchema = {
  type: "array",
  items: { type: "string", pattern: "^p[0-9]+$" },
};

const SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    days: {
      type: "array",
      minItems: 1,
      maxItems: MAX_DAYS,
      items: {
        type: "object",
        properties: {
          date: { type: "string", format: "date" },
          meals: {
            type: "array",
            minItems: 1,
            maxItems: MEALS.length,
            items: {
              anyOf: [
                {
                  type: "object",
                  properties: {
                    meal: MEAL_SCHEMA,
                    uses_pantry: USES_PANTRY_SCHEMA,
                    saved_recipe_ref: { type: "string", pattern: "^r[0-9]+$" },
                  },
                  required: ["meal", "uses_pantry", "saved_recipe_ref"],
                  additionalProperties: false,
                },
                {
                  type: "object",
                  properties: {
                    meal: MEAL_SCHEMA,
                    uses_pantry: USES_PANTRY_SCHEMA,
                    recipe: recipeSchema({
                      title: TITLE_SCHEMA,
                      cover: COVER_SCHEMA,
                    }),
                  },
                  required: ["meal", "uses_pantry", "recipe"],
                  additionalProperties: false,
                },
              ],
            },
          },
        },
        required: ["date", "meals"],
        additionalProperties: false,
      },
    },
    missing: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 80 },
          quantity: { type: ["number", "null"], minimum: 0 },
          unit: UNIT_SCHEMA,
        },
        required: ["name", "quantity", "unit"],
        additionalProperties: false,
      },
    },
  },
  required: ["days", "missing"],
  additionalProperties: false,
};

export const MEAL_PLAN_TASK: AiTask = {
  name: "meal-plan",
  model: TEXT_MODEL,
  reasoningEffort: "medium",
  // A full week of new recipes runs to ~10,000 tokens plus reasoning.
  maxTokens: 24_000,
  system:
    `You plan meals for households for Merinde, a household food app in Romania. Plan exactly the requested meals: one entry in days per requested date, in order, with one entry per requested meal.
- Use the pantry food that expires soonest first, and spread it over the days so nothing goes off. Skip expired items.
- For each meal, either reuse a saved recipe (saved_recipe_ref: its [r…] reference) or write a new recipe (recipe). Reuse a saved recipe only when it fits the request, the pantry and everyone eating. When favourites are preferred, reuse favourites first.
- Never reuse a saved recipe with an ingredient that contains an allergen of anyone eating.
- Don't plan the same dish twice.
- uses_pantry: the [p…] references of the pantry items the meal uses.
- missing: what to buy: ingredients the meals need that the pantry lacks or has too little of, summed over the plan, one entry per ingredient.
- Breakfasts take at most 20 minutes. Keep new recipes to at most 8 steps.

New recipes follow these rules.
${RECIPE_RULES}
- title: the dish's name, at most 60 characters.
- ${COVER_RULE}`,
  schema: SCHEMA,
};

export function buildMealPlanPrompt(input: MealPlanInput): {
  call: AiCall;
  pantryRefs: Map<string, PantryItem>;
  savedRefs: Map<string, SavedRecipe>;
} {
  const days = requireDays(input.days);
  const servings = requireServings(input.servings);
  const eaters = requireEaters(input.eaters);
  const pantry = describePantry(
    input.pantry,
    requireDate(input.today, "today"),
  );
  const request = optionalText(input.request, "request");

  const savedRefs = new Map<string, SavedRecipe>();
  const savedLines = requireSavedRecipes(input.savedRecipes)
    .toSorted((a, b) =>
      Number(b.favourite ?? false) - Number(a.favourite ?? false)
    )
    .slice(0, MAX_SAVED_RECIPES)
    .map((recipe, i) => {
      const ref = `r${i + 1}`;
      savedRefs.set(ref, recipe);
      const favourite = recipe.favourite ? ", favourite" : "";
      const ingredients = recipe.ingredients.map((x) => x.name).join(", ");
      return `[${ref}] ${recipe.title}${favourite}: ${ingredients}`;
    });
  const saved = savedLines.length > 0
    ? `Saved recipes${input.preferFavourites ? " (prefer favourites)" : ""}:\n${
      savedLines.join("\n")
    }`
    : "Saved recipes: none, so write new ones.";

  const plan = days.map((day) =>
    `- ${weekday(day.date)} ${day.date}: ${day.meals.join(", ")}`
  );
  return {
    call: {
      locale: input.locale,
      householdId: input.householdId ?? null,
      input: [
        `Plan these meals:\n${plan.join("\n")}`,
        `Servings per meal: ${servings}`,
        ...(request ? [`Request: ${request}`] : []),
        describeEaters(eaters),
        pantry.text,
        saved,
      ].join("\n\n"),
    },
    pantryRefs: pantry.refs,
    savedRefs,
  };
}

export async function runMealPlan(
  input: MealPlanInput,
  deps?: AiDeps,
): Promise<MealPlanResult> {
  const { call, pantryRefs, savedRefs } = buildMealPlanPrompt(input);
  const result = await callAi<Output>(MEAL_PLAN_TASK, call, deps);

  const meals: PlannedMeal[] = [];
  const allergyConflicts: AllergyConflict[] = [];
  for (const day of input.days) {
    const planned = result.data.days.find((d) => d.date === day.date);
    for (const meal of day.meals) {
      const output = planned?.meals.find((m) => m.meal === meal);
      if (!output) {
        throw new AiError(
          "invalid_output",
          `meal-plan: the plan has no ${meal} on ${day.date}`,
        );
      }
      const where = `${day.date} ${meal}`;
      const usesPantry = [...new Set(output.uses_pantry)].flatMap((ref) =>
        pantryRefs.get(ref) ?? []
      );

      if (output.saved_recipe_ref !== undefined) {
        const saved = savedRefs.get(output.saved_recipe_ref);
        if (!saved) {
          throw new AiError(
            "invalid_output",
            `meal-plan: ${where} reuses unknown saved recipe ${output.saved_recipe_ref}`,
          );
        }
        allergyConflicts.push(
          ...findAllergyConflicts(saved.ingredients, input.eaters, where),
        );
        meals.push({
          date: day.date,
          meal,
          saved: { variantId: saved.variantId, title: saved.title },
          recipe: null,
          usesPantry,
        });
      } else {
        const { title, cover, ...content } = output.recipe!;
        allergyConflicts.push(
          ...findAllergyConflicts(content.ingredients, input.eaters, where),
        );
        meals.push({
          date: day.date,
          meal,
          saved: null,
          recipe: {
            title,
            cover,
            content: toStoredContent(content, pantryRefs),
          },
          usesPantry,
        });
      }
    }
  }
  return {
    meals,
    missing: result.data.missing,
    allergyConflicts,
    model: result.model,
    attempts: result.attempts,
    usage: result.usage,
  };
}

function requireSavedRecipes(value: unknown): SavedRecipe[] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    !value.every((r) =>
      typeof r?.variantId === "string" && typeof r.title === "string" &&
      Array.isArray(r.ingredients) &&
      r.ingredients.every((i: unknown) =>
        typeof (i as { name?: unknown })?.name === "string"
      )
    )
  ) {
    throw new AiError(
      "bad_request",
      "savedRecipes need a variantId, a title and ingredients with names",
    );
  }
  return value;
}

function requireDays(value: unknown): PlanDay[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_DAYS) {
    throw new AiError("bad_request", `days must list 1 to ${MAX_DAYS} days`);
  }
  const dates = new Set<string>();
  for (const day of value) {
    const date = requireDate(day?.date, "days[].date");
    if (dates.has(date)) {
      throw new AiError("bad_request", `${date} is listed twice`);
    }
    dates.add(date);
    const meals = day.meals;
    if (
      !Array.isArray(meals) || meals.length === 0 ||
      !meals.every((m) => (MEALS as readonly string[]).includes(m)) ||
      new Set(meals).size !== meals.length
    ) {
      throw new AiError(
        "bad_request",
        `days[].meals must list some of ${MEALS.join(", ")}, each once`,
      );
    }
  }
  return value;
}

function weekday(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en", {
    weekday: "long",
    timeZone: "UTC",
  });
}
