import {
  BatchExportResult,
  LAST_EXPORT_STORAGE_KEY,
  LoadedGroup,
  prepareBatchGroupHandoff,
} from "./batch";
import { openObsidianUri } from "./obsidian";
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

const BATCH_URI_DELAY_MS = 500;

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

  for (let i = 0; i < groups.length; i++) {
    const item = groups[i];
    try {
      const handoff = prepareBatchGroupHandoff(item, settings);
      if (!handoff.success || handoff.type !== "uri") {
        throw new Error("note is too long to send in a link");
      }

      await openObsidianUri(handoff.uri);
      sentCount++;

      // Each URI reuses the active tab, so give the previous handoff time to
      // finish before navigating the tab again.
      if (i < groups.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_URI_DELAY_MS));
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
    if (message?.type === "OPEN_OBSIDIAN_URI") {
      // Runs here rather than in the popup because the popup is destroyed as
      // soon as Obsidian takes focus, which could cut the tab update short.
      openObsidianUri(String(message.uri))
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: String(err) }));
      return true;
    }
    if (message?.type === "BATCH_EXPORT") {
      executeBatchExport(message.groups, message.settings, message.clipboardCount || 0)
        .then((result) => sendResponse({ success: true, data: result }))
        .catch((err) => sendResponse({ success: false, error: String(err) }));
      return true; // Keep channel open for async response
    }
  });
}
