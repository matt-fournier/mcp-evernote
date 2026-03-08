import { createClient } from "npm:@supabase/supabase-js";
import type { AuthResult } from "./types.ts";

export async function validateSupabaseJwt(token: string): Promise<AuthResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SB_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseKey) {
    console.error("[AUTH:JWT] Supabase JWT authentication is not configured");
    return { success: false, error: "Supabase JWT authentication is not configured", status: 500 };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Try getClaims() first (new asymmetric key method, post-May 2025)
  if (typeof supabase.auth.getClaims === "function") {
    try {
      const { data, error } = await supabase.auth.getClaims(token);
      if (!error && data?.claims) {
        const claims = data.claims;
        console.log(`[AUTH:JWT] Authenticated via getClaims(): ${claims.email ?? claims.sub}`);
        return {
          success: true,
          identity: {
            id: claims.sub as string,
            email: (claims.email as string) ?? "",
            role: (claims.role as string) ?? "authenticated",
            method: "supabase_jwt",
          },
        };
      }
      if (error) {
        console.warn(`[AUTH:JWT] getClaims() failed: ${error.message}`);
      }
    } catch (err) {
      console.warn(`[AUTH:JWT] getClaims() threw: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Fallback to getUser() (legacy symmetric key method)
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return { success: false, error: "Invalid or expired JWT", status: 401 };
    }
    console.log(`[AUTH:JWT] Authenticated via getUser(): ${user.email}`);
    return {
      success: true,
      identity: {
        id: user.id,
        email: user.email ?? "",
        role: user.role ?? "authenticated",
        method: "supabase_jwt",
      },
    };
  } catch (err) {
    console.error(`[AUTH:JWT] getUser() threw: ${err instanceof Error ? err.message : err}`);
    return { success: false, error: "Invalid or expired JWT", status: 401 };
  }
}
