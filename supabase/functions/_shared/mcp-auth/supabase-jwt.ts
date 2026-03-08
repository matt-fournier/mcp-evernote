import type { AuthOutcome } from "./types.ts";

export async function validateSupabaseJwt(token: string): Promise<AuthOutcome> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SB_PUBLISHABLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !publishableKey) {
    return {
      success: false,
      error: "Supabase JWT validation not configured",
      status: 500,
    };
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: publishableKey,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: "Invalid or expired JWT token",
        status: 401,
      };
    }

    const user = await response.json();

    return {
      success: true,
      identity: {
        id: user.id ?? "unknown",
        email: user.email ?? "unknown@unknown",
        role: user.role ?? "authenticated",
        method: "supabase_jwt",
      },
    };
  } catch {
    return {
      success: false,
      error: "Failed to validate JWT token",
      status: 500,
    };
  }
}
