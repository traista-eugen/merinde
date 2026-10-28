import { AiError } from "./errors.ts";

// Model choice and prices: docs/ai-models.md and decision 0003.

/** Text, images and PDFs. */
export const TEXT_MODEL = "muse-spark-1.3";

/** Audio only: Spark 1.3 doesn't fully support audio yet. */
export const AUDIO_MODEL = "muse-spark-1.2";

/**
 * Throws for any -contributor model. Meta may train on what we send to that
 * tier, and we send family receipts and pantry data (decision 0003).
 */
export function assertAllowedModel(model: string): void {
  if (/contributor/i.test(model)) {
    throw new AiError(
      "model_refused",
      `Model "${model}" is the -contributor tier, which Meta may train on; Merinde never uses it (decision 0003)`,
    );
  }
}
