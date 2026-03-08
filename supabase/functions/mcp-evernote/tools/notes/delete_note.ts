import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { evernoteClient } from "../../evernote/client.ts";
import type { McpTool, AuthIdentity } from "../../types.ts";

export const deleteNoteTool: McpTool = {
  register(server: McpServer, identity: AuthIdentity) {
    server.tool(
      "delete_note",
      "Delete (move to trash) an Evernote note. This is a soft delete — the note can " +
        "be restored from the Evernote trash. Requires explicit confirmation via the " +
        "'confirm' parameter set to true. Always ask the user to confirm before calling " +
        "this tool.",
      {
        guid: z.string().describe("Unique identifier of the note to delete"),
        confirm: z.boolean().describe(
          "Must be set to true to execute the deletion. Acts as a safety check.",
        ),
      },
      async ({ guid, confirm }) => {
        try {
          if (!confirm) {
            return {
              content: [{
                type: "text" as const,
                text: "Deletion cancelled: 'confirm' must be set to true. " +
                  "Please ask the user to confirm they want to delete this note.",
              }],
              isError: true,
            };
          }

          const client = evernoteClient(identity);
          const result = await client.deleteNote(guid);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          console.error("[tool:delete_note]", error);
          return {
            content: [{
              type: "text" as const,
              text: `Failed to delete note: ${(error as Error).message}`,
            }],
            isError: true,
          };
        }
      },
    );
  },
};
