import { TabGroupItem, TabItem } from "./types";

/**
 * Queries tab groups from the Chrome API.
 * Scoped to active window or all windows based on user settings.
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
