import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Integration test stubs — require a running Supabase instance
// Run with: deno test supabase/functions/mcp-evernote/tests/ --allow-net --allow-env

const BASE_URL = "http://localhost:54321/functions/v1/mcp-evernote";
const TEST_TOKEN = Deno.env.get("TEST_MCP_KEY") ?? "mcp_sk_test";

async function mcpCall(method: string, params: Record<string, unknown> = {}) {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TEST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });
  return { status: response.status, data: await response.json() };
}

// Skip integration tests if no server is running
const serverAvailable = await fetch(BASE_URL, { method: "OPTIONS" })
  .then(() => true)
  .catch(() => false);

if (serverAvailable) {
  Deno.test("tools/list returns 10 tools", async () => {
    const { status, data } = await mcpCall("tools/list");
    assertEquals(status, 200);
    assertEquals(data.result?.tools?.length, 10);
  });

  Deno.test("tools/list includes all expected tool names", async () => {
    const { data } = await mcpCall("tools/list");
    const names = data.result.tools.map((t: { name: string }) => t.name).sort();
    assertEquals(names, [
      "create_note",
      "create_notebook",
      "delete_note",
      "get_note",
      "get_notebook",
      "list_notebooks",
      "list_tags",
      "search_notes",
      "tag_note",
      "update_note",
    ]);
  });

  Deno.test("search_notes returns results for valid query", async () => {
    const { status, data } = await mcpCall("tools/call", {
      name: "search_notes",
      arguments: { query: "test", max_results: 5 },
    });
    assertEquals(status, 200);
    assertEquals(data.result?.content?.[0]?.type, "text");
  });

  Deno.test("delete_note without confirm returns error", async () => {
    const { data } = await mcpCall("tools/call", {
      name: "delete_note",
      arguments: { guid: "fake-guid", confirm: false },
    });
    assertEquals(data.result?.isError, true);
  });
} else {
  Deno.test("SKIP: integration tests require running Supabase instance", () => {
    console.log(
      "Integration tests skipped. Start Supabase with: supabase start && supabase functions serve mcp-evernote",
    );
  });
}
