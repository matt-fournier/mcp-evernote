import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { validateApiKey } from "../../_shared/mcp-auth/api-key.ts";

Deno.test("validateApiKey returns 500 when MCP_API_KEYS not configured", () => {
  const original = Deno.env.get("MCP_API_KEYS");
  Deno.env.delete("MCP_API_KEYS");

  const result = validateApiKey("mcp_sk_anything");
  assertEquals(result.success, false);
  if (!result.success) {
    assertEquals(result.status, 500);
  }

  if (original) Deno.env.set("MCP_API_KEYS", original);
});

Deno.test("validateApiKey rejects unknown mcp_sk_ tokens", () => {
  const original = Deno.env.get("MCP_API_KEYS");
  Deno.env.set("MCP_API_KEYS", "test-client:mcp_sk_validkey123");

  const result = validateApiKey("mcp_sk_invalidkey");
  assertEquals(result.success, false);
  if (!result.success) {
    assertEquals(result.status, 401);
  }

  if (original) Deno.env.set("MCP_API_KEYS", original);
  else Deno.env.delete("MCP_API_KEYS");
});

Deno.test("validateApiKey accepts valid mcp_sk_ tokens", () => {
  const original = Deno.env.get("MCP_API_KEYS");
  Deno.env.set("MCP_API_KEYS", "claude-desktop:mcp_sk_testkey123");

  const result = validateApiKey("mcp_sk_testkey123");
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.identity.method, "api_key");
    assertEquals(result.identity.id, "apikey:claude-desktop");
  }

  if (original) Deno.env.set("MCP_API_KEYS", original);
  else Deno.env.delete("MCP_API_KEYS");
});

Deno.test("validateApiKey handles multiple keys", () => {
  const original = Deno.env.get("MCP_API_KEYS");
  Deno.env.set("MCP_API_KEYS", "client1:mcp_sk_key1,client2:mcp_sk_key2");

  const result1 = validateApiKey("mcp_sk_key1");
  assertEquals(result1.success, true);
  if (result1.success) assertEquals(result1.identity.id, "apikey:client1");

  const result2 = validateApiKey("mcp_sk_key2");
  assertEquals(result2.success, true);
  if (result2.success) assertEquals(result2.identity.id, "apikey:client2");

  if (original) Deno.env.set("MCP_API_KEYS", original);
  else Deno.env.delete("MCP_API_KEYS");
});
