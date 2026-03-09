import type { AuthIdentity } from "../types.ts";
import type {
  EvernoteNoteData,
  EvernoteNoteMetadata,
  EvernoteNotebookData,
  EvernoteTagData,
  SearchParams,
} from "./types.ts";
import { enmlToText, textToEnml, appendToEnml } from "./enml.ts";

const REQUEST_TIMEOUT_MS = 10_000;

interface EvernoteClientConfig {
  token: string;
  baseUrl: string;
}

function getConfig(): EvernoteClientConfig {
  const token = Deno.env.get("EVERNOTE_ACCESS_TOKEN");
  if (!token) throw new Error("EVERNOTE_ACCESS_TOKEN is not configured");

  const baseUrl = Deno.env.get("EVERNOTE_ENV") === "sandbox"
    ? "https://sandbox.evernote.com"
    : "https://www.evernote.com";

  return { token, baseUrl };
}

async function evernoteRequest<T>(
  config: EvernoteClientConfig,
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: Record<string, unknown>,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${config.token}`,
      "Content-Type": "application/json",
    };

    const url = `${config.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (response.status === 401) {
      throw new EvernoteError(
        "Evernote authentication failed. The access token may have expired.",
        "AUTH_FAILED",
      );
    }
    if (response.status === 429) {
      throw new EvernoteError(
        "Evernote rate limit reached. Please wait before retrying.",
        "RATE_LIMITED",
      );
    }
    if (!response.ok) {
      const text = await response.text();
      throw new EvernoteError(
        `Evernote API error (${response.status}): ${text}`,
        "API_ERROR",
      );
    }

    return await response.json() as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

export class EvernoteError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "EvernoteError";
    this.code = code;
  }
}

