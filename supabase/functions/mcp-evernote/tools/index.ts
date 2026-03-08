import type { McpTool } from "../types.ts";

// Notes
import { searchNotesTool } from "./notes/search_notes.ts";
import { getNoteTool } from "./notes/get_note.ts";
import { createNoteTool } from "./notes/create_note.ts";
import { updateNoteTool } from "./notes/update_note.ts";
import { deleteNoteTool } from "./notes/delete_note.ts";

// Notebooks
import { listNotebooksTool } from "./notebooks/list_notebooks.ts";
import { getNotebookTool } from "./notebooks/get_notebook.ts";
import { createNotebookTool } from "./notebooks/create_notebook.ts";

// Tags
import { listTagsTool } from "./tags/list_tags.ts";
import { tagNoteTool } from "./tags/tag_note.ts";

export const allTools: McpTool[] = [
  searchNotesTool,
  getNoteTool,
  createNoteTool,
  updateNoteTool,
  deleteNoteTool,
  listNotebooksTool,
  getNotebookTool,
  createNotebookTool,
  listTagsTool,
  tagNoteTool,
];
