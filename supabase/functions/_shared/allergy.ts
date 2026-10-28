// The allergy check in code (#28). The model tags allergens and is told to
// avoid them, but a recipe or plan is only safe to save when this check finds
// no conflict for anyone eating. It flags an ingredient when the model's tags
// or a Romanian or English keyword in its name match someone's allergy.

/** The 14 allergens EU law requires on labels (Regulation 1169/2011, Annex II). */
export const EU_ALLERGENS = [
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soy",
  "milk",
  "nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
] as const;

export type Allergen = typeof EU_ALLERGENS[number];

/** Someone eating the dish, as stored on `member`. */
export interface Eater {
  name: string;
  diets?: readonly string[];
  /** EU codes, the app's chips ("lactose", "shellfish"…) or free text ("kiwi"). */
  allergies: readonly string[];
}

export interface IngredientToCheck {
  name: string;
  /** Allergen tags from the model or the product catalogue. */
  allergens?: readonly string[];
}

export interface AllergyConflict {
  person: string;
  /** The allergy as the member stored it. */
  allergy: string;
  /** The EU allergen behind it; null for a free-text allergy. */
  allergen: Allergen | null;
  ingredient: string;
  foundBy: ("tag" | "keyword")[];
  /** Which meal, for plans, e.g. "2026-10-30 dinner". */
  where?: string;
}

// Keywords are matched word by word against the ingredient name, after
// lowercasing and removing diacritics. A keyword word of 4 or more letters also
// matches longer words that start with it ("nuci" → "nucile"); shorter ones,
// and ones ending in "$", must match exactly ("unt" ≠ "untura", "pasta$" ≠
// "pastai").
const KEYWORDS: Record<Allergen, string[]> = {
  gluten: [
    "faina",
    "flour",
    "grau",
    "wheat",
    "paine",
    "bread",
    "chifla",
    "bagheta",
    "baguette",
    "lipie",
    "pita",
    "toast",
    "crutoane",
    "croutons",
    "pesmet",
    "breadcrumbs",
    "panko",
    "paste$",
    "pasta$",
    "spaghete",
    "spaghetti",
    "macaroane",
    "macaroni",
    "penne",
    "fusilli",
    "tagliatelle",
    "lasagna",
    "lasagne",
    "taitei",
    "noodles",
    "ravioli",
    "tortellini",
    "gnocchi",
    "cuscus",
    "couscous",
    "bulgur",
    "gris",
    "semolina",
    "orz",
    "orzo",
    "barley",
    "secara",
    "rye",
    "ovaz",
    "oat",
    "oats",
    "spelta",
    "spelt",
    "alac",
    "kamut",
    "malt",
    "bere",
    "beer",
    "seitan",
    "aluat",
    "dough",
    "foietaj",
    "pastry",
    "blat",
    "tortilla",
    "biscuiti",
    "biscuits",
    "cookies",
    "crackers",
    "cozonac",
    "clatite",
    "pancakes",
    "pizza",
    "placinta",
    "prajitura",
    "chec$",
    "tort$",
    "tarta$",
    "cake",
    "pie",
    "covrigi",
    "gogosi",
    "croissant",
    "sos de soia",
    "soy sauce",
  ],
  crustaceans: [
    "creveti",
    "shrimp",
    "prawn",
    "homar",
    "lobster",
    "crab",
    "raci",
    "crayfish",
    "langustine",
    "langoustine",
    "scampi",
    "fructe de mare",
    "seafood",
  ],
  eggs: [
    "ou",
    "oua",
    "oul",
    "ouale",
    "egg",
    "eggs",
    "albus",
    "galbenus",
    "maioneza",
    "mayonnaise",
    "mayo",
    "bezea",
    "meringue",
    "omleta",
    "omelette",
    "aioli",
  ],
  fish: [
    "peste",
    "fish",
    "ton",
    "tuna",
    "somon",
    "salmon",
    "cod",
    "macrou",
    "mackerel",
    "hering",
    "herring",
    "sardine",
    "sardina",
    "anchois",
    "hamsii",
    "anchovy",
    "anchovies",
    "pastrav",
    "trout",
    "crap",
    "carp$",
    "salau",
    "dorada",
    "biban",
    "icre",
    "caviar",
    "worcestershire",
  ],
  peanuts: ["arahide", "arahida", "alune de pamant", "peanut"],
  soy: ["soia", "soya", "soy", "tofu", "edamame", "miso", "tempeh"],
  milk: [
    "lapte",
    "milk",
    "unt",
    "untul",
    "butter",
    "smantana",
    "cream",
    "frisca",
    "branza",
    "cheese",
    "telemea",
    "cascaval",
    "urda",
    "cas",
    "iaurt",
    "yogurt",
    "yoghurt",
    "kefir",
    "sana",
    "mozzarella",
    "parmezan",
    "parmesan",
    "ricotta",
    "mascarpone",
    "feta",
    "cheddar",
    "gouda",
    "emmental",
    "gorgonzola",
    "burrata",
    "halloumi",
    "zer",
    "whey",
    "ghee",
    "lactoza",
    "lactose",
    "lactate",
    "cottage",
    "besamel",
    "bechamel",
    "inghetata",
  ],
  nuts: [
    "nuca",
    "nuci",
    "walnut",
    "migdale",
    "migdala",
    "almond",
    "alune",
    "hazelnut",
    "caju",
    "cashew",
    "fistic",
    "pistachio",
    "pecan",
    "macadamia",
    "nut",
    "nuts",
    "praline",
    "marzipan",
    "martipan",
    "gianduja",
    "nutella",
  ],
  celery: ["telina", "celery", "celeriac"],
  mustard: ["mustar", "mustard", "dijon"],
  sesame: ["susan", "sesame", "tahini", "tahina"],
  sulphites: [
    "vin",
    "vinul",
    "wine",
    "sulfiti",
    "sulfites",
    "sulphites",
    "metabisulfit",
  ],
  lupin: ["lupin", "lupine"],
  molluscs: [
    "midii",
    "mussel",
    "mussels",
    "scoici",
    "clam",
    "clams",
    "stridii",
    "oyster",
    "oysters",
    "calamar",
    "calamari",
    "squid",
    "caracatita",
    "octopus",
    "sepie",
    "cuttlefish",
    "melci",
    "snails",
    "scallops",
    "fructe de mare",
    "seafood",
  ],
};

