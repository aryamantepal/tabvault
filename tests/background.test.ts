import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoadedGroup } from "../src/batch";
import { DEFAULT_SETTINGS } from "../src/settings";

describe("executeBatchExport", () => {
  const groups: LoadedGroup[] = ["One", "Two", "Three"].map((title, i) => ({
    group: { id: i + 1, title, color: "blue", windowId: 1 },
    tabs: [{ title: "Tab", url: `https://example.com/${i}` }],
  }));

  const tabs = {
    query: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  };
  const storageSet = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    tabs.query.mockResolvedValue([{ id: 5 }]);
    tabs.update.mockResolvedValue({ id: 5 });
    storageSet.mockResolvedValue(undefined);
    vi.stubGlobal("chrome", { tabs, storage: { local: { set: storageSet } } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("opens one inline-content link per group on the active tab, spaced apart", async () => {
    const { executeBatchExport } = await import("../src/background");

    const pending = executeBatchExport(groups, { ...DEFAULT_SETTINGS, silent: true });
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(tabs.update).toHaveBeenCalledTimes(3);
    const urls = tabs.update.mock.calls.map((c) => new URL(c[1].url as string));
    expect(urls.map((u) => u.searchParams.get("file"))).toEqual(["One", "Two", "Three"]);
    for (const u of urls) {
      expect(u.searchParams.has("content")).toBe(true);
      expect(u.searchParams.has("clipboard")).toBe(false);
      expect(u.searchParams.get("silent")).toBe("true");
    }
    expect(result.sentCount).toBe(3);
    expect(result.errors).toEqual([]);
    expect(storageSet).toHaveBeenCalled();
  });

  it("records an error for a group that fails and continues with the rest", async () => {
    const { executeBatchExport } = await import("../src/background");
    tabs.update.mockRejectedValueOnce(new Error("boom"));

    const pending = executeBatchExport(groups, DEFAULT_SETTINGS);
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result.sentCount).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("One");
  });
});
