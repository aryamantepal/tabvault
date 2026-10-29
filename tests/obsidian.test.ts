import { describe, it, expect } from "vitest";
import {
  MAX_OBSIDIAN_URI_LENGTH,
  buildObsidianUri,
  buildObsidianClipboardUri,
  formatAppendMarkdown,
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
  it("builds properly encoded obsidian://new URI with %20 spaces instead of +", () => {
    const uri = buildObsidianUri("My Vault", "Folder/Note", "# Note Title\n\nContent");
    expect(uri.startsWith("obsidian://new?")).toBe(true);

    // Ensure spaces are encoded as %20 rather than +
    expect(uri).toContain("vault=My%20Vault");
    expect(uri).not.toContain("vault=My+Vault");
    expect(uri).toContain("file=Folder%2FNote");
    expect(uri).toContain("content=%23%20Note%20Title%0A%0AContent");

    const parsed = new URL(uri);
    expect(parsed.protocol).toBe("obsidian:");
    expect(parsed.hostname).toBe("new");
    expect(parsed.searchParams.get("vault")).toBe("My Vault");
    expect(parsed.searchParams.get("file")).toBe("Folder/Note");
    expect(parsed.searchParams.get("content")).toBe("# Note Title\n\nContent");
  });

  it("handles existingNote parameter for overwrite, append, and unique", () => {
    const uriOverwrite = buildObsidianUri("Vault", "Note", "Text", "overwrite");
    expect(uriOverwrite).toContain("&overwrite=true");
    expect(uriOverwrite).not.toContain("append=true");

    const uriAppend = buildObsidianUri("Vault", "Note", "Text", "append");
    expect(uriAppend).toContain("&append=true");
    expect(uriAppend).not.toContain("overwrite=true");

    const uriUnique = buildObsidianUri("Vault", "Note", "Text", "unique");
    expect(uriUnique).not.toContain("overwrite=");
    expect(uriUnique).not.toContain("append=");
  });

  it("omits vault parameter when vault is empty or undefined", () => {
    const uriEmpty = buildObsidianUri("", "Folder/Note", "Content");
    expect(uriEmpty).not.toContain("vault=");
    expect(uriEmpty).toContain("file=Folder%2FNote");
    expect(uriEmpty).toContain("content=Content");

    const uriWhitespace = buildObsidianUri("   ", "Folder/Note", "Content");
    expect(uriWhitespace).not.toContain("vault=");

    const uriUndefined = buildObsidianUri(undefined, "Folder/Note", "Content");
    expect(uriUndefined).not.toContain("vault=");
  });
});

describe("buildObsidianClipboardUri", () => {
  it("builds a URI with the clipboard flag and no content param", () => {
    const uri = buildObsidianClipboardUri("My Vault", "Folder/Note");
    expect(uri).toContain("obsidian://new?");
    expect(uri).toContain("vault=My%20Vault");
    expect(uri).toContain("file=Folder%2FNote");
    expect(uri).toContain("&clipboard");
    expect(uri).not.toContain("content=");
  });

  it("includes overwrite param when configured", () => {
    const uri = buildObsidianClipboardUri("Vault", "Note", "overwrite");
    expect(uri).toContain("&overwrite=true");
    expect(uri).toContain("&clipboard");
  });

  it("includes append param when configured", () => {
    const uri = buildObsidianClipboardUri("Vault", "Note", "append");
    expect(uri).toContain("&append=true");
    expect(uri).toContain("&clipboard");
  });

  it("omits overwrite and append for unique mode", () => {
    const uri = buildObsidianClipboardUri("Vault", "Note", "unique");
    expect(uri).not.toContain("overwrite=");
    expect(uri).not.toContain("append=");
    expect(uri).toContain("&clipboard");
  });

  it("omits vault parameter when vault is empty or undefined", () => {
    const uriEmpty = buildObsidianClipboardUri("", "Folder/Note");
    expect(uriEmpty).not.toContain("vault=");
    expect(uriEmpty).toContain("file=Folder%2FNote");
    expect(uriEmpty).toContain("&clipboard");

    const uriWhitespace = buildObsidianClipboardUri("   ", "Folder/Note");
    expect(uriWhitespace).not.toContain("vault=");

    const uriUndefined = buildObsidianClipboardUri(undefined, "Folder/Note");
    expect(uriUndefined).not.toContain("vault=");
  });
});

