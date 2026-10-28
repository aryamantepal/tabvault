import { formatCombinedMarkdown, formatGroupMarkdown, isInternalPage } from "./markdown";
import { openObsidianUri, prepareObsidianHandoff } from "./obsidian";
import { getSettings } from "./settings";
import { queryGroupTabs, queryTabGroups } from "./tabs";
import { TabGroupItem, TabItem, TabVaultSettings } from "./types";

interface LoadedGroup {
  group: TabGroupItem;
  tabs: TabItem[];
}

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

function redirectToOptionsForVault(): void {
  setStatus("Obsidian vault name is not set. Opening settings...", true, true);
  setTimeout(() => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("options.html?message=no_vault"));
    }
  }, 400);
}

async function exportGroupToObsidian(
  loaded: LoadedGroup,
  settings: TabVaultSettings
): Promise<void> {
  if (!settings.vault.trim()) {
    redirectToOptionsForVault();
    return;
  }

  const markdown = formatGroupMarkdown(loaded.group, loaded.tabs, {
    listStyle: settings.listStyle,
    includeInternalPages: settings.includeInternalPages,
  });

  const handoff = prepareObsidianHandoff(
    loaded.group.title,
    markdown,
    settings
  );

  if (!handoff.success) {
    if (handoff.error === "no_vault") {
      redirectToOptionsForVault();
    } else {
      setStatus(`Export failed: ${handoff.message}`, true);
    }
    return;
  }

  if (handoff.type === "clipboard_fallback") {
    await copyToClipboard(handoff.markdown);
    setStatus(handoff.reason, true, true);
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
    // Count exported tabs (accounting for internal filter)
    const count = settings.includeInternalPages
      ? loaded.tabs.length
      : loaded.tabs.filter((t) => !isInternalPage(t.url)).length;
    setStatus(`Copied ${count} ${count === 1 ? "link" : "links"} to clipboard.`);
  } else {
    setStatus("Failed to copy links to clipboard.", true);
  }
}

async function exportAllToObsidian(
  groups: LoadedGroup[],
  settings: TabVaultSettings
): Promise<void> {
  if (!settings.vault.trim()) {
    redirectToOptionsForVault();
    return;
  }

  const exportAllBtn = getElement<HTMLButtonElement>("exportAllObsidianBtn");
  exportAllBtn.disabled = true;

  let sentCount = 0;
  const fallbackGroups: LoadedGroup[] = [];

  try {
    for (let i = 0; i < groups.length; i++) {
      const item = groups[i];
      const name = item.group.title?.trim() || "Untitled group";
      setStatus(`Exporting ${i + 1} of ${groups.length}: "${name}"...`, false, true);

      const markdown = formatGroupMarkdown(item.group, item.tabs, {
        listStyle: settings.listStyle,
        includeInternalPages: settings.includeInternalPages,
      });

      const handoff = prepareObsidianHandoff(item.group.title, markdown, settings);
      if (handoff.success && handoff.type === "uri") {
        await openObsidianUri(handoff.uri);
        sentCount++;
      } else if (handoff.success && handoff.type === "clipboard_fallback") {
        fallbackGroups.push(item);
      }

      // Short delay between URIs to ensure sequential OS dispatch
      if (i < groups.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }

    if (fallbackGroups.length > 0) {
      const fallbackMarkdown = formatCombinedMarkdown(
        fallbackGroups.map((g) => ({ group: g.group, tabs: g.tabs })),
        {
          listStyle: settings.listStyle,
          includeInternalPages: settings.includeInternalPages,
        }
      );
      await copyToClipboard(fallbackMarkdown);

      const fallbackCount = fallbackGroups.length;
      const fallbackMsg = `${fallbackCount} ${fallbackCount === 1 ? "was" : "were"} too long for Obsidian links, so ${fallbackCount === 1 ? "it was" : "they were"} copied to the clipboard.`;
      const message = sentCount > 0
        ? `Sent ${sentCount} to Obsidian. ${fallbackMsg}`
        : fallbackMsg;

      setStatus(message, false, true);
    } else {
      setStatus(`Successfully exported ${groups.length} ${groups.length === 1 ? "group" : "groups"} to Obsidian.`);
    }
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

  listEl.innerHTML = "";

  if (loadedGroups.length === 0) {
    listEl.style.display = "none";
    batchContainer.style.display = "none";
    emptyEl.style.display = "flex";
    return;
  }

  emptyEl.style.display = "none";
  listEl.style.display = "flex";
  batchContainer.style.display = "flex";

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
