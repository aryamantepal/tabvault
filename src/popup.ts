import {
  BatchExportResult,
  formatBatchResultSummary,
  LAST_EXPORT_STORAGE_KEY,
  LoadedGroup,
  planBatchExport,
} from "./batch";
import { formatCombinedMarkdown, formatGroupMarkdown, isInternalPage } from "./markdown";
import { openObsidianUri, prepareObsidianHandoff } from "./obsidian";
import { getSettings } from "./settings";
import { queryGroupTabs, queryTabGroups } from "./tabs";
import { TabVaultSettings } from "./types";

function getElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Element #${id} not found in DOM`);
  }
  return el as T;
}

let statusTimeout: ReturnType<typeof setTimeout> | null = null;

function setStatus(message: string, isError = false, persistent = false): void {
  const bar = getElement<HTMLDivElement>("statusBar");
  const msgEl = getElement<HTMLSpanElement>("statusMessage");

  if (statusTimeout) {
    clearTimeout(statusTimeout);
    statusTimeout = null;
  }

  msgEl.textContent = message;
  bar.className = `status-bar visible ${isError ? "error" : ""}`;

  if (!persistent) {
    statusTimeout = setTimeout(() => {
      bar.className = "status-bar";
      msgEl.textContent = "";
    }, 4000);
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("Clipboard copy failed:", err);
    return false;
  }
}

async function exportGroupToObsidian(
  loaded: LoadedGroup,
  settings: TabVaultSettings
): Promise<void> {
  const markdown = formatGroupMarkdown(loaded.group, loaded.tabs, {
    listStyle: settings.listStyle,
    includeInternalPages: settings.includeInternalPages,
    existingNote: settings.existingNote,
  });

  const handoff = prepareObsidianHandoff(
    loaded.group.title,
    markdown,
    settings
  );

  if (!handoff.success) {
    setStatus(`Export failed: ${handoff.message}`, true);
    return;
  }

  if (handoff.type === "clipboard_uri") {
    // Large note: copy markdown to clipboard, then open obsidian://new with &clipboard
    const ok = await copyToClipboard(handoff.markdown);
    if (!ok) {
      setStatus("Failed to copy note to clipboard for Obsidian.", true);
      return;
    }
    await openObsidianUri(handoff.uri);
    const groupName = loaded.group.title?.trim() || "Untitled group";
    setStatus(`Sent "${groupName}" to Obsidian via clipboard.`);
    return;
  }

  await openObsidianUri(handoff.uri);
  const groupName = loaded.group.title?.trim() || "Untitled group";
  setStatus(`Sent "${groupName}" to Obsidian.`);
}

async function copyGroupToClipboard(
  loaded: LoadedGroup,
  settings: TabVaultSettings
): Promise<void> {
  const markdown = formatGroupMarkdown(loaded.group, loaded.tabs, {
    listStyle: settings.listStyle,
    includeInternalPages: settings.includeInternalPages,
  });

  const ok = await copyToClipboard(markdown);
  if (ok) {
    const count = settings.includeInternalPages
      ? loaded.tabs.length
      : loaded.tabs.filter((t) => !isInternalPage(t.url)).length;
    setStatus(`Copied ${count} ${count === 1 ? "link" : "links"} to clipboard.`);
  } else {
    setStatus("Failed to copy links to clipboard.", true);
  }
}

/**
 * Export All to Obsidian:
 * Moves URI dispatch loop into the background service worker so it survives
 * when Chrome closes the popup as Obsidian steals focus.
 *
 * Clipboard writes require user gesture context, so oversized groups are
 * formatted and written to the clipboard from the popup before delegating.
 */
async function exportAllToObsidian(
  groups: LoadedGroup[],
  settings: TabVaultSettings
): Promise<void> {
  const exportAllBtn = getElement<HTMLButtonElement>("exportAllObsidianBtn");
  exportAllBtn.disabled = true;

  try {
    const plan = planBatchExport(groups, settings);

    // If any oversized groups need clipboard export, write them now
    // while we still have active user gesture context in the popup.
    if (plan.clipboardMarkdown) {
      const ok = await copyToClipboard(plan.clipboardMarkdown);
      if (!ok) {
        setStatus("Failed to copy oversized groups to clipboard.", true);
        return;
      }
    }

    if (plan.directGroups.length > 0) {
      setStatus(
        `Exporting ${plan.directGroups.length} ${plan.directGroups.length === 1 ? "group" : "groups"} to Obsidian...`,
        false,
        true
      );

      // Delegate the URI dispatch loop to the background service worker
      const response = await chrome.runtime.sendMessage({
        type: "BATCH_EXPORT",
        groups: plan.directGroups,
        clipboardCount: plan.clipboardGroups.length,
        settings,
      });

      if (response?.success && response.data) {
        const summary = formatBatchResultSummary(response.data);
        setStatus(summary, response.data.errors?.length > 0);
        return;
      } else if (!response?.success) {
        setStatus(`Batch export error: ${response?.error || "Unknown error"}`, true);
        return;
      }
    }

    // If all groups were oversized and copied to clipboard
    const summary = formatBatchResultSummary({
      totalGroups: groups.length,
      sentCount: 0,
      clipboardCount: plan.clipboardGroups.length,
    });
    setStatus(summary, false, true);
  } catch (err) {
    setStatus(`Batch export error: ${String(err)}`, true);
  } finally {
    exportAllBtn.disabled = false;
  }
}

