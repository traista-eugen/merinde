// Small helpers shared by the scanning tasks (pantry-parse, receipt-parse,
// label-read): input checks, dates, rounding and strict-schema objects.
import { AiError, type AiInputPart, type JsonSchema } from "../mod.ts";

export type ImagePart = Extract<AiInputPart, { type: "image" }>;

const DAY_MS = 86_400_000;

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

/**
 * Tasks never read the clock: the caller passes the user's local date, so
 * "today" matches the phone and tests stay deterministic.
 */
export function requireToday(today: unknown): string {
  if (!isCalendarDate(today)) {
    throw new AiError(
      "bad_request",
      `today must be a date like 2026-11-04, not ${JSON.stringify(today)}`,
    );
  }
  return today;
}

/** `date` (YYYY-MM-DD) moved by a number of days. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
    .toISOString().slice(0, 10);
}

/** 1 to `max` image parts; the gateway checks each URL and MIME type. */
export function requireImages(images: unknown, max: number): ImagePart[] {
  if (!Array.isArray(images) || images.length === 0) {
    throw new AiError("bad_request", "At least one photo is needed");
  }
  if (images.length > max) {
    throw new AiError("bad_request", `At most ${max} photos for this scan`);
  }
  for (const image of images) {
    if (image?.type !== "image") {
      throw new AiError("bad_request", "Only photos can be sent for this scan");
    }
  }
  return images as ImagePart[];
}

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Collapses runs of whitespace; the model sometimes pads or wraps text. */
export function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * An object schema in the shape the gateway's strict mode needs: closed, with
 * every property required. Optional fields use a null type instead.
 */
export function strictObject(
  properties: Record<string, JsonSchema>,
  options: { nullable?: boolean; description?: string } = {},
): JsonSchema {
  return {
    type: options.nullable ? ["object", "null"] : "object",
    ...(options.description ? { description: options.description } : {}),
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}
