import { DEFAULT_SETTINGS, getSettings, saveSettings } from "./settings";

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
