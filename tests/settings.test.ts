import { describe, it, expect, beforeEach } from "vitest";
import { DEFAULT_SETTINGS, getSettings, resetSettings, saveSettings } from "../src/settings";

describe("settings", () => {
  let memoryStore: Record<string, unknown> = {};

  beforeEach(() => {
    memoryStore = {};
    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        local: {
          get: async (key: string) => {
            return { [key]: memoryStore[key] };
          },
          set: async (items: Record<string, unknown>) => {
            Object.assign(memoryStore, items);
          },
        },
      },
    };
  });

  it("returns default settings when storage is empty", async () => {
    const settings = await getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(settings.vault).toBe("");
    expect(settings.folder).toBe("");
    expect(settings.nameTemplate).toBe("{{group}}");
    expect(settings.listStyle).toBe("checklist");
    expect(settings.allWindows).toBe(true);
    expect(settings.includeInternalPages).toBe(false);
    expect(settings.existingNote).toBe("unique");
  });

  it("saves and retrieves updated settings", async () => {
    await saveSettings({
      vault: "ResearchVault",
      folder: "TabGroups",
      listStyle: "plain",
    });

    const settings = await getSettings();
    expect(settings.vault).toBe("ResearchVault");
    expect(settings.folder).toBe("TabGroups");
    expect(settings.listStyle).toBe("plain");
    // Unchanged defaults remain
    expect(settings.nameTemplate).toBe("{{group}}");
    expect(settings.allWindows).toBe(true);
  });

  it("resets settings to defaults", async () => {
    await saveSettings({ vault: "OldVault", folder: "OldFolder" });
    const reset = await resetSettings();
    expect(reset).toEqual(DEFAULT_SETTINGS);

    const reloaded = await getSettings();
    expect(reloaded).toEqual(DEFAULT_SETTINGS);
  });

  it("normalizes invalid list style values to checklist", async () => {
    await saveSettings({
      // @ts-expect-error Testing invalid runtime input
      listStyle: "unsupported_style",
    });
    const settings = await getSettings();
    expect(settings.listStyle).toBe("checklist");
  });

  it("preserves listStyle when saving other settings", async () => {
    await saveSettings({ listStyle: "plain" });
    let settings = await getSettings();
    expect(settings.listStyle).toBe("plain");

    await saveSettings({ vault: "MyVault" });
    settings = await getSettings();
    expect(settings.listStyle).toBe("plain");
    expect(settings.vault).toBe("MyVault");
  });

  it("saves existingNote setting and normalizes invalid values", async () => {
    await saveSettings({ existingNote: "overwrite" });
    let settings = await getSettings();
    expect(settings.existingNote).toBe("overwrite");

    await saveSettings({ existingNote: "append" });
    settings = await getSettings();
    expect(settings.existingNote).toBe("append");

    await saveSettings({
      // @ts-expect-error Testing invalid runtime input
      existingNote: "invalid_action",
    });
    settings = await getSettings();
    expect(settings.existingNote).toBe("unique");
  });
});
