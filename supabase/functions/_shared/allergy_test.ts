import { assertEquals } from "jsr:@std/assert@^1";
import {
  allergensFor,
  allergensInName,
  type Eater,
  findAllergyConflicts,
} from "./allergy.ts";

Deno.test("keywords: Romanian and English names point to their EU allergen", () => {
  const cases: [string, string[]][] = [
    ["unt", ["milk"]],
    ["Smântână 20%", ["milk"]],
    ["telemea de vacă", ["milk"]],
    ["parmesan", ["milk"]],
    ["lapte pasteurizat", ["milk"]],
    ["ouă", ["eggs"]],
    ["maioneză", ["eggs"]],
    ["nuci", ["nuts"]],
    ["migdale feliate", ["nuts"]],
    ["alune de pădure", ["nuts"]],
    ["alune de pământ", ["peanuts"]],
    ["făină albă", ["gluten"]],
    ["paste penne", ["gluten"]],
    ["foi de plăcintă", ["gluten"]],
    ["sos de soia", ["gluten", "soy"]],
    ["creveți", ["crustaceans"]],
    ["fructe de mare", ["crustaceans", "molluscs"]],
    ["midii", ["molluscs"]],
    ["somon afumat", ["fish"]],
    ["țelină", ["celery"]],
    ["ţelină (cedilla)", ["celery"]],
    ["muștar de Dijon", ["mustard"]],
    ["tahini", ["sesame"]],
    ["vin alb sec", ["sulphites"]],
  ];
  for (const [name, expected] of cases) {
    assertEquals(allergensInName(name), expected, name);
  }
});

Deno.test("keywords: look-alike words and phrases don't match", () => {
  const safe = [
    "fasole păstăi", // păstăi ≠ pasta
    "pastă de tomate", // tomato paste, not pasta
    "păstârnac",
    "untură", // lard, not butter
    "lapte de cocos",
    "nucșoară", // nutmeg
    "nucă de cocos",
    "vinete", // aubergine, not wine
    "eggplant",
    "butternut squash",
    "carpaccio de vită",
    "orez cu conopidă",
    "spanac",
    "roșii",
  ];
  for (const name of safe) assertEquals(allergensInName(name), [], name);
  assertEquals(allergensInName("unt de arahide"), ["peanuts"]);
  assertEquals(allergensInName("couscous"), ["gluten"]); // gluten, not eggs ("ou")
});

Deno.test("allergies: chips, EU codes and Romanian names map to EU allergens", () => {
  assertEquals(allergensFor("lactose"), ["milk"]);
  assertEquals(allergensFor("Milk"), ["milk"]);
  assertEquals(allergensFor("shellfish"), ["crustaceans", "molluscs"]);
  assertEquals(allergensFor("tree_nuts"), ["nuts"]);
  assertEquals(allergensFor("Arahide"), ["peanuts"]);
  assertEquals(allergensFor("kiwi"), []);
});

const MIHAI: Eater = { name: "Mihai", allergies: ["nuts", "lactose"] };
const IOANA: Eater = { name: "Ioana", diets: ["vegetarian"], allergies: [] };

Deno.test("conflicts: found by the model's tag, by keyword, or both", () => {
  const conflicts = findAllergyConflicts(
    [
      { name: "sos special", allergens: ["nuts"] }, // tag only
      { name: "unt", allergens: [] }, // keyword only: the model missed it
      { name: "nuci", allergens: ["nuts"] }, // both
      { name: "spanac", allergens: [] },
    ],
    [MIHAI, IOANA],
  );
  assertEquals(conflicts, [
    {
      person: "Mihai",
      allergy: "nuts",
      allergen: "nuts",
      ingredient: "sos special",
      foundBy: ["tag"],
    },
    {
      person: "Mihai",
      allergy: "lactose",
      allergen: "milk",
      ingredient: "unt",
      foundBy: ["keyword"],
    },
    {
      person: "Mihai",
      allergy: "nuts",
      allergen: "nuts",
      ingredient: "nuci",
      foundBy: ["tag", "keyword"],
    },
  ]);
});

Deno.test("conflicts: none when nobody eating is allergic to anything used", () => {
  const ingredients = [
    { name: "spanac", allergens: [] },
    { name: "ouă", allergens: ["eggs"] },
    { name: "lapte de cocos", allergens: [] },
  ];
  assertEquals(findAllergyConflicts(ingredients, [MIHAI, IOANA]), []);
  assertEquals(findAllergyConflicts(ingredients, []), []);
});

Deno.test("conflicts: free-text allergies match their own words; duplicates collapse; where is kept", () => {
  const ana: Eater = {
    name: "Ana",
    allergies: ["kiwi", "milk", "lactose", " "],
  };
  const conflicts = findAllergyConflicts(
    [{ name: "Kiwi tăiat" }, { name: "iaurt grecesc", allergens: ["milk"] }],
    [ana],
    "2026-10-30 breakfast",
  );
  assertEquals(conflicts, [
    {
      person: "Ana",
      allergy: "kiwi",
      allergen: null,
      ingredient: "Kiwi tăiat",
      foundBy: ["keyword"],
      where: "2026-10-30 breakfast",
    },
    {
      person: "Ana",
      allergy: "milk",
      allergen: "milk",
      ingredient: "iaurt grecesc",
      foundBy: ["tag", "keyword"],
      where: "2026-10-30 breakfast",
    },
  ]);
});
