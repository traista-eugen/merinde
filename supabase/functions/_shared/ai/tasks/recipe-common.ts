// Shared by recipe-generate, recipe-edit, recipe-variant and meal-plan: the
// stored recipe shape, its schema, the prompt rules and the prompt context.
import {
  type Allergen,
  allergensFor,
  allergensInName,
  type Eater,
  EU_ALLERGENS,
  normalize,
} from "../../allergy.ts";
import { AiError } from "../errors.ts";
import type { JsonSchema } from "../schema.ts";

export const UNITS = [
  "g",
  "kg",
  "ml",
  "l",
  "pc",
  "tsp",
  "tbsp",
  "cup",
  "pinch",
  "bunch",
  "clove",
  "slice",
] as const;
export type Unit = typeof UNITS[number];

/** A pantry row with its product's name; items marked "out" are skipped. */
export interface PantryItem {
  productId: string;
  name: string;
  quantity?: number | null;
  unit?: string | null;
  level?: "have" | "low" | "out" | null;
  expiresOn?: string | null;
}

/** One ingredient, as stored in `recipe_version.content`. */
export interface Ingredient {
  name: string;
  /** Null with a null unit for "to taste". */
  quantity: number | null;
  unit: Unit | null;
  /** EU allergen codes: the model's tags plus the code keyword check. */
  allergens: Allergen[];
  /** The pantry product it uses, if any; catalogue matching fills the rest later. */
  product_id: string | null;
}

/** `recipe_version.content`. */
export interface RecipeContent {
  servings: number;
  total_minutes: number;
  ingredients: Ingredient[];
  steps: string[];
}

/** A new recipe: `recipe` row fields plus version 1 of its "Original" variant. */
export interface NewRecipe {
  title: string;
  cover: number;
  content: RecipeContent;
}

/** A recipe's current version, as sent to recipe-edit and recipe-variant. */
export interface CurrentRecipe {
  title: string;
  variantName: string;
  content: RecipeContent;
}

/** What the model returns for an ingredient. */
export interface ModelIngredient {
  name: string;
  quantity: number | null;
  unit: Unit | null;
  pantry_ref: string | null;
  allergens: Allergen[];
}

export interface ModelContent {
  servings: number;
  total_minutes: number;
  ingredients: ModelIngredient[];
  steps: string[];
}

const PANTRY_REF = "^p[0-9]+$";
/** Keeps prompts bounded; the soonest-expiring items come first. */
const MAX_PANTRY_ITEMS = 100;

export const UNIT_SCHEMA: JsonSchema = {
  type: ["string", "null"],
  enum: [...UNITS, null],
};

export const INGREDIENT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1, maxLength: 80 },
    quantity: { type: ["number", "null"], minimum: 0 },
    unit: UNIT_SCHEMA,
    pantry_ref: { type: ["string", "null"], pattern: PANTRY_REF },
    allergens: {
      type: "array",
      items: { type: "string", enum: [...EU_ALLERGENS] },
    },
  },
  required: ["name", "quantity", "unit", "pantry_ref", "allergens"],
  additionalProperties: false,
};

const CONTENT_PROPERTIES: Record<string, JsonSchema> = {
  servings: { type: "integer", minimum: 1, maximum: 20 },
  total_minutes: { type: "integer", minimum: 1, maximum: 1440 },
  ingredients: {
    type: "array",
    minItems: 1,
    maxItems: 40,
    items: INGREDIENT_SCHEMA,
  },
  steps: {
    type: "array",
    minItems: 1,
    maxItems: 15,
    items: { type: "string", minLength: 1, maxLength: 400 },
  },
};

