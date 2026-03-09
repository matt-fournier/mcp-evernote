import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { evernoteClient } from "../../evernote/client.ts";
import type { McpTool, AuthIdentity } from "../../types.ts";

export const listTagsTool: McpTool = {
  register(server: McpServer, identity: AuthIdentity) {
    server.tool(
      "list_tags",
      "List all tags in the user's Evernote account. Returns each tag's name and GUID. " +
        "Use when the user wants to see all available tags, explore their organization " +
        "system, or find the right tag to apply to a note.",
      {},
      async () => {
        try {
          const client = evernoteClient(identity);
          const tags = await client.listTags();

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(tags, null, 2),
            }],
          };
        } catch (error) {
          console.error("[tool:list_tags]", error);
          return {
            content: [{
              type: "text" as const,
              text: `Failed to list tags: ${(error as Error).message}`,
            }],
            isError: true,
          };
        }
      },
    );
  },
};
