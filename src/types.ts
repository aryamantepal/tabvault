export type ListStyle = "checklist" | "plain";

export type ExistingNoteAction = "unique" | "overwrite" | "append";

export interface TabItem {
  id?: number;
  title?: string;
  url?: string;
  favIconUrl?: string;
}

export interface TabGroupItem {
  id: number;
  title?: string;
  color: string;
  windowId: number;
  collapsed?: boolean;
  tabs?: TabItem[];
}

export interface TabVaultSettings {
  vault: string;
  folder: string;
  nameTemplate: string;
  listStyle: ListStyle;
  allWindows: boolean;
  includeInternalPages: boolean;
  existingNote: ExistingNoteAction;
}

export interface MarkdownFormatOptions {
  date?: string; // YYYY-MM-DD
  listStyle?: ListStyle;
  includeInternalPages?: boolean;
  existingNote?: ExistingNoteAction;
}

export type ObsidianHandoffResult =
  | {
      success: true;
      type: "uri";
      uri: string;
      noteName: string;
      markdown: string;
    }
  | {
      success: true;
      type: "clipboard_uri";
      uri: string;
      noteName: string;
      markdown: string;
    }
  | {
      success: false;
      error: "no_vault" | "no_tabs" | "invalid_template" | string;
      message: string;
    };
