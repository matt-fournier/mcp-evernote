import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { evernoteClient } from "../../evernote/client.ts";
import type { McpTool, AuthIdentity } from "../../types.ts";

export const tagNoteTool: McpTool = {
  register(server: McpServer, identity: AuthIdentity) {
    server.tool(
      "tag_note",
      "Add or remove tags from an Evernote note without modifying its content. " +
        "Use when the user wants to organize a note with tags, categorize notes, " +
        "or clean up tag assignments.",
      {
        guid: z.string().describe("GUID of the note to tag"),
        add_tags: z.array(z.string()).optional().describe(
          "Tags to add to the note",
        ),
        remove_tags: z.array(z.string()).optional().describe(
          "Tags to remove from the note",
        ),
      },
      async ({ guid, add_tags, remove_tags }) => {
        try {
          if (!add_tags?.length && !remove_tags?.length) {
            return {
              content: [{
                type: "text" as const,
                text: "Error: at least one of 'add_tags' or 'remove_tags' must be provided.",
              }],
              isError: true,
            };
          }

          const client = evernoteClient(identity);
          const result = await client.tagNote({ guid, add_tags, remove_tags });

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          console.error("[tool:tag_note]", error);
          return {
            content: [{
              type: "text" as const,
              text: `Failed to tag note: ${(error as Error).message}`,
            }],
            isError: true,
          };
        }
      },
    );
  },
};
