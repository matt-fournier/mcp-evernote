import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthIdentity } from "./types.ts";
import { allTools } from "./tools/index.ts";

export function createMcpServer(identity: AuthIdentity): McpServer {
  const server = new McpServer({
    name: "mcp-evernote",
    version: "1.0.0",
  });

  // Register all tools once
  for (const tool of allTools) {
    tool.register(server, identity);
  }

  return server;
}
