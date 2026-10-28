// The subset of JSON Schema that tasks may use. The same schema is sent to the
// Meta API as a strict json_schema and checked again here before a reply is
// returned, so a keyword this file doesn't know is rejected, not ignored.

export type JsonType =
  | "object"
  | "array"
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "null";

type Primitive = string | number | boolean | null;

export interface JsonSchema {
  type?: JsonType | JsonType[];
  description?: string;
  title?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  enum?: Primitive[];
  const?: Primitive;
  anyOf?: JsonSchema[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: "date" | "date-time";
}

const KEYWORDS = new Set([
  "type",
  "description",
  "title",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "minItems",
  "maxItems",
  "enum",
  "const",
  "anyOf",
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
  "pattern",
  "format",
]);
const FORMATS = new Set(["date", "date-time"]);

/** Meta rejects schemas nested deeper than this. */
const MAX_DEPTH = 10;

/**
 * Lists what's wrong with a task schema: keywords this validator doesn't
 * support, and Meta's strict-mode rules (plain object root, every object
 * closed with additionalProperties: false and every property required;
 * optional fields use a null type instead).
 */
export function schemaProblems(schema: JsonSchema): string[] {
  const problems: string[] = [];
  if (schema.type !== "object" || schema.anyOf) {
    problems.push("$: the root must be a plain object");
  }
  walk(schema, "$", 1, problems);
  return problems;
}

function walk(
  schema: JsonSchema,
  path: string,
  depth: number,
  problems: string[],
): void {
  if (depth > MAX_DEPTH) {
    problems.push(`${path}: nested deeper than ${MAX_DEPTH} levels`);
    return;
  }
  for (const key of Object.keys(schema)) {
    if (!KEYWORDS.has(key)) {
      problems.push(`${path}: unsupported keyword "${key}"`);
    }
  }
  if (
    schema.type === undefined && schema.anyOf === undefined &&
    schema.enum === undefined && schema.const === undefined
  ) {
    problems.push(`${path}: needs a type, enum, const or anyOf`);
  }
  if (schema.format !== undefined && !FORMATS.has(schema.format)) {
    problems.push(`${path}: unsupported format "${schema.format}"`);
  }
  if (schema.pattern !== undefined) {
    try {
      new RegExp(schema.pattern, "u");
    } catch {
      problems.push(`${path}: invalid pattern`);
    }
  }

  const types = typesOf(schema);
  if (types.includes("object")) {
    if (schema.additionalProperties !== false) {
      problems.push(`${path}: objects need additionalProperties: false`);
    }
    const properties = schema.properties ?? {};
    const required = new Set(schema.required ?? []);
    for (const name of Object.keys(properties)) {
      if (!required.has(name)) {
        problems.push(
          `${path}.${name}: must be required (use a null type for optional fields)`,
        );
      }
    }
    for (const name of required) {
      if (!Object.hasOwn(properties, name)) {
        problems.push(`${path}: required "${name}" isn't in properties`);
      }
    }
    for (const [name, child] of Object.entries(properties)) {
      walk(child, `${path}.${name}`, depth + 1, problems);
    }
  }
  if (types.includes("array")) {
    if (schema.items === undefined) problems.push(`${path}: arrays need items`);
    else walk(schema.items, `${path}[]`, depth + 1, problems);
  }
  schema.anyOf?.forEach((option, i) =>
    walk(option, `${path}.anyOf[${i}]`, depth, problems)
  );
}

/** Checks a value against a schema; returns one message per problem. */
export function validate(schema: JsonSchema, value: unknown): string[] {
  const errors: string[] = [];
  check(schema, value, "$", errors);
  return errors;
}

function check(
  schema: JsonSchema,
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (
    schema.anyOf &&
    !schema.anyOf.some((option) => validate(option, value).length === 0)
  ) {
    errors.push(`${path}: matches none of the allowed shapes`);
    return;
  }
  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${path}: must be ${JSON.stringify(schema.const)}`);
    return;
  }
  if (schema.enum && !schema.enum.includes(value as Primitive)) {
    errors.push(`${path}: must be one of ${JSON.stringify(schema.enum)}`);
    return;
  }
  const types = typesOf(schema);
  const actual = typeOfValue(value);
  if (
    types.length > 0 &&
    !types.some((t) => t === actual || (t === "number" && actual === "integer"))
  ) {
    errors.push(`${path}: expected ${types.join(" or ")}, got ${actual}`);
    return;
  }

  if (typeof value === "string") checkString(schema, value, path, errors);
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path}: must be at least ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path}: must be at most ${schema.maximum}`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path}: needs at least ${schema.minItems} items`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${path}: allows at most ${schema.maxItems} items`);
    }
    if (schema.items) {
      const items = schema.items;
      value.forEach((item, i) => check(items, item, `${path}[${i}]`, errors));
    }
  }
  if (actual === "object") {
    const object = value as Record<string, unknown>;
    const properties = schema.properties ?? {};
    for (const name of schema.required ?? []) {
      if (!Object.hasOwn(object, name)) {
        errors.push(`${path}: missing "${name}"`);
      }
    }
    for (const [name, child] of Object.entries(object)) {
      // hasOwn, so keys like "__proto__" or "constructor" can't match a
      // prototype property and slip past additionalProperties.
      if (Object.hasOwn(properties, name)) {
        check(properties[name], child, `${path}.${name}`, errors);
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}: unexpected property "${name}"`);
      }
    }
  }
}

function checkString(
  schema: JsonSchema,
  value: string,
  path: string,
  errors: string[],
): void {
  const length = [...value].length;
  if (schema.minLength !== undefined && length < schema.minLength) {
    errors.push(`${path}: needs at least ${schema.minLength} characters`);
  }
  if (schema.maxLength !== undefined && length > schema.maxLength) {
    errors.push(`${path}: allows at most ${schema.maxLength} characters`);
  }
  if (
    schema.pattern !== undefined && !new RegExp(schema.pattern, "u").test(value)
  ) {
    errors.push(`${path}: doesn't match ${schema.pattern}`);
  }
  if (schema.format === "date" && !isDate(value)) {
    errors.push(`${path}: must be a date like 2026-11-04`);
  }
  if (schema.format === "date-time" && !isDateTime(value)) {
    errors.push(`${path}: must be a date-time like 2026-11-04T21:00:00Z`);
  }
}

function typesOf(schema: JsonSchema): JsonType[] {
  if (schema.type === undefined) return [];
  return Array.isArray(schema.type) ? schema.type : [schema.type];
}

function typeOfValue(value: unknown): JsonType {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  return "object";
}

function isDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function isDateTime(value: string): boolean {
  const match =
    /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/i.exec(
      value,
    );
  return match !== null && isDate(match[1]) && !Number.isNaN(Date.parse(value));
}
