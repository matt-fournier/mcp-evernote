import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticate } from "./auth.ts";
import { createMcpServer } from "./server.ts";
import { handleCors, getCorsHeaders } from "./cors.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    // Authenticate
    const authResult = await authenticate(req);
    if (!authResult.success) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create a new MCP server per request (stateless edge function pattern)
    const server = createMcpServer(authResult.identity);

    // Create transport in stateless mode (no session tracking)
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);

    // Handle request using the Web Standard transport (accepts Request, returns Response)
    const mcpResponse = await transport.handleRequest(req);

    // Add CORS headers to the MCP response
    const responseHeaders = new Headers(mcpResponse.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      responseHeaders.set(key, value);
    }

    return new Response(mcpResponse.body, {
      status: mcpResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[mcp-evernote] Unhandled error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
