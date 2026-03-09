import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { evernoteClient } from "../../evernote/client.ts";
import type { McpTool, AuthIdentity } from "../../types.ts";

export const listNotebooksTool: McpTool = {
  register(server: McpServer, identity: AuthIdentity) {
    server.tool(
      "list_notebooks",
      "List all Evernote notebooks for the current user. Returns each notebook's name, " +
        "GUID, and whether it is the default notebook. Use when the user wants to see " +
        "their notebook structure, find a specific notebook, or decide where to create a note.",
      {},
      async () => {
        try {
          const client = evernoteClient(identity);
          const notebooks = await client.listNotebooks();

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(notebooks, null, 2),
            }],
          };
        } catch (error) {
          console.error("[tool:list_notebooks]", error);
          return {
            content: [{
              type: "text" as const,
              text: `Failed to list notebooks: ${(error as Error).message}`,
            }],
            isError: true,
          };
        }
      },
    );
  },
};
