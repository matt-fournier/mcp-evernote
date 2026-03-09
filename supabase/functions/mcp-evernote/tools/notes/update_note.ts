import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { evernoteClient } from "../../evernote/client.ts";
import type { McpTool, AuthIdentity } from "../../types.ts";

export const updateNoteTool: McpTool = {
  register(server: McpServer, identity: AuthIdentity) {
    server.tool(
      "update_note",
      "Update an existing Evernote note. Can modify the title, replace the content, " +
        "append to existing content, or update tags. When using 'content', it replaces " +
        "the entire note body. When using 'append_content', it adds text at the end " +
        "without erasing existing content. Cannot use both 'content' and 'append_content' " +
        "at the same time.",
      {
        guid: z.string().describe("Unique identifier of the note to update"),
        title: z.string().optional().describe("New title for the note"),
        content: z.string().optional().describe(
          "New content in plain text (replaces entire note body)",
        ),
        append_content: z.string().optional().describe(
          "Text to append at the end of the existing note content",
        ),
        tags: z.array(z.string()).optional().describe(
          "Replace the entire tag list with these tags",
        ),
        add_tags: z.array(z.string()).optional().describe(
          "Add these tags without removing existing ones",
        ),
      },
      async ({ guid, title, content, append_content, tags, add_tags }) => {
        try {
          // Validate: content and append_content are mutually exclusive
          if (content && append_content) {
            return {
              content: [{
                type: "text" as const,
                text: "Error: 'content' and 'append_content' cannot be used together. " +
                  "Use 'content' to replace the full note body, or 'append_content' to add to it.",
              }],
              isError: true,
            };
          }

          // Validate: tags and add_tags are mutually exclusive
          if (tags && add_tags) {
            return {
              content: [{
                type: "text" as const,
                text: "Error: 'tags' and 'add_tags' cannot be used together. " +
                  "Use 'tags' to replace all tags, or 'add_tags' to add without removing.",
              }],
              isError: true,
            };
          }

          const client = evernoteClient(identity);
          const note = await client.updateNote({
            guid,
            title,
            content,
            append_content,
            tags,
            add_tags,
          });

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(note, null, 2),
            }],
          };
        } catch (error) {
          console.error("[tool:update_note]", error);
          return {
            content: [{
              type: "text" as const,
              text: `Failed to update note: ${(error as Error).message}`,
            }],
            isError: true,
          };
        }
      },
    );
  },
};
