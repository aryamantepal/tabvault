import { formatCombinedMarkdown, formatGroupMarkdown, getDefaultDateString } from "./markdown";
import { prepareObsidianHandoff } from "./obsidian";
import { ObsidianHandoffResult, TabGroupItem, TabItem, TabVaultSettings } from "./types";

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
 * Builds the handoff for one group in Export All, always with inline content.
 *
 * Export All runs in the service worker so it survives the popup closing when
 * Obsidian takes focus. The worker has no document, so it can't write the
 * clipboard, and the popup can't be relied on to rewrite the clipboard between
 * URIs. Per-group clipboard export is therefore not available here, and Export
 * All uses legacy `content=` links regardless of the legacyMode setting.
 * Groups whose link would be too long come back as "clipboard_uri" and are
 * combined onto the clipboard by the popup instead.
 */
export function prepareBatchGroupHandoff(
  item: LoadedGroup,
  settings: TabVaultSettings,
  date: string = getDefaultDateString()
): ObsidianHandoffResult {
  const md = formatGroupMarkdown(item.group, item.tabs, {
    listStyle: settings.listStyle,
    includeInternalPages: settings.includeInternalPages,
    existingNote: settings.existingNote,
    date,
  });
  return prepareObsidianHandoff(item.group.title, md, { ...settings, legacyMode: true }, date);
}

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
    const handoff = prepareBatchGroupHandoff(item, settings, date);
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
    return `Opened ${sentCount} in Obsidian. ${clipMsg}`;
  }

  if (clipboardCount > 0) {
    return `${clipboardCount} ${clipboardCount === 1 ? "group was" : "groups were"} too long for Obsidian links, so ${clipboardCount === 1 ? "it was" : "they were"} copied to the clipboard.`;
  }

  return `Opened ${sentCount} ${sentCount === 1 ? "group" : "groups"} in Obsidian.`;
}
