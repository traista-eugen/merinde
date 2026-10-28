// recipe-generate (#3): a new recipe from the cook's request, using the pantry.
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
  COVER_RULE,
  COVER_SCHEMA,
  describeEaters,
  describePantry,
  type ModelContent,
  type NewRecipe,
  type PantryItem,
  RECIPE_RULES,
  recipeSchema,
  requireDate,
  requireEaters,
  requireServings,
  requireText,
  TITLE_SCHEMA,
  toStoredContent,
} from "./recipe-common.ts";

export interface RecipeGenerateInput {
  locale: string;
  householdId?: string | null;
  /** What the cook asked for, e.g. "quick dinner, high protein". */
  request: string;
  servings: number;
  /** Everyone eating; their diets and allergies apply. */
  eaters: Eater[];
  /** Omit when "Use what's in the pantry" is off. */
  pantry?: PantryItem[];
  /** The household's date (YYYY-MM-DD), for expiry. */
  today: string;
}

export interface RecipeGenerateResult {
  recipe: NewRecipe;
  /** Not empty: don't save it as safe; show the allergy card. */
  allergyConflicts: AllergyConflict[];
  model: string;
  attempts: number;
  usage: AiResult<unknown>["usage"];
}

interface Output extends ModelContent {
  title: string;
  cover: number;
}

export const RECIPE_GENERATE_TASK: AiTask = {
  name: "recipe-generate",
  model: TEXT_MODEL,
  reasoningEffort: "medium",
  maxTokens: 8_000,
  system:
    `You write home-cooking recipes for Merinde, a household food app in Romania. Write one recipe for the cook's request.

${RECIPE_RULES}
- title: the dish's name, at most 60 characters.
- ${COVER_RULE}`,
  schema: recipeSchema({ title: TITLE_SCHEMA, cover: COVER_SCHEMA }),
};

export function buildRecipeGeneratePrompt(input: RecipeGenerateInput): {
  call: AiCall;
  pantryRefs: Map<string, PantryItem>;
} {
  const request = requireText(input.request, "request");
  const servings = requireServings(input.servings);
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
        `Request: ${request}`,
        `Servings: ${servings}`,
        describeEaters(eaters),
        pantry.text,
      ].join("\n\n"),
    },
    pantryRefs: pantry.refs,
  };
}

export async function runRecipeGenerate(
  input: RecipeGenerateInput,
  deps?: AiDeps,
): Promise<RecipeGenerateResult> {
  const { call, pantryRefs } = buildRecipeGeneratePrompt(input);
  const result = await callAi<Output>(RECIPE_GENERATE_TASK, call, deps);
  const { title, cover, ...content } = result.data;
  return {
    recipe: { title, cover, content: toStoredContent(content, pantryRefs) },
    allergyConflicts: findAllergyConflicts(content.ingredients, input.eaters),
    model: result.model,
    attempts: result.attempts,
    usage: result.usage,
  };
}
