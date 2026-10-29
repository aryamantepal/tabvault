import { describe, it, expect, vi, afterEach } from "vitest";
import {
  CLIPBOARD_FALLBACK_MESSAGE,
  MAX_OBSIDIAN_URI_LENGTH,
  buildObsidianUri,
  buildObsidianClipboardUri,
  formatAppendMarkdown,
  openObsidianUri,
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

  it("adds silent=true only when silent is set", () => {
    expect(buildObsidianUri("V", "Note", "Text", "unique", true)).toContain("&silent=true");
    expect(buildObsidianUri("V", "Note", "Text", "unique", false)).not.toContain("silent=");
    expect(buildObsidianUri("V", "Note", "Text")).not.toContain("silent=");
  });
});

describe("buildObsidianClipboardUri", () => {
  it("builds a URI ending in the bare clipboard flag with only the short fallback message as content", () => {
    const uri = buildObsidianClipboardUri("My Vault", "Folder/Note");
    expect(uri).toContain("obsidian://new?");
    expect(uri).toContain("vault=My%20Vault");
    expect(uri).toContain("file=Folder%2FNote");
    expect(uri.endsWith("&clipboard")).toBe(true);

    const parsed = new URL(uri);
    expect(parsed.searchParams.get("content")).toBe(CLIPBOARD_FALLBACK_MESSAGE);
    expect(parsed.searchParams.has("clipboard")).toBe(true);
  });

  it("adds silent=true only when silent is set", () => {
    expect(buildObsidianClipboardUri("V", "Note", "unique", true)).toContain("&silent=true");
    expect(buildObsidianClipboardUri("V", "Note", "unique", false)).not.toContain("silent=");
    expect(buildObsidianClipboardUri("V", "Note")).not.toContain("silent=");
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
    legacyMode: true,
    silent: false,
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

  it("legacy mode returns clipboard_uri without a fallback when the inline URI exceeds MAX_OBSIDIAN_URI_LENGTH", () => {
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
        expect(new URL(result.uri).searchParams.get("content")).toBe(CLIPBOARD_FALLBACK_MESSAGE);
        expect(result.uri.length).toBeLessThan(MAX_OBSIDIAN_URI_LENGTH);
        expect(result.fallbackUri).toBeUndefined();
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

describe("prepareObsidianHandoff clipboard mode (default)", () => {
  const settings = {
    vault: "Personal",
    folder: "Clips",
    nameTemplate: "{{group}}",
    existingNote: "unique" as const,
    legacyMode: false,
    silent: false,
  };

  it("returns a short clipboard_uri with an inline fallbackUri for a small note", () => {
    const result = prepareObsidianHandoff("Work", "# Content", settings, "2026-10-28");

    expect(result.success).toBe(true);
    if (result.success && result.type === "clipboard_uri") {
      expect(result.uri).toContain("vault=Personal");
      expect(result.uri).toContain("file=Clips%2FWork");
      expect(result.uri.endsWith("&clipboard")).toBe(true);
      expect(result.markdown).toBe("# Content");
      expect(result.fallbackUri).toBeDefined();
      expect(new URL(result.fallbackUri!).searchParams.get("content")).toBe("# Content");
      expect(result.fallbackUri).not.toContain("clipboard");
    } else {
      throw new Error("expected clipboard_uri");
    }
  });

  it("keeps using the clipboard URI for a note far over the inline limit, with no fallback", () => {
    const massive = "# Large\n" + "- [ ] [Link](https://example.com/)\n".repeat(500);
    const result = prepareObsidianHandoff("Big", massive, settings, "2026-10-28");

    expect(result.success && result.type).toBe("clipboard_uri");
    if (result.success && result.type === "clipboard_uri") {
      expect(result.uri.length).toBeLessThan(MAX_OBSIDIAN_URI_LENGTH);
      expect(result.fallbackUri).toBeUndefined();
      expect(result.markdown).toBe(massive);
    }
  });

  it("omits vault when blank in both the clipboard URI and the fallback", () => {
    const result = prepareObsidianHandoff("Work", "x", { ...settings, vault: " " }, "2026-10-28");
    if (result.success && result.type === "clipboard_uri") {
      expect(result.uri).not.toContain("vault=");
      expect(result.fallbackUri).not.toContain("vault=");
    } else {
      throw new Error("expected clipboard_uri");
    }
  });

  it("passes silent, overwrite and append through to both URIs", () => {
    const silent = prepareObsidianHandoff("W", "x", { ...settings, silent: true }, "2026-10-28");
    const overwrite = prepareObsidianHandoff(
      "W",
      "x",
      { ...settings, existingNote: "overwrite" },
      "2026-10-28"
    );
    const append = prepareObsidianHandoff(
      "W",
      "---\ngroup: W\n---\n\n# W\n\n- a",
      { ...settings, existingNote: "append" },
      "2026-10-28"
    );

    if (
      silent.success && silent.type === "clipboard_uri" &&
      overwrite.success && overwrite.type === "clipboard_uri" &&
      append.success && append.type === "clipboard_uri"
    ) {
      expect(silent.uri).toContain("&silent=true");
      expect(silent.fallbackUri).toContain("&silent=true");
      expect(overwrite.uri).toContain("&overwrite=true");
      expect(overwrite.fallbackUri).toContain("&overwrite=true");
      expect(append.uri).toContain("&append=true");
      expect(append.markdown).toContain("## W (2026-10-28)");
      expect(append.markdown).not.toContain("---");
    } else {
      throw new Error("expected clipboard_uri results");
    }
  });
});

describe("prepareObsidianHandoff legacy mode", () => {
  const settings = {
    vault: "",
    folder: "",
    nameTemplate: "{{group}}",
    existingNote: "unique" as const,
    legacyMode: true,
    silent: true,
  };

  it("returns inline content without a clipboard flag, omitting blank vault, and honours silent", () => {
    const result = prepareObsidianHandoff("Work", "# Content", settings, "2026-10-28");
    expect(result.success && result.type).toBe("uri");
    if (result.success && result.type === "uri") {
      expect(result.uri).not.toContain("vault=");
      expect(result.uri).not.toContain("clipboard");
      expect(result.uri).toContain("&silent=true");
      expect(new URL(result.uri).searchParams.get("content")).toBe("# Content");
    }
  });
});

describe("openObsidianUri", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("navigates the active tab instead of creating and closing a tab", async () => {
    const tabs = {
      query: vi.fn().mockResolvedValue([{ id: 42 }]),
      update: vi.fn().mockResolvedValue({ id: 42 }),
      create: vi.fn(),
      remove: vi.fn(),
    };
    vi.stubGlobal("chrome", { tabs });

    await openObsidianUri("obsidian://new?file=A&clipboard");

    expect(tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(tabs.update).toHaveBeenCalledWith(42, { url: "obsidian://new?file=A&clipboard" });
    expect(tabs.create).not.toHaveBeenCalled();
    expect(tabs.remove).not.toHaveBeenCalled();
  });

  it("falls back to creating a tab when there is no active tab", async () => {
    const tabs = {
      query: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 7 }),
    };
    vi.stubGlobal("chrome", { tabs });

    await openObsidianUri("obsidian://new?file=A");

    expect(tabs.update).not.toHaveBeenCalled();
    expect(tabs.create).toHaveBeenCalledWith({ url: "obsidian://new?file=A" });
  });
});
