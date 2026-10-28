import { describe, it, expect } from "vitest";
import {
  MAX_OBSIDIAN_URI_LENGTH,
  buildObsidianUri,
  prepareObsidianHandoff,
  resolveNoteName,
  sanitizeFileName,
  sanitizeFolderPath,
} from "../src/obsidian";

describe("sanitizeFileName", () => {
  it("strips illegal characters", () => {
    expect(sanitizeFileName('invalid/\\:*?"<>|name')).toBe("invalidname");
  });

  it("trims trailing dots and spaces", () => {
    expect(sanitizeFileName("my note...  ")).toBe("my note");
  });

  it("falls back to Untitled when empty", () => {
    expect(sanitizeFileName("   ///   ")).toBe("Untitled");
  });
});

describe("resolveNoteName", () => {
  it("replaces {{group}} and {{date}} tokens", () => {
    const name = resolveNoteName(
      "Tabs - {{group}} - {{date}}",
      "Research",
      "2026-10-28"
    );
    expect(name).toBe("Tabs - Research - 2026-10-28");
  });

  it("sanitizes illegal characters in group title", () => {
    const name = resolveNoteName(
      "{{group}}",
      'Project: AI / ML <v1>*',
      "2026-10-28"
    );
    expect(name).toBe("Project AI  ML v1");
  });

  it("defaults to {{group}} when template is empty", () => {
    const name = resolveNoteName("", "My Group", "2026-10-28");
    expect(name).toBe("My Group");
  });
});

describe("sanitizeFolderPath", () => {
  it("preserves folder separators while stripping illegal characters", () => {
    expect(sanitizeFolderPath("Notes/Web? Links/Chrome*")).toBe("Notes/Web Links/Chrome");
  });

  it("normalizes backslashes to forward slashes", () => {
    expect(sanitizeFolderPath("Notes\\TabVault")).toBe("Notes/TabVault");
  });

  it("trims leading and trailing slashes", () => {
    expect(sanitizeFolderPath("/Notes/Tabs/")).toBe("Notes/Tabs");
  });

  it("returns empty string when folder is empty", () => {
    expect(sanitizeFolderPath("")).toBe("");
  });
});

describe("buildObsidianUri", () => {
  it("builds properly encoded obsidian://new URI", () => {
    const uri = buildObsidianUri("My Vault", "Folder/Note", "# Note Title\n\nContent");
    expect(uri.startsWith("obsidian://new?")).toBe(true);

    const parsed = new URL(uri);
    expect(parsed.protocol).toBe("obsidian:");
    expect(parsed.hostname).toBe("new");
    expect(parsed.searchParams.get("vault")).toBe("My Vault");
    expect(parsed.searchParams.get("file")).toBe("Folder/Note");
    expect(parsed.searchParams.get("content")).toBe("# Note Title\n\nContent");
  });
});

describe("prepareObsidianHandoff", () => {
  const baseSettings = {
    vault: "Personal",
    folder: "Clips",
    nameTemplate: "{{group}}",
  };

  it("returns error if vault is empty", () => {
    const result = prepareObsidianHandoff(
      "Work",
      "# Content",
      { ...baseSettings, vault: "   " },
      "2026-10-28"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("no_vault");
    }
  });

  it("returns uri result for normal note", () => {
    const result = prepareObsidianHandoff(
      "Work",
      "# Content",
      baseSettings,
      "2026-10-28"
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.type).toBe("uri");
      if (result.type === "uri") {
        expect(result.uri).toContain("vault=Personal");
        expect(result.uri).toContain("file=Clips%2FWork");
        expect(result.noteName).toBe("Work");
      }
    }
  });

  it("falls back to clipboard when URI exceeds MAX_OBSIDIAN_URI_LENGTH", () => {
    // Generate massive markdown content > 30,000 characters
    const massiveContent = "# Large Export\n" + "- [ ] [Link](https://example.com/)\n".repeat(1200);
    expect(massiveContent.length).toBeGreaterThan(MAX_OBSIDIAN_URI_LENGTH);

    const result = prepareObsidianHandoff(
      "Large Group",
      massiveContent,
      baseSettings,
      "2026-10-28"
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.type).toBe("clipboard_fallback");
      if (result.type === "clipboard_fallback") {
        expect(result.reason).toContain("exceeds Obsidian URI length limit");
        expect(result.markdown).toBe(massiveContent);
      }
    }
  });
});
