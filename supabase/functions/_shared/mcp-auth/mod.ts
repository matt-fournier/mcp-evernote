import { validateApiKey } from "./api-key.ts";
import { validateSupabaseJwt } from "./supabase-jwt.ts";
import type { AuthOutcome, AuthIdentity } from "./types.ts";

export type { AuthIdentity, AuthResult, AuthError, AuthOutcome } from "./types.ts";

const DEV_IDENTITY: AuthIdentity = {
  id: "dev",
  email: "dev@localhost",
  role: "admin",
  method: "skip_auth",
};

export async function authenticate(req: Request): Promise<AuthOutcome> {
  // Dev mode: skip auth entirely
  if (Deno.env.get("SKIP_AUTH") === "true") {
    return { success: true, identity: DEV_IDENTITY };
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      success: false,
      error: "Missing or invalid Authorization header. Expected: Bearer <token>",
      status: 401,
    };
  }

  const token = authHeader.slice(7);

  // API key strategy
  if (token.startsWith("mcp_sk_")) {
    return validateApiKey(token);
  }

  // JWT strategy (fallback)
  return await validateSupabaseJwt(token);
}
