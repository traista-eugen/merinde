// Test data for the recipe and meal-plan task tests.
import type { Eater } from "../../allergy.ts";
import type { AiDeps } from "../client.ts";
import { completion, memorySink, mockFetch } from "../testing.ts";
import type {
  ModelIngredient,
  PantryItem,
  RecipeContent,
} from "./recipe-common.ts";

export const TODAY = "2026-10-28";

export const EATERS: Eater[] = [
  { name: "Ioana", diets: ["vegetarian"], allergies: [] },
  { name: "Mihai", allergies: ["nuts", "lactose"] },
];

/** Sorted by expiry, the refs are p1 dill, p2 spinach, p3 eggs, p4 salt. */
export const PANTRY: PantryItem[] = [
  { productId: "prod-salt", name: "sare", level: "have" },
  {
    productId: "prod-spinach",
    name: "spanac",
    quantity: 500,
    unit: "g",
    expiresOn: "2026-10-30",
  },
  {
    productId: "prod-eggs",
    name: "ouă",
    quantity: 6,
    unit: "pc",
    expiresOn: "2026-11-10",
  },
  {
    productId: "prod-dill",
    name: "mărar",
    quantity: 1,
    unit: "pc",
    expiresOn: "2026-10-29",
  },
  { productId: "prod-yogurt", name: "iaurt", level: "out" },
];

export function ingredient(
  name: string,
  overrides: Partial<ModelIngredient> = {},
): ModelIngredient {
  return {
    name,
    quantity: 100,
    unit: "g",
    pantry_ref: null,
    allergens: [],
    ...overrides,
  };
}

/** The model's content for a spinach pie that is safe for EATERS. */
export const SPINACH_PIE = {
  servings: 4,
  total_minutes: 50,
  ingredients: [
    ingredient("spanac", { quantity: 500, pantry_ref: "p2" }),
    ingredient("ouă", {
      quantity: 3,
      unit: "pc",
      pantry_ref: "p3",
      allergens: ["eggs"],
    }),
    ingredient("mărar", { quantity: 1, unit: "bunch", pantry_ref: "p1" }),
    ingredient("foi de plăcintă", { quantity: 400, allergens: ["gluten"] }),
    ingredient("sare", { quantity: null, unit: null, pantry_ref: "p4" }),
  ],
  steps: [
    "Spală și toacă spanacul.",
    "Amestecă cu ouăle.",
    "Coace 40 de minute.",
  ],
};

/** A stored version, as recipe-edit and recipe-variant get it. */
export const STORED_PIE: RecipeContent = {
  servings: 4,
  total_minutes: 50,
  ingredients: [
    {
      name: "spanac",
      quantity: 500,
      unit: "g",
      allergens: [],
      product_id: "prod-spinach",
    },
    {
      name: "ouă",
      quantity: 3,
      unit: "pc",
      allergens: ["eggs"],
      product_id: "prod-eggs",
    },
    {
      name: "telemea",
      quantity: 200,
      unit: "g",
      allergens: ["milk"],
      product_id: "prod-telemea",
    },
  ],
  steps: ["Amestecă totul.", "Coace 40 de minute."],
};

/** Gateway deps that answer with these model outputs, in order. */
export function aiDeps(...outputs: unknown[]) {
  const mock = mockFetch(outputs.map((o) => completion(JSON.stringify(o))));
  const usage = memorySink();
  const deps: AiDeps = {
    fetch: mock.fetch,
    apiKey: "test-key",
    usageSink: usage.sink,
  };
  return { deps, requests: mock.requests, rows: usage.rows };
}

/** The system and user messages of a recorded request. */
export function messages(request: { body: unknown }): {
  system: string;
  user: string;
} {
  const [system, user] =
    (request.body as { messages: { content: string }[] }).messages;
  return { system: system.content, user: user.content };
}
