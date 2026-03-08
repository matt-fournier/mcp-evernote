import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { evernoteClient } from "../../evernote/client.ts";
import type { McpTool, AuthIdentity } from "../../types.ts";

export const createNotebookTool: McpTool = {
  register(server: McpServer, identity: AuthIdentity) {
    server.tool(
      "create_notebook",
      "Create a new Evernote notebook. Use when the user explicitly requests a new " +
        "notebook to organize their notes. Always confirm with the user before creating " +
        "a notebook, as this action modifies their notebook structure.",
      {
        name: z.string().describe("Name for the new notebook"),
      },
      async ({ name }) => {
        try {
          const client = evernoteClient(identity);
          const notebook = await client.createNotebook(name);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(notebook, null, 2),
            }],
          };
        } catch (error) {
          console.error("[tool:create_notebook]", error);
          return {
            content: [{
              type: "text" as const,
              text: `Failed to create notebook: ${(error as Error).message}`,
            }],
            isError: true,
          };
        }
      },
    );
  },
};
