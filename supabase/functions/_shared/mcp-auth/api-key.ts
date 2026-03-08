import type { AuthOutcome } from "./types.ts";

/**
 * Parse MCP_API_KEYS env var format: "label1:mcp_sk_XXX,label2:mcp_sk_YYY"
 */
function parseApiKeys(): Map<string, string> {
  const raw = Deno.env.get("MCP_API_KEYS") ?? "";
  const keys = new Map<string, string>();
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;
    const label = trimmed.slice(0, colonIndex).trim();
    const key = trimmed.slice(colonIndex + 1).trim();
    if (label && key) keys.set(key, label);
  }
  return keys;
}

export function validateApiKey(token: string): AuthOutcome {
  if (!token.startsWith("mcp_sk_")) {
    return { success: false, error: "Invalid API key format", status: 401 };
  }

  const keys = parseApiKeys();
  const label = keys.get(token);

  if (!label) {
    return { success: false, error: "Invalid API key", status: 401 };
  }

  return {
    success: true,
    identity: {
      id: `apikey:${label}`,
      email: `${label}@mcp.local`,
      role: "service",
      method: "api_key",
    },
  };
}
