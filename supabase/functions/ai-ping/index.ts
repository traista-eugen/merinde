// Checks the Meta API key end to end. See docs/ai-models.md#gateway.
// Callers send a secret key, which isn't a JWT, so deploy with
// --no-verify-jwt; handlePing checks the key itself.
import { secretKeys } from "../_shared/supabase-keys.ts";
import { handlePing } from "./handler.ts";

Deno.serve((req) => handlePing(req, { secretKeys: secretKeys() }));
