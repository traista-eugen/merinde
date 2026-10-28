// recipe-variant (#5): a new named variant next to the one the cook is on,
// e.g. "No eggs" or "Chicken instead of tofu". The source stays as it is.
import {
  type AllergyConflict,
  type Eater,
  findAllergyConflicts,
} from "../../allergy.ts";
import {
  type AiCall,
  type AiDeps,
  AiError,
  type AiResult,
  type AiTask,
  callAi,
  TEXT_MODEL,
} from "../mod.ts";
import {
  CHANGE_NOTE_SCHEMA,
  type CurrentRecipe,
  describeContent,
  describeEaters,
  describePantry,
  type ModelContent,
  optionalText,
  type PantryItem,
  RECIPE_RULES,
  type RecipeContent,
  recipeSchema,
  requireCurrentRecipe,
  requireDate,
  requireEaters,
  toStoredContent,
} from "./recipe-common.ts";

export interface RecipeVariantInput {
  locale: string;
  householdId?: string | null;
  /** The variant the cook is on, at its current version. */
  recipe: CurrentRecipe;
  /** What should differ, e.g. "no eggs". Optional when `missing` is given. */
  request?: string;
  /** Ingredients to do without, from "Variant without them". */
  missing?: string[];
  eaters: Eater[];
  pantry?: PantryItem[];
  /** The household's date (YYYY-MM-DD), for expiry. */
  today: string;
}

export interface RecipeVariantResult {
  variantName: string;
  /** How it differs from the source; stored as version 1's change note. */
  changeNote: string;
  /** Version 1 of the new variant. */
  content: RecipeContent;
  allergyConflicts: AllergyConflict[];
  model: string;
  attempts: number;
  usage: AiResult<unknown>["usage"];
}

interface Output extends ModelContent {
  variant_name: string;
  change_note: string;
}

export const RECIPE_VARIANT_TASK: AiTask = {
  name: "recipe-variant",
  model: TEXT_MODEL,
  reasoningEffort: "low",
  maxTokens: 6_000,
  system:
    `You make recipe variants for Merinde, a household food app in Romania. You get the current version of a recipe and what the cook wants different, such as an ingredient they don't have or a swap. Return a variant of the same dish with that difference, changing only what it needs.

${RECIPE_RULES}
- variant_name: 1 to 4 words naming the difference, e.g. "No eggs" or "Chicken instead of tofu".
- change_note: one short sentence on how this variant differs from the recipe you got.`,
  schema: recipeSchema({
    variant_name: { type: "string", minLength: 1, maxLength: 40 },
    change_note: CHANGE_NOTE_SCHEMA,
  }),
};

export function buildRecipeVariantPrompt(input: RecipeVariantInput): {
  call: AiCall;
  pantryRefs: Map<string, PantryItem>;
} {
  const recipe = requireCurrentRecipe(input.recipe);
  const missing = (Array.isArray(input.missing) ? input.missing : []).filter(
    (m) => typeof m === "string" && m.trim(),
  );
  const request = optionalText(input.request, "request");
  const wanted = [];
  if (request) wanted.push(`Wanted: ${request}`);
  if (missing.length > 0) {
    wanted.push(
      `Without: ${missing.join(", ")}. Replace them or leave them out.`,
    );
  }
  if (wanted.length === 0) {
    throw new AiError("bad_request", "request or missing is required");
  }
  const eaters = requireEaters(input.eaters);
  const pantry = describePantry(
    input.pantry,
    requireDate(input.today, "today"),
  );
  return {
    call: {
      locale: input.locale,
      householdId: input.householdId ?? null,
      input: [
        `Recipe: ${recipe.title} (variant "${recipe.variantName}")`,
        `Current version: ${describeContent(recipe.content)}`,
        wanted.join("\n"),
        describeEaters(eaters),
        pantry.text,
      ].join("\n\n"),
    },
    pantryRefs: pantry.refs,
  };
}

export async function runRecipeVariant(
  input: RecipeVariantInput,
  deps?: AiDeps,
): Promise<RecipeVariantResult> {
  const { call, pantryRefs } = buildRecipeVariantPrompt(input);
  const result = await callAi<Output>(RECIPE_VARIANT_TASK, call, deps);
  const { variant_name, change_note, ...content } = result.data;
  return {
    variantName: variant_name,
    changeNote: change_note,
    content: toStoredContent(content, pantryRefs, input.recipe.content),
    allergyConflicts: findAllergyConflicts(content.ingredients, input.eaters),
    model: result.model,
    attempts: result.attempts,
    usage: result.usage,
  };
}
