export interface AuthIdentity {
  id: string;
  email: string;
  role: string;
  method: "api_key" | "supabase_jwt" | "skip_auth";
}

export type AuthResult =
  | { success: true; identity: AuthIdentity }
  | { success: false; error: string; status: number };
