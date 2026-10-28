import { TabVaultSettings } from "./types";

export const DEFAULT_SETTINGS: TabVaultSettings = {
  vault: "",
  folder: "",
  nameTemplate: "{{group}}",
  listStyle: "checklist",
  allWindows: true,
  includeInternalPages: false,
};

const STORAGE_KEY = "tabvault_settings";

/**
 * Retrieves the current TabVault settings from chrome.storage.local,
 * merging with DEFAULT_SETTINGS to ensure all keys are populated.
 */
export async function getSettings(): Promise<TabVaultSettings> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return { ...DEFAULT_SETTINGS };
  }

  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as Partial<TabVaultSettings> | undefined;

  return {
    ...DEFAULT_SETTINGS,
    ...(stored || {}),
  };
}

/**
 * Persists updated settings to chrome.storage.local.
 */
export async function saveSettings(
  updates: Partial<TabVaultSettings>
): Promise<TabVaultSettings> {
  const current = await getSettings();
  const next: TabVaultSettings = {
    ...current,
    ...updates,
    // Ensure listStyle is valid
    listStyle: updates.listStyle === "plain" ? "plain" : "checklist",
  };

  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
  }

  return next;
}

/**
 * Resets settings to defaults in chrome.storage.local.
 */
export async function resetSettings(): Promise<TabVaultSettings> {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_SETTINGS });
  }
  return { ...DEFAULT_SETTINGS };
}