async function copyAllToClipboard(
  groups: LoadedGroup[],
  settings: TabVaultSettings
): Promise<void> {
  const combined = formatCombinedMarkdown(
    groups.map((g) => ({ group: g.group, tabs: g.tabs })),
    {
      listStyle: settings.listStyle,
      includeInternalPages: settings.includeInternalPages,
    }
  );

  const ok = await copyToClipboard(combined);
  if (ok) {
    setStatus(`Copied all ${groups.length} groups to clipboard.`);
  } else {
    setStatus("Failed to copy groups to clipboard.", true);
  }
}

function renderGroups(loadedGroups: LoadedGroup[], settings: TabVaultSettings): void {
  const listEl = getElement<HTMLUListElement>("groupsList");
  const emptyEl = getElement<HTMLDivElement>("emptyState");
  const batchContainer = getElement<HTMLDivElement>("batchContainer");
  const footerEl = getElement<HTMLElement>("popupFooter");

  listEl.innerHTML = "";

  if (loadedGroups.length === 0) {
    listEl.style.display = "none";
    batchContainer.style.display = "none";
    footerEl.style.display = "none";
    emptyEl.style.display = "flex";
    return;
  }

  emptyEl.style.display = "none";
  listEl.style.display = "flex";
  batchContainer.style.display = "flex";
  footerEl.style.display = "block";

  for (const loaded of loadedGroups) {
    const li = document.createElement("li");
    li.className = "group-card";

    const header = document.createElement("div");
    header.className = "group-header";

    const identity = document.createElement("div");
    identity.className = "group-identity";

    const dot = document.createElement("span");
    dot.className = `color-dot color-${loaded.group.color || "grey"}`;
    dot.setAttribute("aria-hidden", "true");

    const name = document.createElement("span");
    name.className = "group-name";
    name.textContent = loaded.group.title?.trim() || "Untitled group";

    identity.appendChild(dot);
    identity.appendChild(name);

    const badge = document.createElement("span");
    badge.className = "tab-badge";
    const tabCount = loaded.tabs.length;
    badge.textContent = `${tabCount} ${tabCount === 1 ? "tab" : "tabs"}`;

    header.appendChild(identity);
    header.appendChild(badge);

    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "group-buttons";

    const obsidianBtn = document.createElement("button");
    obsidianBtn.className = "btn-primary";
    obsidianBtn.textContent = "Obsidian";
    obsidianBtn.title = `Export "${name.textContent}" to Obsidian`;
    obsidianBtn.addEventListener("click", () => {
      exportGroupToObsidian(loaded, settings).catch((err) => {
        setStatus(String(err), true);
      });
    });

    const copyBtn = document.createElement("button");
    copyBtn.className = "btn-secondary";
    copyBtn.textContent = "Copy";
    copyBtn.title = `Copy "${name.textContent}" Markdown to clipboard`;
    copyBtn.addEventListener("click", () => {
      copyGroupToClipboard(loaded, settings).catch((err) => {
        setStatus(String(err), true);
      });
    });

    buttonsContainer.appendChild(obsidianBtn);
    buttonsContainer.appendChild(copyBtn);

    li.appendChild(header);
    li.appendChild(buttonsContainer);
    listEl.appendChild(li);
  }

  // Bind batch action listeners
  const exportAllObsidianBtn = getElement<HTMLButtonElement>("exportAllObsidianBtn");
  const exportAllCopyBtn = getElement<HTMLButtonElement>("exportAllCopyBtn");

  exportAllObsidianBtn.onclick = () => {
    exportAllToObsidian(loadedGroups, settings).catch((err) => {
      setStatus(String(err), true);
    });
  };

  exportAllCopyBtn.onclick = () => {
    copyAllToClipboard(loadedGroups, settings).catch((err) => {
      setStatus(String(err), true);
    });
  };
}

/**
 * Shows the result of the last batch export if it completed recently (within 60 seconds).
 * Enables the user to see export results even when Obsidian stole focus and closed the popup.
 */
async function showLastExportResult(): Promise<void> {
  try {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return;
    const data = await chrome.storage.local.get(LAST_EXPORT_STORAGE_KEY);
    const result = data[LAST_EXPORT_STORAGE_KEY] as BatchExportResult | undefined;
    if (!result) return;

    const ageMs = Date.now() - result.timestamp;
    if (ageMs > 60_000) return;

    const summary = formatBatchResultSummary(result);
    setStatus(`Last export: ${summary}`, (result.errors?.length || 0) > 0);
  } catch {
    // Non-critical
  }
}

async function initPopup(): Promise<void> {
  const openOptionsBtn = getElement<HTMLButtonElement>("openOptionsBtn");
  openOptionsBtn.addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open("options.html");
    }
  });

  try {
    // Show last export result if popup was reopened after a background export
    await showLastExportResult();

    const settings = await getSettings();
    const rawGroups = await queryTabGroups(settings.allWindows);

    const loadedGroups: LoadedGroup[] = await Promise.all(
      rawGroups.map(async (group) => {
        const tabs = await queryGroupTabs(group.id);
        return { group, tabs };
      })
    );

    renderGroups(loadedGroups, settings);
  } catch (err) {
    console.error("Popup init failed:", err);
    setStatus(`Failed to load tab groups: ${String(err)}`, true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initPopup().catch((err) => {
    console.error("Popup error:", err);
  });
});
