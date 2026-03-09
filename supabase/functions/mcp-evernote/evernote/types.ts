export interface EvernoteNoteMetadata {
  guid: string;
  title: string;
  notebookGuid: string;
  tagGuids?: string[];
  created: number;
  updated: number;
  attributes?: {
    sourceURL?: string;
  };
}

export interface EvernoteNoteData {
  guid: string;
  title: string;
  content?: string;
  notebookGuid: string;
  tagGuids?: string[];
  tagNames?: string[];
  created: number;
  updated: number;
  resources?: EvernoteResource[];
  attributes?: {
    sourceURL?: string;
  };
}

export interface EvernoteResource {
  guid: string;
  mime: string;
  width?: number;
  height?: number;
  fileName?: string;
  attachment?: boolean;
}

export interface EvernoteNotebookData {
  guid: string;
  name: string;
  defaultNotebook?: boolean;
}

export interface EvernoteTagData {
  guid: string;
  name: string;
}

export interface SearchParams {
  query: string;
  max_results: number;
  notebook_name?: string;
  tags?: string[];
  created_after?: string;
}

export interface NoteFilter {
  words?: string;
  notebookGuid?: string;
  tagGuids?: string[];
}
