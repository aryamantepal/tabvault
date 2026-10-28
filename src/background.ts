import { getSettings, saveSettings, DEFAULT_SETTINGS } from "./settings";
import { openObsidianUri } from "./obsidian";
import { TabGroupItem, TabItem } from "./types";

/**
 * Service worker lifecycle initialization.
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    // Populate default settings in local storage
    const current = await getSettings();
    if (!current.nameTemplate) {
      await saveSettings(DEFAULT_SETTINGS);
    }
  }
});

/**
 * Queries tab groups from Chrome API.
 * Scoped to active window or all windows.
 */
export async function queryTabGroups(allWindows: boolean): Promise<TabGroupItem[]> {
  const queryInfo: chrome.tabGroups.QueryInfo = {};
  if (!allWindows) {
    queryInfo.windowId = chrome.windows.WINDOW_ID_CURRENT;
  }

  const groups = await chrome.tabGroups.query(queryInfo);
  return groups.map((g) => ({
    id: g.id,
    title: g.title,
    color: g.color,
    windowId: g.windowId,
    collapsed: g.collapsed,
  }));
}

/**
 * Queries all tabs belonging to a specific tab group.
 */
export async function queryGroupTabs(groupId: number): Promise<TabItem[]> {
  const tabs = await chrome.tabs.query({ groupId });
  return tabs.map((t) => ({
    id: t.id,
    title: t.title,
    url: t.url,
    favIconUrl: t.favIconUrl,
  }));
}

/**
 * Listen for runtime messages from popup or options.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "QUERY_GROUPS") {
    queryTabGroups(Boolean(message.allWindows))
      .then((groups) => sendResponse({ success: true, data: groups }))
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true; // Keep channel open for async response
  }

  if (message?.type === "QUERY_GROUP_TABS") {
    queryGroupTabs(Number(message.groupId))
      .then((tabs) => sendResponse({ success: true, data: tabs }))
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true;
  }

  if (message?.type === "OPEN_OBSIDIAN_URI") {
    openObsidianUri(String(message.uri))
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true;
  }
});
