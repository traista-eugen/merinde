import { AiError } from "./errors.ts";

// Model choice and prices: docs/ai-models.md and decision 0003.

/** Text, images and PDFs. */
export const TEXT_MODEL = "muse-spark-1.3";

/** Audio only: Spark 1.3 doesn't fully support audio yet. */
export const AUDIO_MODEL = "muse-spark-1.2";

/** The model the rule picks for an input. */
export function defaultModel(hasAudio: boolean): string {
  return hasAudio ? AUDIO_MODEL : TEXT_MODEL;
}

/**
 * Allows only the rule's model: muse-spark-1.3 for text and images,
 * muse-spark-1.2 only when the input has audio. Throws `model_refused` for
 * any -contributor model, because Meta may train on what we send to that tier
 * and we send family receipts and pantry data (decision 0003). Throws `config`
 * for anything else.
 */
export function assertAllowedModel(model: string, hasAudio: boolean): void {
  if (/contributor/i.test(model)) {
    throw new AiError(
      "model_refused",
      `Model "${model}" is the -contributor tier, which Meta may train on; Merinde never uses it (decision 0003)`,
    );
  }
  const expected = defaultModel(hasAudio);
  if (model !== expected) {
    throw new AiError(
      "config",
      `Model "${model}" isn't allowed for ${
        hasAudio ? "audio" : "text and image"
      } input; use ${expected} (decision 0003)`,
    );
  }
}
