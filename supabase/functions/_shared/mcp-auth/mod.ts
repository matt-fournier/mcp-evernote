import type { AuthIdentity, AuthResult } from "./types.ts";
import { validateApiKey } from "./api-key.ts";
import { validateSupabaseJwt } from "./supabase-jwt.ts";

export type { AuthIdentity, AuthResult };

const API_KEY_PREFIX = "mcp_sk_";

const DEV_IDENTITY: AuthIdentity = {
  id: "dev-local-user",
  email: "dev@localhost",
  role: "admin",
  method: "skip_auth",
};

export async function authenticate(req: Request): Promise<AuthResult> {
  if (Deno.env.get("SKIP_AUTH") === "true") {
    console.warn("[AUTH] SKIP_AUTH is enabled — returning dev identity");
    return { success: true, identity: DEV_IDENTITY };
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { success: false, error: "Missing or malformed Authorization header", status: 401 };
  }

  const token = authHeader.slice(7);
  if (!token) {
    return { success: false, error: "Missing or malformed Authorization header", status: 401 };
  }

  if (token.startsWith(API_KEY_PREFIX)) {
    return validateApiKey(token);
  }

  return await validateSupabaseJwt(token);
}
