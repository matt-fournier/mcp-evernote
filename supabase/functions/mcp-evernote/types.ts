import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthIdentity } from "../_shared/mcp-auth/mod.ts";

export type { AuthIdentity } from "../_shared/mcp-auth/mod.ts";

export interface McpTool {
  register(server: McpServer, identity: AuthIdentity): void;
}

export interface EvernoteNote {
  guid: string;
  title: string;
  content?: string;
  contentRaw?: string;
  notebookGuid: string;
  notebookName?: string;
  tagNames: string[];
  created: number;
  updated: number;
  sourceUrl?: string;
}

export interface EvernoteNotebook {
  guid: string;
  name: string;
  noteCount?: number;
  isDefault: boolean;
}

export interface EvernoteTag {
  guid: string;
  name: string;
  noteCount?: number;
}
