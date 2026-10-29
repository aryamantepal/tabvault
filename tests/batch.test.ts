import { describe, it, expect } from "vitest";
import {
  formatBatchResultSummary,
  LoadedGroup,
  planBatchExport,
} from "../src/batch";
import { TabVaultSettings } from "../src/types";

describe("planBatchExport", () => {
  const settings: TabVaultSettings = {
    vault: "MyVault",
    folder: "Groups",
    nameTemplate: "{{group}}",
    listStyle: "checklist",
    allWindows: true,
    includeInternalPages: false,
    existingNote: "unique",
    legacyMode: false,
    silent: false,
  };

  it("plans direct URI export when all groups fit within URI limits", () => {
    const groups: LoadedGroup[] = [
      {
        group: { id: 1, title: "Job Search", color: "blue", windowId: 1 },
        tabs: [{ title: "Job 1", url: "https://example.com/job1" }],
      },
      {
        group: { id: 2, title: "Reading List", color: "red", windowId: 1 },
        tabs: [{ title: "Article 1", url: "https://example.com/art1" }],
      },
      {
        group: { id: 3, title: "Papers", color: "green", windowId: 1 },
        tabs: [{ title: "Paper 1", url: "https://arxiv.org/abs/1" }],
      },
    ];

    const plan = planBatchExport(groups, settings, "2026-10-28");
    expect(plan.directGroups).toHaveLength(3);
    expect(plan.clipboardGroups).toHaveLength(0);
    expect(plan.clipboardMarkdown).toBeUndefined();
  });

  it("separates oversized groups into clipboard export", () => {
    // A group with enough tabs to exceed MAX_OBSIDIAN_URI_LENGTH (8000)
    const massiveTabs = Array.from({ length: 300 }, (_, i) => ({
      title: `Link Number ${i}`,
      url: `https://example.com/very/long/path/for/tab/number/${i}?query=some_extra_long_parameter_data`,
    }));

    const groups: LoadedGroup[] = [
      {
        group: { id: 1, title: "Normal Group", color: "blue", windowId: 1 },
        tabs: [{ title: "Page 1", url: "https://example.com" }],
      },
      {
        group: { id: 2, title: "Huge Group", color: "yellow", windowId: 1 },
        tabs: massiveTabs,
      },
    ];

    const plan = planBatchExport(groups, settings, "2026-10-28");
    expect(plan.directGroups).toHaveLength(1);
    expect(plan.directGroups[0].group.title).toBe("Normal Group");

    expect(plan.clipboardGroups).toHaveLength(1);
    expect(plan.clipboardGroups[0].group.title).toBe("Huge Group");
    expect(plan.clipboardMarkdown).toBeDefined();
    expect(plan.clipboardMarkdown).toContain("## Huge Group (yellow)");
    expect(plan.clipboardMarkdown).toContain("groups: 1");
  });
});

describe("formatBatchResultSummary", () => {
  it("formats summary when all groups exported successfully to Obsidian", () => {
    const summary = formatBatchResultSummary({
      totalGroups: 3,
      sentCount: 3,
      clipboardCount: 0,
    });
    expect(summary).toBe("Successfully exported 3 groups to Obsidian.");

    const singleSummary = formatBatchResultSummary({
      totalGroups: 1,
      sentCount: 1,
      clipboardCount: 0,
    });
    expect(singleSummary).toBe("Successfully exported 1 group to Obsidian.");
  });

  it("formats summary when some groups were sent and some copied to clipboard", () => {
    const summary = formatBatchResultSummary({
      totalGroups: 3,
      sentCount: 2,
      clipboardCount: 1,
    });
    expect(summary).toBe("Sent 2 to Obsidian. 1 was too long for Obsidian links, so it was copied to the clipboard.");

    const pluralSummary = formatBatchResultSummary({
      totalGroups: 5,
      sentCount: 3,
      clipboardCount: 2,
    });
    expect(pluralSummary).toBe("Sent 3 to Obsidian. 2 were too long for Obsidian links, so they were copied to the clipboard.");
  });

  it("formats summary when all groups were copied to clipboard", () => {
    const summary = formatBatchResultSummary({
      totalGroups: 2,
      sentCount: 0,
      clipboardCount: 2,
    });
    expect(summary).toBe("2 groups were too long for Obsidian links, so they were copied to the clipboard.");

    const singleSummary = formatBatchResultSummary({
      totalGroups: 1,
      sentCount: 0,
      clipboardCount: 1,
    });
    expect(singleSummary).toBe("1 group was too long for Obsidian links, so it was copied to the clipboard.");
  });

  it("formats summary when errors occurred and no groups succeeded", () => {
    const summary = formatBatchResultSummary({
      totalGroups: 2,
      sentCount: 0,
      clipboardCount: 0,
      errors: ["Vault not found", "Timeout"],
    });
    expect(summary).toBe("Batch export failed: Vault not found; Timeout");
  });
});