/** A strict object schema: the recipe content plus `extra` fields. */
export function recipeSchema(extra: Record<string, JsonSchema>): JsonSchema {
  const properties = { ...extra, ...CONTENT_PROPERTIES };
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

export const TITLE_SCHEMA: JsonSchema = {
  type: "string",
  minLength: 1,
  maxLength: 80,
};
export const COVER_SCHEMA: JsonSchema = {
  type: "integer",
  minimum: 1,
  maximum: 6,
};
export const CHANGE_NOTE_SCHEMA: JsonSchema = {
  type: "string",
  minLength: 1,
  maxLength: 160,
};

export const RECIPE_RULES = `Recipe rules:
- Cook for the given servings. Quantities are for the whole recipe.
- Units: g, kg, ml, l, or pc for things you count; tsp, tbsp, cup, pinch, bunch, clove or slice where cooks expect them. For "to taste", set quantity and unit to null.
- Ingredient names are short and plain, without quantities.
- pantry_ref: the [p…] reference when the ingredient comes from the pantry, else null. Prefer pantry items that expire soonest. Staples marked "have" or "low" can be used freely.
- allergens: every EU allergen the ingredient contains, as codes: ${
  EU_ALLERGENS.join(", ")
} ("nuts" means tree nuts). Include hidden ones: butter and cheese are milk, pasta and breadcrumbs are gluten, mayonnaise is eggs, soy sauce is soy and gluten.
- Never use an ingredient that contains an allergen of anyone eating, and follow everyone's diets.
- steps: short imperative sentences, one action each.
- total_minutes: preparation plus cooking time.`;

export const COVER_RULE =
  `cover: the card colour for the dish's main ingredient: 1 soups, stews, tomato; 2 greens, salads, spinach pies; 3 beans, grains, baking; 4 desserts, fruit, jam; 5 fish, special occasions; 6 mushrooms, meat, roasts.`;

export interface PantryContext {
  text: string;
  /** [p…] reference → pantry item. */
  refs: Map<string, PantryItem>;
}

/** The pantry, soonest expiry first, with a [p…] reference per item. */
export function describePantry(
  pantry: readonly PantryItem[] | undefined,
  today: string,
): PantryContext {
  const refs = new Map<string, PantryItem>();
  const items = requirePantry(pantry)
    .filter((item) => item.level !== "out")
    .toSorted((a, b) =>
      (a.expiresOn ?? "9999-12-31").localeCompare(b.expiresOn ?? "9999-12-31")
    )
    .slice(0, MAX_PANTRY_ITEMS);
  if (items.length === 0) return { text: "Pantry: not used.", refs };

  const lines = items.map((item, i) => {
    const ref = `p${i + 1}`;
    refs.set(ref, item);
    const amount = item.quantity != null && item.unit
      ? `${item.quantity} ${item.unit}`
      : item.level ?? "some";
    const expiry = item.expiresOn
      ? `, ${expiryText(item.expiresOn, today)}`
      : "";
    return `[${ref}] ${item.name}: ${amount}${expiry}`;
  });
  return {
    text: `Pantry, soonest expiry first (today is ${today}):\n${
      lines.join("\n")
    }`,
    refs,
  };
}

function expiryText(expiresOn: string, today: string): string {
  const days = Math.round(
    (Date.parse(`${expiresOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86_400_000,
  );
  if (Number.isNaN(days)) return `expires ${expiresOn}`;
  if (days < 0) return `expired ${expiresOn}`;
  if (days === 0) return `expires ${expiresOn} (today)`;
  return `expires ${expiresOn} (in ${days} ${days === 1 ? "day" : "days"})`;
}

/** Who's eating, their diets and allergies, and one line of what to avoid. */
export function describeEaters(eaters: readonly Eater[]): string {
  const avoid = new Set<string>();
  const lines = eaters.map((eater) => {
    const parts: string[] = [];
    if (eater.diets?.length) parts.push(`diets: ${eater.diets.join(", ")}`);
    const allergies = eater.allergies.filter((a) => normalize(a)).map(
      (allergy) => {
        const allergens = allergensFor(allergy);
        allergens.forEach((a) => avoid.add(a));
        if (allergens.length === 0) avoid.add(allergy);
        return allergens.length === 0 || allergens.join() === normalize(allergy)
          ? allergy
          : `${allergy} (${allergens.join(", ")})`;
      },
    );
    if (allergies.length) parts.push(`allergic to: ${allergies.join(", ")}`);
    return `- ${eater.name}: ${parts.join("; ") || "no diets or allergies"}`;
  });
  const avoidLine = avoid.size > 0
    ? `\nNever use anything containing: ${[...avoid].join(", ")}.`
    : "";
  return `Who's eating (${eaters.length}):\n${lines.join("\n")}${avoidLine}`;
}

/** The current version for edit and variant prompts. */
export function describeContent(content: RecipeContent): string {
  return JSON.stringify({
    servings: content.servings,
    total_minutes: content.total_minutes,
    ingredients: content.ingredients.map(({ name, quantity, unit }) => ({
      name,
      quantity,
      unit,
    })),
    steps: content.steps,
  });
}

/**
 * Turns the model's content into stored content: pantry references become
 * product ids (unknown ones are dropped), product ids carry over from the
 * previous version by ingredient name, and code keyword tags join the model's.
 */
export function toStoredContent(
  model: ModelContent,
  refs: Map<string, PantryItem>,
  previous?: RecipeContent,
): RecipeContent {
  const previousIds = new Map(
    (previous?.ingredients ?? []).map((i) => [normalize(i.name), i.product_id]),
  );
  return {
    servings: model.servings,
    total_minutes: model.total_minutes,
    ingredients: model.ingredients.map((ingredient) => {
      const byName = allergensInName(ingredient.name);
      const fromPantry = ingredient.pantry_ref
        ? refs.get(ingredient.pantry_ref)?.productId
        : undefined;
      return {
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        allergens: EU_ALLERGENS.filter((a) =>
          ingredient.allergens.includes(a) || byName.includes(a)
        ),
        product_id: fromPantry ??
          previousIds.get(normalize(ingredient.name)) ?? null,
      };
    }),
    steps: model.steps,
  };
}

// Input checks: the edge functions pass app input straight through.

export function requireText(value: unknown, field: string, max = 500): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AiError("bad_request", `${field} is required`);
  }
  if (value.length > max) {
    throw new AiError(
      "bad_request",
      `${field} is longer than ${max} characters`,
    );
  }
  return value.trim();
}

/** Undefined for a missing or blank value. */
export function optionalText(
  value: unknown,
  field: string,
  max = 500,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" && !value.trim()) return undefined;
  return requireText(value, field, max);
}

function requirePantry(value: unknown): PantryItem[] {
  if (value === undefined || value === null) return [];
  if (
    !Array.isArray(value) ||
    !value.every((item) =>
      typeof item?.productId === "string" && typeof item.name === "string" &&
      (item.expiresOn == null ||
        /^\d{4}-\d{2}-\d{2}$/.test(String(item.expiresOn)))
    )
  ) {
    throw new AiError(
      "bad_request",
      "pantry items need a productId, a name and an expiresOn like 2026-10-30",
    );
  }
  return value;
}

export function requireDate(value: unknown, field: string): string {
  if (
    typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  ) {
    throw new AiError("bad_request", `${field} must be a date like 2026-10-30`);
  }
  return value;
}

export function requireServings(value: unknown, field = "servings"): number {
  if (
    !Number.isInteger(value) || (value as number) < 1 || (value as number) > 20
  ) {
    throw new AiError(
      "bad_request",
      `${field} must be a whole number from 1 to 20`,
    );
  }
  return value as number;
}

export function requireCurrentRecipe(value: unknown): CurrentRecipe {
  const recipe = value as CurrentRecipe | undefined;
  const content = recipe?.content;
  requireText(recipe?.title, "recipe.title", 200);
  requireText(recipe?.variantName, "recipe.variantName", 100);
  requireServings(content?.servings, "recipe.content.servings");
  if (
    !Array.isArray(content?.ingredients) ||
    !content.ingredients.every((i) => typeof i?.name === "string") ||
    !Array.isArray(content.steps) ||
    !content.steps.every((s) => typeof s === "string")
  ) {
    throw new AiError(
      "bad_request",
      "recipe.content needs ingredients with names and steps",
    );
  }
  return recipe as CurrentRecipe;
}

/** At least one person, so the allergy check always has someone to check for. */
export function requireEaters(value: unknown): Eater[] {
  if (
    !Array.isArray(value) || value.length === 0 ||
    !value.every((e) =>
      typeof e?.name === "string" && Array.isArray(e.allergies) &&
      e.allergies.every((a: unknown) => typeof a === "string") &&
      (e.diets === undefined ||
        (Array.isArray(e.diets) &&
          e.diets.every((d: unknown) => typeof d === "string")))
    )
  ) {
    throw new AiError(
      "bad_request",
      "eaters must list at least one person with a name and allergies",
    );
  }
  return value;
}
