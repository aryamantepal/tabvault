import { formatCombinedMarkdown, formatGroupMarkdown, getDefaultDateString } from "./markdown";
import { prepareObsidianHandoff } from "./obsidian";
import { TabGroupItem, TabItem, TabVaultSettings } from "./types";

export interface LoadedGroup {
  group: TabGroupItem;
  tabs: TabItem[];
}

export interface BatchExportPlan {
  directGroups: LoadedGroup[];
  clipboardGroups: LoadedGroup[];
  clipboardMarkdown?: string;
}

export interface BatchExportResult {
  timestamp: number;
  totalGroups: number;
  sentCount: number;
  clipboardCount: number;
  errors: string[];
}

export const LAST_EXPORT_STORAGE_KEY = "tabvault_last_export_result";

/**
 * Pure function: plans batch export by separating groups into those that can be
 * dispatched directly via obsidian://new URIs and those that exceed URI limits
 * and must be copied to the clipboard.
 */
export function planBatchExport(
  groups: LoadedGroup[],
  settings: TabVaultSettings,
  date: string = getDefaultDateString()
): BatchExportPlan {
  const directGroups: LoadedGroup[] = [];
  const clipboardGroups: LoadedGroup[] = [];

  for (const item of groups) {
    const md = formatGroupMarkdown(item.group, item.tabs, {
      listStyle: settings.listStyle,
      includeInternalPages: settings.includeInternalPages,
      existingNote: settings.existingNote,
      date,
    });

    const handoff = prepareObsidianHandoff(item.group.title, md, settings, date);
    if (handoff.success && handoff.type === "clipboard_uri") {
      // In batch export, multiple clipboard-dependent groups cannot each open
      // clipboard URIs sequentially because the clipboard would be overwritten.
      // They are batched for consolidated clipboard export instead.
      clipboardGroups.push(item);
    } else {
      directGroups.push(item);
    }
  }

  let clipboardMarkdown: string | undefined;
  if (clipboardGroups.length > 0) {
    clipboardMarkdown = formatCombinedMarkdown(
      clipboardGroups.map((g) => ({ group: g.group, tabs: g.tabs })),
      {
        listStyle: settings.listStyle,
        includeInternalPages: settings.includeInternalPages,
        date,
      }
    );
  }

  return { directGroups, clipboardGroups, clipboardMarkdown };
}

/**
 * Pure function: formats a user-friendly summary string from a batch export result.
 */
export function formatBatchResultSummary(result: {
  totalGroups: number;
  sentCount: number;
  clipboardCount: number;
  errors?: string[];
}): string {
  if (result.errors && result.errors.length > 0 && result.sentCount === 0 && result.clipboardCount === 0) {
    return `Batch export failed: ${result.errors.join("; ")}`;
  }

  const { sentCount, clipboardCount } = result;

  if (sentCount > 0 && clipboardCount > 0) {
    const clipMsg = `${clipboardCount} ${clipboardCount === 1 ? "was" : "were"} too long for Obsidian links, so ${clipboardCount === 1 ? "it was" : "they were"} copied to the clipboard.`;
    return `Sent ${sentCount} to Obsidian. ${clipMsg}`;
  }

  if (clipboardCount > 0) {
    return `${clipboardCount} ${clipboardCount === 1 ? "group was" : "groups were"} too long for Obsidian links, so ${clipboardCount === 1 ? "it was" : "they were"} copied to the clipboard.`;
  }

  return `Successfully exported ${sentCount} ${sentCount === 1 ? "group" : "groups"} to Obsidian.`;
}
