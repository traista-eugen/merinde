// Checks the Meta API key end to end. See docs/ai-models.md#gateway.
import { secretKeys } from "../_shared/supabase-keys.ts";
import { handlePing } from "./handler.ts";

Deno.serve((req) => handlePing(req, { secretKeys: secretKeys() }));