describe("prepareObsidianHandoff", () => {
  const baseSettings = {
    vault: "Personal",
    folder: "Clips",
    nameTemplate: "{{group}}",
    existingNote: "unique" as const,
  };

  it("succeeds and omits vault parameter when vault is empty or whitespace", () => {
    const result = prepareObsidianHandoff(
      "Work",
      "# Content",
      { ...baseSettings, vault: "   " },
      "2026-10-28"
    );

    expect(result.success).toBe(true);
    if (result.success && result.type === "uri") {
      expect(result.uri).not.toContain("vault=");
      expect(result.uri).toContain("file=Clips%2FWork");
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

  it("includes overwrite param in handoff uri when configured", () => {
    const result = prepareObsidianHandoff(
      "Work",
      "# Content",
      { ...baseSettings, existingNote: "overwrite" },
      "2026-10-28"
    );

    expect(result.success).toBe(true);
    if (result.success && result.type === "uri") {
      expect(result.uri).toContain("&overwrite=true");
    }
  });

  it("includes append param and strips front matter and # Title when existingNote is append", () => {
    const fullMarkdown = [
      "---",
      "source: TabVault",
      "group: Work",
      "color: blue",
      "exported: 2026-10-28",
      "tabs: 1",
      "---",
      "",
      "# Work",
      "",
      "- [ ] [Task](https://example.com)",
    ].join("\n");

    const result = prepareObsidianHandoff(
      "Work",
      fullMarkdown,
      { ...baseSettings, existingNote: "append" },
      "2026-10-28"
    );

    expect(result.success).toBe(true);
    if (result.success && result.type === "uri") {
      expect(result.uri).toContain("&append=true");
      expect(result.markdown).not.toContain("---");
      expect(result.markdown).not.toContain("source: TabVault");
      expect(result.markdown).not.toMatch(/^#[^#]/m);
      expect(result.markdown).toContain("## Work (2026-10-28)");
      expect(result.markdown).toContain("- [ ] [Task](https://example.com)");
    }
  });

  it("preserves full note with front matter and # Title for overwrite and unique modes", () => {
    const fullMarkdown = [
      "---",
      "source: TabVault",
      "group: Work",
      "color: blue",
      "exported: 2026-10-28",
      "tabs: 1",
      "---",
      "",
      "# Work",
      "",
      "- [ ] [Task](https://example.com)",
    ].join("\n");

    const uniqueResult = prepareObsidianHandoff(
      "Work",
      fullMarkdown,
      { ...baseSettings, existingNote: "unique" },
      "2026-10-28"
    );
    expect(uniqueResult.success).toBe(true);
    if (uniqueResult.success && uniqueResult.type === "uri") {
      expect(uniqueResult.uri).not.toContain("&append=true");
      expect(uniqueResult.uri).not.toContain("&overwrite=true");
      expect(uniqueResult.markdown).toBe(fullMarkdown);
    }

    const overwriteResult = prepareObsidianHandoff(
      "Work",
      fullMarkdown,
      { ...baseSettings, existingNote: "overwrite" },
      "2026-10-28"
    );
    expect(overwriteResult.success).toBe(true);
    if (overwriteResult.success && overwriteResult.type === "uri") {
      expect(overwriteResult.uri).toContain("&overwrite=true");
      expect(overwriteResult.markdown).toBe(fullMarkdown);
    }
  });

  describe("formatAppendMarkdown", () => {
    it("strips YAML front matter and # Title from raw full markdown", () => {
      const fullNote = "---\ngroup: Reading\n---\n\n# Reading\n\n- [ ] [Link](https://a.com)";
      const formatted = formatAppendMarkdown(fullNote, "Reading", "2026-10-28");
      expect(formatted).toBe("## Reading (2026-10-28)\n\n- [ ] [Link](https://a.com)");
    });

    it("leaves already formatted ## heading untouched", () => {
      const body = "## Reading (2026-10-28)\n\n- [ ] [Link](https://a.com)";
      const formatted = formatAppendMarkdown(body, "Reading", "2026-10-28");
      expect(formatted).toBe(body);
    });
  });

  it("returns clipboard_uri when URI exceeds MAX_OBSIDIAN_URI_LENGTH", () => {
    expect(MAX_OBSIDIAN_URI_LENGTH).toBe(8000);

    // Generate markdown content > 8,000 characters
    const massiveContent = "# Large Export\n" + "- [ ] [Link](https://example.com/)\n".repeat(350);
    expect(massiveContent.length).toBeGreaterThan(MAX_OBSIDIAN_URI_LENGTH);

    const result = prepareObsidianHandoff(
      "Large Group",
      massiveContent,
      baseSettings,
      "2026-10-28"
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.type).toBe("clipboard_uri");
      if (result.type === "clipboard_uri") {
        // The URI should use the clipboard flag, not embed content
        expect(result.uri).toContain("&clipboard");
        expect(result.uri).not.toContain("content=");
        expect(result.uri.length).toBeLessThan(MAX_OBSIDIAN_URI_LENGTH);
        expect(result.markdown).toBe(massiveContent);
      }
    }
  });

  it("clipboard_uri includes overwrite flag for large overwrite notes", () => {
    const massiveContent = "# Large\n" + "- [ ] [Link](https://example.com/)\n".repeat(350);

    const result = prepareObsidianHandoff(
      "Big",
      massiveContent,
      { ...baseSettings, existingNote: "overwrite" },
      "2026-10-28"
    );

    expect(result.success).toBe(true);
    if (result.success && result.type === "clipboard_uri") {
      expect(result.uri).toContain("&overwrite=true");
      expect(result.uri).toContain("&clipboard");
    }
  });
});