// Phrases removed before matching one allergen, because they contain a
// keyword but not the allergen.
const NOT: Partial<Record<Allergen, string[]>> = {
  gluten: [
    "pasta de",
    "tomato paste",
    "faina de migdale",
    "faina de porumb",
    "faina de orez",
    "faina de cocos",
    "faina de naut",
    "almond flour",
    "corn flour",
    "rice flour",
    "coconut flour",
    "chickpea flour",
    "tortilla de porumb",
    "corn tortilla",
    "pitaya",
  ],
  milk: [
    "lapte de cocos",
    "coconut milk",
    "coconut cream",
    "crema de cocos",
    "lapte de migdale",
    "almond milk",
    "lapte de soia",
    "soy milk",
    "lapte de ovaz",
    "oat milk",
    "lapte de orez",
    "rice milk",
    "unt de arahide",
    "peanut butter",
    "unt de cacao",
    "cocoa butter",
    "butternut",
  ],
  nuts: ["alune de pamant", "nuca de cocos"],
};

// Member allergies other than the EU codes themselves: the app's chips and
// common English and Romanian names.
const ALLERGY_NAMES: Record<string, Allergen[]> = {
  lactose: ["milk"],
  lactoza: ["milk"],
  dairy: ["milk"],
  lapte: ["milk"],
  lactate: ["milk"],
  egg: ["eggs"],
  oua: ["eggs"],
  wheat: ["gluten"],
  grau: ["gluten"],
  peanut: ["peanuts"],
  arahide: ["peanuts"],
  "tree nuts": ["nuts"],
  nuci: ["nuts"],
  shellfish: ["crustaceans", "molluscs"],
  seafood: ["crustaceans", "molluscs"],
  "fructe de mare": ["crustaceans", "molluscs"],
  crustacean: ["crustaceans"],
  crustacee: ["crustaceans"],
  mollusc: ["molluscs"],
  mollusk: ["molluscs"],
  mollusks: ["molluscs"],
  moluste: ["molluscs"],
  peste: ["fish"],
  soya: ["soy"],
  soia: ["soy"],
  susan: ["sesame"],
  telina: ["celery"],
  mustar: ["mustard"],
  sulfites: ["sulphites"],
  sulfiti: ["sulphites"],
};

