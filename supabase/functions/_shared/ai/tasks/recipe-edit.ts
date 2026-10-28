// recipe-edit (#4): the next version of the same variant, after a change
// request. Only the current version is sent, never a chat history.
import {
  type AllergyConflict,
  type Eater,
  findAllergyConflicts,
} from "../../allergy.ts";
import {
  type AiCall,
  type AiDeps,
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
  type PantryItem,
  RECIPE_RULES,
  type RecipeContent,
  recipeSchema,
  requireCurrentRecipe,
  requireDate,
  requireEaters,
  requireText,
  toStoredContent,
} from "./recipe-common.ts";

export interface RecipeEditInput {
  locale: string;
  householdId?: string | null;
  recipe: CurrentRecipe;
  /** What the cook asked for, e.g. "less salt" or "no oven". */
  change: string;
  eaters: Eater[];
  pantry?: PantryItem[];
  /** The household's date (YYYY-MM-DD), for expiry. */
  today: string;
}

export interface RecipeEditResult {
  /** The variant's next version. */
  content: RecipeContent;
  changeNote: string;
  allergyConflicts: AllergyConflict[];
  model: string;
  attempts: number;
  usage: AiResult<unknown>["usage"];
}

interface Output extends ModelContent {
  change_note: string;
}

export const RECIPE_EDIT_TASK: AiTask = {
  name: "recipe-edit",
  model: TEXT_MODEL,
  reasoningEffort: "low",
  maxTokens: 6_000,
  system:
    `You edit recipes for Merinde, a household food app in Romania. You get the current version of a recipe and a change the cook asked for. Return the next version of the same recipe: apply the change, and keep everything the change doesn't touch exactly as it was.

${RECIPE_RULES}
- change_note: one short sentence saying what changed, e.g. "Cooked in a pan instead of the oven".`,
  schema: recipeSchema({ change_note: CHANGE_NOTE_SCHEMA }),
};

export function buildRecipeEditPrompt(input: RecipeEditInput): {
  call: AiCall;
  pantryRefs: Map<string, PantryItem>;
} {
  const recipe = requireCurrentRecipe(input.recipe);
  const change = requireText(input.change, "change");
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
        `Change: ${change}`,
        describeEaters(eaters),
        pantry.text,
      ].join("\n\n"),
    },
    pantryRefs: pantry.refs,
  };
}

export async function runRecipeEdit(
  input: RecipeEditInput,
  deps?: AiDeps,
): Promise<RecipeEditResult> {
  const { call, pantryRefs } = buildRecipeEditPrompt(input);
  const result = await callAi<Output>(RECIPE_EDIT_TASK, call, deps);
  const { change_note, ...content } = result.data;
  return {
    content: toStoredContent(content, pantryRefs, input.recipe.content),
    changeNote: change_note,
    allergyConflicts: findAllergyConflicts(content.ingredients, input.eaters),
    model: result.model,
    attempts: result.attempts,
    usage: result.usage,
  };
}
