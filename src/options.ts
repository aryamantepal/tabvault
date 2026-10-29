import { DEFAULT_SETTINGS, getSettings, resetSettings, saveSettings } from "./settings";
import { ExistingNoteAction, ListStyle, TabVaultSettings } from "./types";

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
  getElement<HTMLSelectElement>("existingNote").value = settings.existingNote || "unique";
  getElement<HTMLInputElement>("allWindows").checked = settings.allWindows;
  getElement<HTMLInputElement>("includeInternalPages").checked = settings.includeInternalPages;
}

async function initOptions(): Promise<void> {
  const settings = await getSettings();
  populateForm(settings);

  const form = getElement<HTMLFormElement>("settingsForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const vault = getElement<HTMLInputElement>("vault").value.trim();
    const folder = getElement<HTMLInputElement>("folder").value.trim();
    const nameTemplate = getElement<HTMLInputElement>("nameTemplate").value.trim() || DEFAULT_SETTINGS.nameTemplate;
    const listStyle = getElement<HTMLSelectElement>("listStyle").value as ListStyle;
    const existingNote = getElement<HTMLSelectElement>("existingNote").value as ExistingNoteAction;
    const allWindows = getElement<HTMLInputElement>("allWindows").checked;
    const includeInternalPages = getElement<HTMLInputElement>("includeInternalPages").checked;

    try {
      await saveSettings({
        vault,
        folder,
        nameTemplate,
        listStyle,
        existingNote,
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
