export interface AuthIdentity {
  id: string;
  email: string;
  role: string;
  method: "api_key" | "supabase_jwt" | "skip_auth";
}

export interface AuthResult {
  success: true;
  identity: AuthIdentity;
}

export interface AuthError {
  success: false;
  error: string;
  status: number;
}

export type AuthOutcome = AuthResult | AuthError;
