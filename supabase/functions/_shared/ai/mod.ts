// The AI gateway: every AI edge function calls the Meta Model API through
// callAi. Usage and rules: docs/ai-models.md#gateway.

export {
  type AiCall,
  type AiDeps,
  type AiInputPart,
  type AiResult,
  type AiTask,
  callAi,
  type ImageType,
  META_API_URL,
  type ReasoningEffort,
} from "./client.ts";
export { AiError, type AiErrorCode, errorResponse } from "./errors.ts";
export { assertAllowedModel, AUDIO_MODEL, TEXT_MODEL } from "./models.ts";
export { type JsonSchema, schemaProblems, validate } from "./schema.ts";
export { type AiUsageRow, supabaseUsageSink, type UsageSink } from "./usage.ts";