export function evernoteClient(_identity: AuthIdentity) {
  const config = getConfig();

  return {
    async searchNotes(params: SearchParams) {
      let searchQuery = params.query;

      if (params.notebook_name) {
        searchQuery += ` notebook:"${params.notebook_name}"`;
      }
      if (params.tags?.length) {
        for (const tag of params.tags) {
          searchQuery += ` tag:"${tag}"`;
        }
      }
      if (params.created_after) {
        const date = params.created_after.replace(/-/g, "");
        searchQuery += ` created:${date}`;
      }

      const result = await evernoteRequest<{
        notes: EvernoteNoteMetadata[];
        totalNotes: number;
      }>(config, "/api/v1/notes", "POST", {
        filter: { words: searchQuery },
        maxNotes: params.max_results,
        resultSpec: {
          includeTitle: true,
          includeNotebookGuid: true,
          includeTagGuids: true,
          includeCreated: true,
          includeUpdated: true,
          includeAttributes: true,
        },
      });

      // Resolve notebook names and tag names for the results
      const notebooks = await this.listNotebooks();
      const tags = await this.listTags();
      const notebookMap = new Map(notebooks.map((nb) => [nb.guid, nb.name]));
      const tagMap = new Map(tags.map((t) => [t.guid, t.name]));

      return {
        totalNotes: result.totalNotes,
        notes: result.notes.map((n) => ({
          guid: n.guid,
          title: n.title,
          notebookGuid: n.notebookGuid,
          notebookName: notebookMap.get(n.notebookGuid) ?? "Unknown",
          tagNames: (n.tagGuids ?? [])
            .map((g) => tagMap.get(g))
            .filter((name): name is string => !!name),
          created: n.created,
          updated: n.updated,
          sourceUrl: n.attributes?.sourceURL,
        })),
      };
    },

    async getNote(
      guid: string,
      includeContent = true,
      includeAttachmentsMetadata = false,
    ) {
      const note = await evernoteRequest<EvernoteNoteData>(
        config,
        `/api/v1/notes/${encodeURIComponent(guid)}?includeContent=${includeContent}&includeResourcesData=false`,
      );

      const notebooks = await this.listNotebooks();
      const notebookMap = new Map(notebooks.map((nb) => [nb.guid, nb.name]));

      return {
        guid: note.guid,
        title: note.title,
        content: note.content ? enmlToText(note.content) : undefined,
        notebookGuid: note.notebookGuid,
        notebookName: notebookMap.get(note.notebookGuid) ?? "Unknown",
        tagNames: note.tagNames ?? [],
        created: note.created,
        updated: note.updated,
        sourceUrl: note.attributes?.sourceURL,
        ...(includeAttachmentsMetadata && note.resources
          ? {
            attachments: note.resources.map((r) => ({
              guid: r.guid,
              mime: r.mime,
              fileName: r.fileName,
            })),
          }
          : {}),
      };
    },

    async createNote(params: {
      title: string;
      content: string;
      notebook_name?: string;
      tags?: string[];
      source_url?: string;
    }) {
      let notebookGuid: string | undefined;
      if (params.notebook_name) {
        const notebooks = await this.listNotebooks();
        const nb = notebooks.find(
          (n) => n.name.toLowerCase() === params.notebook_name!.toLowerCase(),
        );
        if (!nb) {
          throw new EvernoteError(
            `Notebook "${params.notebook_name}" not found.`,
            "NOT_FOUND",
          );
        }
        notebookGuid = nb.guid;
      }

      const enmlContent = textToEnml(params.content);

      const body: Record<string, unknown> = {
        title: params.title,
        content: enmlContent,
      };
      if (notebookGuid) body.notebookGuid = notebookGuid;
      if (params.tags?.length) body.tagNames = params.tags;
      if (params.source_url) body.attributes = { sourceURL: params.source_url };

      const note = await evernoteRequest<EvernoteNoteData>(
        config,
        "/api/v1/notes",
        "POST",
        body,
      );

      const notebooks = await this.listNotebooks();
      const notebookMap = new Map(notebooks.map((nb) => [nb.guid, nb.name]));

      return {
        guid: note.guid,
        title: note.title,
        notebookGuid: note.notebookGuid,
        notebookName: notebookMap.get(note.notebookGuid) ?? "Unknown",
        tagNames: note.tagNames ?? [],
        created: note.created,
      };
    },

    async updateNote(params: {
      guid: string;
      title?: string;
      content?: string;
      append_content?: string;
      tags?: string[];
      add_tags?: string[];
    }) {
      const body: Record<string, unknown> = { guid: params.guid };

      if (params.title) body.title = params.title;

      if (params.content) {
        body.content = textToEnml(params.content);
      } else if (params.append_content) {
        // Fetch current note to append
        const current = await evernoteRequest<EvernoteNoteData>(
          config,
          `/api/v1/notes/${encodeURIComponent(params.guid)}?includeContent=true`,
        );
        if (!current.content) {
          throw new EvernoteError(
            "Cannot append to a note with no existing content.",
            "INVALID_STATE",
          );
        }
        body.content = appendToEnml(current.content, params.append_content);
      }

      if (params.tags) {
        body.tagNames = params.tags;
      } else if (params.add_tags?.length) {
        const current = await evernoteRequest<EvernoteNoteData>(
          config,
          `/api/v1/notes/${encodeURIComponent(params.guid)}?includeContent=false`,
        );
        const existingTags = current.tagNames ?? [];
        const merged = [...new Set([...existingTags, ...params.add_tags])];
        body.tagNames = merged;
      }

      const note = await evernoteRequest<EvernoteNoteData>(
        config,
        `/api/v1/notes/${encodeURIComponent(params.guid)}`,
        "PUT",
        body,
      );

      return {
        guid: note.guid,
        title: note.title,
        tagNames: note.tagNames ?? [],
        updated: note.updated,
      };
    },

    async deleteNote(guid: string) {
      await evernoteRequest<void>(
        config,
        `/api/v1/notes/${encodeURIComponent(guid)}`,
        "DELETE",
      );
      return { guid, deleted: true };
    },

    async listNotebooks() {
      const result = await evernoteRequest<EvernoteNotebookData[]>(
        config,
        "/api/v1/notebooks",
      );
      return result.map((nb) => ({
        guid: nb.guid,
        name: nb.name,
        isDefault: nb.defaultNotebook ?? false,
      }));
    },

    async getNotebook(params: {
      name?: string;
      guid?: string;
      include_recent_notes?: boolean;
    }) {
      let notebook: { guid: string; name: string; isDefault: boolean };

      if (params.guid) {
        const nb = await evernoteRequest<EvernoteNotebookData>(
          config,
          `/api/v1/notebooks/${encodeURIComponent(params.guid)}`,
        );
        notebook = { guid: nb.guid, name: nb.name, isDefault: nb.defaultNotebook ?? false };
      } else if (params.name) {
        const notebooks = await this.listNotebooks();
        const found = notebooks.find(
          (n) => n.name.toLowerCase() === params.name!.toLowerCase(),
        );
        if (!found) {
          throw new EvernoteError(
            `Notebook "${params.name}" not found.`,
            "NOT_FOUND",
          );
        }
        notebook = found;
      } else {
        throw new EvernoteError(
          "Either 'name' or 'guid' must be provided.",
          "INVALID_INPUT",
        );
      }

      const result: Record<string, unknown> = { ...notebook };

      if (params.include_recent_notes) {
        const searchResult = await this.searchNotes({
          query: `notebook:"${notebook.name}"`,
          max_results: 5,
        });
        result.recentNotes = searchResult.notes;
      }

      return result;
    },

    async createNotebook(name: string) {
      const nb = await evernoteRequest<EvernoteNotebookData>(
        config,
        "/api/v1/notebooks",
        "POST",
        { name },
      );
      return { guid: nb.guid, name: nb.name };
    },

    async listTags() {
      return await evernoteRequest<EvernoteTagData[]>(
        config,
        "/api/v1/tags",
      );
    },

    async tagNote(params: {
      guid: string;
      add_tags?: string[];
      remove_tags?: string[];
    }) {
      const note = await evernoteRequest<EvernoteNoteData>(
        config,
        `/api/v1/notes/${encodeURIComponent(params.guid)}?includeContent=false`,
      );

      let currentTags = note.tagNames ?? [];

      if (params.add_tags?.length) {
        currentTags = [...new Set([...currentTags, ...params.add_tags])];
      }
      if (params.remove_tags?.length) {
        const removeSet = new Set(params.remove_tags.map((t) => t.toLowerCase()));
        currentTags = currentTags.filter((t) => !removeSet.has(t.toLowerCase()));
      }

      const updated = await evernoteRequest<EvernoteNoteData>(
        config,
        `/api/v1/notes/${encodeURIComponent(params.guid)}`,
        "PUT",
        { guid: params.guid, tagNames: currentTags },
      );

      return {
        guid: updated.guid,
        title: updated.title,
        tagNames: updated.tagNames ?? [],
      };
    },
  };
}
