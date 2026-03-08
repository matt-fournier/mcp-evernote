// Re-export from shared auth module
// Using relative imports for Supabase Edge Function bundler compatibility
export { authenticate } from "../_shared/mcp-auth/mod.ts";
export type { AuthIdentity, AuthResult, AuthError, AuthOutcome } from "../_shared/mcp-auth/mod.ts";
