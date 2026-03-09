import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { evernoteClient } from "../../evernote/client.ts";
import type { McpTool, AuthIdentity } from "../../types.ts";

export const getNoteTool: McpTool = {
  register(server: McpServer, identity: AuthIdentity) {
    server.tool(
      "get_note",
      "Get the full content of a specific Evernote note by its GUID. Returns the note " +
        "title, plain text content (converted from ENML), tags, notebook, and metadata. " +
        "Use after search_notes to read a note's full content.",
      {
        guid: z.string().describe(
          "Unique identifier of the note (obtained via search_notes)",
        ),
        include_content: z.boolean().default(true).describe(
          "Whether to include the note content (default: true)",
        ),
        include_attachments_metadata: z.boolean().default(false).describe(
          "Whether to include metadata about attachments (default: false)",
        ),
      },
      async ({ guid, include_content, include_attachments_metadata }) => {
        try {
          const client = evernoteClient(identity);
          const note = await client.getNote(
            guid,
            include_content,
            include_attachments_metadata,
          );

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(note, null, 2),
            }],
          };
        } catch (error) {
          console.error("[tool:get_note]", error);
          return {
            content: [{
              type: "text" as const,
              text: `Failed to get note: ${(error as Error).message}`,
            }],
            isError: true,
          };
        }
      },
    );
  },
};
