import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { evernoteClient } from "../../evernote/client.ts";
import type { McpTool, AuthIdentity } from "../../types.ts";

export const searchNotesTool: McpTool = {
  register(server: McpServer, identity: AuthIdentity) {
    server.tool(
      "search_notes",
      "Search Evernote notes using a full-text query. Returns matching note titles, " +
        "notebook names, tags, and creation dates. Use when the user wants to find " +
        "a specific note, look up past research, or check if a topic is already documented. " +
        "Does NOT return the full note content — use get_note for that.",
      {
        query: z.string().describe(
          "Full-text search query. Supports Evernote syntax: " +
            'notebook:"My Notebook" tag:research created:day-7',
        ),
        max_results: z.number().min(1).max(50).default(10).describe(
          "Maximum number of notes to return (default: 10, max: 50)",
        ),
        notebook_name: z.string().optional().describe(
          "Filter results to a specific notebook by name",
        ),
        tags: z.array(z.string()).optional().describe(
          "Filter results by tag names",
        ),
        created_after: z.string().optional().describe(
          'Filter notes created after this date (ISO format, e.g. "2024-01-01")',
        ),
      },
      async ({ query, max_results, notebook_name, tags, created_after }) => {
        try {
          const client = evernoteClient(identity);
          const results = await client.searchNotes({
            query,
            max_results,
            notebook_name,
            tags,
            created_after,
          });

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(results, null, 2),
            }],
          };
        } catch (error) {
          console.error("[tool:search_notes]", error);
          return {
            content: [{
              type: "text" as const,
              text: `Failed to search notes: ${(error as Error).message}`,
            }],
            isError: true,
          };
        }
      },
    );
  },
};
