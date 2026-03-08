import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { evernoteClient } from "../../evernote/client.ts";
import type { McpTool, AuthIdentity } from "../../types.ts";

export const createNoteTool: McpTool = {
  register(server: McpServer, identity: AuthIdentity) {
    server.tool(
      "create_note",
      "Create a new note in Evernote. The content should be plain text — it will be " +
        "automatically converted to valid ENML format. Optionally specify a target notebook, " +
        "tags, and a source URL. Use when the user wants to save information, create a " +
        "meeting note, capture research, or document something new.",
      {
        title: z.string().describe("Title of the note"),
        content: z.string().describe(
          "Body of the note in plain text (automatically converted to ENML)",
        ),
        notebook_name: z.string().optional().describe(
          "Target notebook name (uses default notebook if not specified)",
        ),
        tags: z.array(z.string()).optional().describe(
          "Tags to apply to the note",
        ),
        source_url: z.string().optional().describe(
          "Source URL if the note originates from an article or web page",
        ),
      },
      async ({ title, content, notebook_name, tags, source_url }) => {
        try {
          const client = evernoteClient(identity);
          const note = await client.createNote({
            title,
            content,
            notebook_name,
            tags,
            source_url,
          });

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(note, null, 2),
            }],
          };
        } catch (error) {
          console.error("[tool:create_note]", error);
          return {
            content: [{
              type: "text" as const,
              text: `Failed to create note: ${(error as Error).message}`,
            }],
            isError: true,
          };
        }
      },
    );
  },
};