const ALLERGEN_SET = new Set<string>(EU_ALLERGENS);

/** Lowercase, no diacritics (ș→s, ă→a…), words separated by single spaces. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function containsKeyword(words: string[], keyword: string): boolean {
  const parts = keyword.split(" ");
  for (let i = 0; i + parts.length <= words.length; i++) {
    if (parts.every((part, j) => wordMatches(words[i + j], part))) {
      return true;
    }
  }
  return false;
}

function wordMatches(word: string, part: string): boolean {
  if (part.endsWith("$")) return word === part.slice(0, -1);
  return part.length >= 4 ? word.startsWith(part) : word === part;
}

function removePhrases(text: string, phrases: string[] | undefined): string {
  let padded = ` ${text} `;
  for (const phrase of phrases ?? []) {
    padded = padded.replaceAll(` ${phrase} `, " ");
  }
  return padded.trim();
}

/** The EU allergens an ingredient name points to, by keyword. */
export function allergensInName(name: string): Allergen[] {
  const text = normalize(name);
  return EU_ALLERGENS.filter((allergen) => {
    const words = removePhrases(text, NOT[allergen]).split(" ");
    return KEYWORDS[allergen].some((keyword) =>
      containsKeyword(words, keyword)
    );
  });
}

/**
 * The EU allergens behind a member's allergy, or an empty list for free text
 * like "kiwi", which is then matched as a keyword itself.
 */
export function allergensFor(allergy: string): Allergen[] {
  const key = normalize(allergy.replaceAll("_", " "));
  if (ALLERGEN_SET.has(key)) return [key as Allergen];
  return ALLERGY_NAMES[key] ?? [];
}

/**
 * Every ingredient that conflicts with an allergy of someone eating. An empty
 * list means the dish is safe to save for these people.
 */
export function findAllergyConflicts(
  ingredients: readonly IngredientToCheck[],
  eaters: readonly Eater[],
  where?: string,
): AllergyConflict[] {
  const conflicts: AllergyConflict[] = [];
  const seen = new Set<string>();
  const add = (conflict: AllergyConflict) => {
    const key = [
      conflict.person,
      conflict.allergen ?? conflict.allergy,
      conflict.ingredient,
    ].join("\u0000");
    if (seen.has(key)) return;
    seen.add(key);
    conflicts.push(where === undefined ? conflict : { ...conflict, where });
  };

  for (const ingredient of ingredients) {
    const tags = new Set(
      (ingredient.allergens ?? []).map((tag) => normalize(tag)),
    );
    const byName = new Set<string>(allergensInName(ingredient.name));
    const words = normalize(ingredient.name).split(" ");

    for (const eater of eaters) {
      for (const allergy of eater.allergies) {
        if (!normalize(allergy)) continue;
        const allergens = allergensFor(allergy);
        if (allergens.length === 0) {
          // Free text: the allergy's own words are the keyword.
          if (containsKeyword(words, normalize(allergy))) {
            add({
              person: eater.name,
              allergy,
              allergen: null,
              ingredient: ingredient.name,
              foundBy: ["keyword"],
            });
          }
          continue;
        }
        for (const allergen of allergens) {
          const foundBy: AllergyConflict["foundBy"] = [];
          if (tags.has(allergen)) foundBy.push("tag");
          if (byName.has(allergen)) foundBy.push("keyword");
          if (foundBy.length > 0) {
            add({
              person: eater.name,
              allergy,
              allergen,
              ingredient: ingredient.name,
              foundBy,
            });
          }
        }
      }
    }
  }
  return conflicts;
}
