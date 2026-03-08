import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { evernoteClient } from "../../evernote/client.ts";
import type { McpTool, AuthIdentity } from "../../types.ts";

export const getNotebookTool: McpTool = {
  register(server: McpServer, identity: AuthIdentity) {
    server.tool(
      "get_notebook",
      "Get details of a specific Evernote notebook by name or GUID. Optionally includes " +
        "the 5 most recent notes in that notebook. Use when the user wants to explore " +
        "a notebook's contents or get an overview of recent activity in a notebook.",
      {
        name: z.string().optional().describe("Name of the notebook to look up"),
        guid: z.string().optional().describe("GUID of the notebook to look up"),
        include_recent_notes: z.boolean().default(false).describe(
          "Include the 5 most recent notes from this notebook (default: false)",
        ),
      },
      async ({ name, guid, include_recent_notes }) => {
        try {
          if (!name && !guid) {
            return {
              content: [{
                type: "text" as const,
                text: "Error: either 'name' or 'guid' must be provided.",
              }],
              isError: true,
            };
          }

          const client = evernoteClient(identity);
          const notebook = await client.getNotebook({
            name,
            guid,
            include_recent_notes,
          });

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(notebook, null, 2),
            }],
          };
        } catch (error) {
          console.error("[tool:get_notebook]", error);
          return {
            content: [{
              type: "text" as const,
              text: `Failed to get notebook: ${(error as Error).message}`,
            }],
            isError: true,
          };
        }
      },
    );
  },
};
