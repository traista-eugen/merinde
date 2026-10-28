export type AiErrorCode =
  | "bad_request" // the caller's input is unusable (locale, images, empty input)
  | "config" // missing API key or a task definition the gateway can't send
  | "model_refused" // a -contributor model (decision 0003)
  | "upstream" // the Meta API was unreachable or returned an HTTP error
  | "timeout"
  | "invalid_output"; // the reply failed the task's schema twice

export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AiError";
  }
}

const STATUS: Record<AiErrorCode, number> = {
  bad_request: 400,
  config: 500,
  model_refused: 500,
  upstream: 502,
  timeout: 504,
  invalid_output: 502,
};

/**
 * Turns an error into a JSON response for the app. Only `bad_request`
 * messages reach the app; everything else goes to the function logs.
 */
export function errorResponse(err: unknown): Response {
  if (err instanceof AiError) {
    if (err.code === "bad_request") {
      return Response.json({ error: err.code, message: err.message }, {
        status: STATUS[err.code],
      });
    }
    console.error(`[ai] ${err.code}: ${err.message}`, err.details ?? "");
    return Response.json({ error: err.code }, { status: STATUS[err.code] });
  }
  console.error("[ai] unexpected error", err);
  return Response.json({ error: "internal" }, { status: 500 });
}
