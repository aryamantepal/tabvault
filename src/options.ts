import { DEFAULT_SETTINGS, getSettings, resetSettings, saveSettings } from "./settings";
import { ListStyle, TabVaultSettings } from "./types";

function getElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Element #${id} not found in DOM`);
  }
  return el as T;
}

function showStatus(message: string, isError = false): void {
  const banner = getElement<HTMLDivElement>("statusBanner");
  banner.textContent = message;
  banner.className = `status-banner ${isError ? "error" : "success"}`;

  if (!isError) {
    setTimeout(() => {
      if (banner.textContent === message) {
        banner.className = "status-banner";
        banner.textContent = "";
      }
    }, 3500);
  }
}

function populateForm(settings: TabVaultSettings): void {
  getElement<HTMLInputElement>("vault").value = settings.vault;
  getElement<HTMLInputElement>("folder").value = settings.folder;
  getElement<HTMLInputElement>("nameTemplate").value = settings.nameTemplate;
  getElement<HTMLSelectElement>("listStyle").value = settings.listStyle;
  getElement<HTMLInputElement>("allWindows").checked = settings.allWindows;
  getElement<HTMLInputElement>("includeInternalPages").checked = settings.includeInternalPages;
}

async function initOptions(): Promise<void> {
  const settings = await getSettings();
  populateForm(settings);

  // Check URL parameters for direct navigation feedback (e.g. from popup missing vault)
  const urlParams = new URLSearchParams(window.location.search);
  const msgParam = urlParams.get("message");
  if (msgParam === "no_vault") {
    showStatus("Please set your Obsidian vault name before exporting to Obsidian.", true);
    getElement<HTMLInputElement>("vault").focus();
  }

  const form = getElement<HTMLFormElement>("settingsForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const vault = getElement<HTMLInputElement>("vault").value.trim();
    const folder = getElement<HTMLInputElement>("folder").value.trim();
    const nameTemplate = getElement<HTMLInputElement>("nameTemplate").value.trim() || DEFAULT_SETTINGS.nameTemplate;
    const listStyle = getElement<HTMLSelectElement>("listStyle").value as ListStyle;
    const allWindows = getElement<HTMLInputElement>("allWindows").checked;
    const includeInternalPages = getElement<HTMLInputElement>("includeInternalPages").checked;

    try {
      await saveSettings({
        vault,
        folder,
        nameTemplate,
        listStyle,
        allWindows,
        includeInternalPages,
      });
      showStatus("Settings saved successfully.");
    } catch (err) {
      showStatus(`Failed to save settings: ${String(err)}`, true);
    }
  });

  const resetBtn = getElement<HTMLButtonElement>("resetBtn");
  resetBtn.addEventListener("click", async () => {
    try {
      const defaults = await resetSettings();
      populateForm(defaults);
      showStatus("Settings reset to defaults.");
    } catch (err) {
      showStatus(`Failed to reset settings: ${String(err)}`, true);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initOptions().catch((err) => {
    console.error("Initialization error:", err);
  });
});
