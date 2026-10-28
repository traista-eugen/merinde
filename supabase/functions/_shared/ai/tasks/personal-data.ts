// Strips personal data from text the model read off a receipt. The prompt
// already forbids it; this is the second line of defence, because a receipt
// photo carries card digits, loyalty numbers and names (issue #16, decision
// 0005). Anything matched is removed, never masked, so nothing recoverable is
// left in a stored line.

export type PersonalDataKind =
  | "card"
  | "iban"
  | "email"
  | "phone"
  | "national_id"
  | "loyalty"
  | "staff";

interface Pattern {
  kind: PersonalDataKind;
  pattern: RegExp;
  /** For patterns that over-match: confirm before removing. */
  accept?: (match: string) => boolean;
}

// A loyalty or customer ID: 6 or more digits, in groups; or letters and digits.
const ID = String.raw`(?:\d(?:[ \-]?\d){5,}|[A-Z]{1,3}\d{6,})`;

// Order matters: the label patterns consume what follows them first.
const PATTERNS: Pattern[] = [
  {
    // "Casier: Ioana P." / "Operator 12": the rest of the line is a name.
    kind: "staff",
    pattern:
      /\b(?:casier(?:a)?|cashier|operator|v[aâ]nz[aă]tor(?:oare)?)\b\s*[:.\-]?.*$/gim,
  },
  {
    // "Card client: 9876 5432", "Mega Card 0012345678", "Lidl Plus 123456789".
    kind: "loyalty",
    pattern: new RegExp(
      String
        .raw`\b(?:card(?:ul)?(?:\s+(?:client|fidelitate|fidel|loialitate|loyalty))?|client\s+fidel|lidl\s+plus|kaufland\s+card|mega\s+card|carrefour\s+card|auchan\s+card|clubcard|loyalty|fidelitate|nr\.?\s*card)\b\s*(?:nr\.?|no\.?|id|#|:|-)*\s*${ID}`,
      "gi",
    ),
  },
  {
    kind: "staff",
    pattern:
      /\b(?:client|customer|nume|name|titular|cump[aă]r[aă]tor)\s*:.*$/gim,
  },
  { kind: "email", pattern: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g },
  {
    kind: "iban",
    pattern:
      /(?<![A-Za-z0-9])[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,4})?(?![A-Za-z0-9])/g,
  },
  {
    // 4-4-4-4 groups, masked or not: "4111 1111 1111 1111", "**** 1234".
    kind: "card",
    pattern:
      /(?<![\w*#•])(?:[0-9Xx*#•]{4}[ -]){2,3}[0-9Xx*#•]{1,4}(?![\w*#•])/g,
  },
  {
    // Amex: 4-6-5.
    kind: "card",
    pattern: /(?<!\d)\d{4}[ -]\d{6}[ -]\d{5}(?!\d)/g,
  },
  {
    // "************1111", "411111******1111", "XXXXXXXXXXXX1111".
    kind: "card",
    pattern: /(?<![\w])(?:\d{4,6})?(?:[*#•]{4,}|X{4,})\d{0,4}(?!\w)/g,
  },
  {
    // A bare 15 to 19 digit run. 13 and 14 digits are left alone: those are
    // EAN-13 and GTIN-14 product barcodes, which are not personal.
    kind: "card",
    pattern: /(?<!\d)\d{15,19}(?!\d)/g,
  },
  {
    kind: "phone",
    pattern:
      /(?<![\d+])(?:(?:\+|00)40[ .-]?|0)7\d{2}[ .-]?\d{3}[ .-]?\d{3}(?!\d)/g,
  },
  {
    kind: "phone",
    pattern: /(?<![\d+])0[23]\d{1,2}[ .-]?\d{3}[ .-]?\d{3,4}(?!\d)/g,
  },
  {
    kind: "phone",
    pattern: /(?<![\w+])\+\d{1,3}[ .-]?\d{2,4}[ .-]?\d{3}[ .-]?\d{3,4}(?!\d)/g,
  },
  {
    // Romanian personal ID (CNP); also a 13-digit run, so check its structure
    // and control digit, and leave genuine EAN-13 barcodes alone.
    kind: "national_id",
    pattern: /(?<!\d)\d{13}(?!\d)/g,
    accept: isCnp,
  },
];

export interface ScrubResult {
  text: string;
  /** What was removed, so a caller can drop a line that is about a person. */
  found: PersonalDataKind[];
}

/** Removes personal data from `text` and tidies the spaces it leaves. */
export function scrubPersonalData(text: string): ScrubResult {
  const found = new Set<PersonalDataKind>();
  let out = text;
  for (const { kind, pattern, accept } of PATTERNS) {
    out = out.replace(pattern, (match) => {
      if (accept && !accept(match)) return match;
      found.add(kind);
      return " ";
    });
  }
  return { text: out.replace(/\s+/g, " ").trim(), found: [...found] };
}

const CNP_KEY = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];
const CNP_SHAPE =
  /^[1-8]\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])(?:0[1-9]|[1-3]\d|4[0-6]|5[12])\d{4}$/;

function isCnp(digits: string): boolean {
  if (!CNP_SHAPE.test(digits) || isEan13(digits)) return false;
  const sum = CNP_KEY.reduce((s, k, i) => s + k * Number(digits[i]), 0) % 11;
  return (sum === 10 ? 1 : sum) === Number(digits[12]);
}

function isEan13(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(digits[12]);
}
