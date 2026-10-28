import { BatchExportResult, LAST_EXPORT_STORAGE_KEY, LoadedGroup } from "./batch";
import { formatGroupMarkdown } from "./markdown";
import { buildObsidianUri, openObsidianUri, resolveNoteName, sanitizeFolderPath } from "./obsidian";
import { DEFAULT_SETTINGS, saveSettings } from "./settings";
import { TabVaultSettings } from "./types";

/**
 * Service worker lifecycle initialization.
 * On first install, unconditionally write defaults so all keys exist in local storage.
 */
if (typeof chrome !== "undefined" && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
      await saveSettings(DEFAULT_SETTINGS);
    }
  });
}

/**
 * Executes batch export in the background service worker.
 * Runs independently of popup lifetime (which closes when Obsidian steals focus).
 */
export async function executeBatchExport(
  groups: LoadedGroup[],
  settings: TabVaultSettings,
  clipboardCount = 0
): Promise<BatchExportResult> {
  let sentCount = 0;
  const errors: string[] = [];

  const vault = settings.vault?.trim();
  if (!vault) {
    const errorResult: BatchExportResult = {
      timestamp: Date.now(),
      totalGroups: groups.length + clipboardCount,
      sentCount: 0,
      clipboardCount,
      errors: ["No vault configured in settings"],
    };
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.set({ [LAST_EXPORT_STORAGE_KEY]: errorResult });
    }
    return errorResult;
  }

  for (let i = 0; i < groups.length; i++) {
    const item = groups[i];
    try {
      const markdown = formatGroupMarkdown(item.group, item.tabs, {
        listStyle: settings.listStyle,
        includeInternalPages: settings.includeInternalPages,
        existingNote: settings.existingNote,
      });

      const noteName = resolveNoteName(settings.nameTemplate, item.group.title);
      const folder = sanitizeFolderPath(settings.folder);
      const filePath = folder ? `${folder}/${noteName}` : noteName;
      const uri = buildObsidianUri(vault, filePath, markdown, settings.existingNote);

      await openObsidianUri(uri);
      sentCount++;

      // Short delay between URIs to let the OS protocol handler process sequentially
      if (i < groups.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    } catch (err) {
      const name = item.group.title?.trim() || "Untitled group";
      errors.push(`Failed to export "${name}": ${String(err)}`);
    }
  }

  const result: BatchExportResult = {
    timestamp: Date.now(),
    totalGroups: groups.length + clipboardCount,
    sentCount,
    clipboardCount,
    errors,
  };

  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.set({ [LAST_EXPORT_STORAGE_KEY]: result });
  }

  return result;
}

/**
 * Listen for messages from the popup.
 */
if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "BATCH_EXPORT") {
      executeBatchExport(message.groups, message.settings, message.clipboardCount || 0)
        .then((result) => sendResponse({ success: true, data: result }))
        .catch((err) => sendResponse({ success: false, error: String(err) }));
      return true; // Keep channel open for async response
    }
  });
}
