import { describe, it, expect } from "vitest";
import {
  formatGroupMarkdown,
  formatCombinedMarkdown,
  formatTabListItem,
  isInternalPage,
  quoteYamlString,
  sanitizeMarkdownUrl,
  sanitizeTabTitle,
} from "../src/markdown";
import { TabItem } from "../src/types";

describe("quoteYamlString", () => {
  it("quotes empty string", () => {
    expect(quoteYamlString("")).toBe('""');
  });

  it("quotes strings containing colons", () => {
    expect(quoteYamlString("Project: Alpha")).toBe('"Project: Alpha"');
  });

  it("quotes strings containing hashes", () => {
    expect(quoteYamlString("Reading #1")).toBe('"Reading #1"');
  });

  it("quotes strings containing quotes", () => {
    expect(quoteYamlString('The "Best" Sites')).toBe('"The \\"Best\\" Sites"');
  });

  it("leaves simple alphanumeric strings unquoted", () => {
    expect(quoteYamlString("Research Work")).toBe("Research Work");
  });

  it("quotes strings with leading or trailing whitespace", () => {
    expect(quoteYamlString(" Work ")).toBe('" Work "');
  });
});

describe("sanitizeTabTitle", () => {
  it("escapes square brackets", () => {
    const raw = "[Tutorial] Complete Guide [2026]";
    expect(sanitizeTabTitle(raw, "https://example.com")).toBe("\\[Tutorial\\] Complete Guide \\[2026\\]");
  });

  it("collapses newlines and carriage returns into spaces", () => {
    const raw = "Headline\n\rSubhead\nDetails";
    expect(sanitizeTabTitle(raw, "https://example.com")).toBe("Headline Subhead Details");
  });

  it("trims whitespace", () => {
    const raw = "   Important Resource   ";
    expect(sanitizeTabTitle(raw, "https://example.com")).toBe("Important Resource");
  });

  it("falls back to URL hostname when title is empty", () => {
    expect(sanitizeTabTitle("", "https://news.ycombinator.com/item?id=123")).toBe("news.ycombinator.com");
  });

  it("falls back to 'Untitled' when both title and URL are empty", () => {
    expect(sanitizeTabTitle(undefined, undefined)).toBe("Untitled");
  });

  it("escapes pipe characters", () => {
    expect(sanitizeTabTitle("Site | Section | Page", "https://example.com")).toBe(
      "Site \\| Section \\| Page"
    );
  });

  it("escapes asterisks and boundary underscores but preserves mid-word underscores", () => {
    expect(sanitizeTabTitle("*Important* _Note_", "https://example.com")).toBe(
      "\\*Important\\* \\_Note\\_"
    );
    expect(sanitizeTabTitle("my_var_name and snake_case", "https://example.com")).toBe(
      "my_var_name and snake_case"
    );
    expect(sanitizeTabTitle("_leading and trailing_", "https://example.com")).toBe(
      "\\_leading and trailing\\_"
    );
  });

  it("escapes angle brackets and backticks", () => {
    expect(sanitizeTabTitle("<Component> with `props`", "https://example.com")).toBe(
      "\\<Component\\> with \\`props\\`"
    );
  });

  it("escapes mixed markdown special characters and brackets together", () => {
    expect(
      sanitizeTabTitle("[PR #1] Fix: *fast* | `v1.0` <urgent> & _clean_", "https://example.com")
    ).toBe(
      "\\[PR #1\\] Fix: \\*fast\\* \\| \\`v1.0\\` \\<urgent\\> & \\_clean\\_"
    );
  });
});

describe("sanitizeMarkdownUrl", () => {
  it("leaves standard URLs untouched", () => {
    const url = "https://example.com/article/one";
    expect(sanitizeMarkdownUrl(url)).toBe("https://example.com/article/one");
  });

  it("wraps URLs with parentheses in angle brackets", () => {
    const url = "https://en.wikipedia.org/wiki/Rust_(programming_language)";
    expect(sanitizeMarkdownUrl(url)).toBe("<https://en.wikipedia.org/wiki/Rust_(programming_language)>");
  });

  it("wraps URLs with spaces in angle brackets", () => {
    const url = "https://example.com/files/my document.pdf";
    expect(sanitizeMarkdownUrl(url)).toBe("<https://example.com/files/my document.pdf>");
  });

  it("returns empty string for missing URL", () => {
    expect(sanitizeMarkdownUrl(undefined)).toBe("");
  });
});

describe("isInternalPage", () => {
  it("identifies chrome:// URLs as internal", () => {
    expect(isInternalPage("chrome://extensions")).toBe(true);
    expect(isInternalPage("chrome://bookmarks/")).toBe(true);
  });

  it("identifies chrome-extension:// URLs as internal", () => {
    expect(isInternalPage("chrome-extension://abcdefg/popup.html")).toBe(true);
  });

  it("identifies about: URLs as internal", () => {
    expect(isInternalPage("about:blank")).toBe(true);
  });

  it("treats web URLs as external", () => {
    expect(isInternalPage("https://github.com")).toBe(false);
    expect(isInternalPage("http://localhost:3000")).toBe(false);
  });
});

describe("formatTabListItem", () => {
  it("formats checklist style by default", () => {
    const tab: TabItem = { title: "GitHub", url: "https://github.com" };
    expect(formatTabListItem(tab, "checklist")).toBe("- [ ] [GitHub](https://github.com)");
  });

  it("formats plain style when specified", () => {
    const tab: TabItem = { title: "GitHub", url: "https://github.com" };
    expect(formatTabListItem(tab, "plain")).toBe("- [GitHub](https://github.com)");
  });
});

describe("formatGroupMarkdown", () => {
  const tabs: TabItem[] = [
    { title: "GitHub", url: "https://github.com" },
    { title: "Chrome Settings", url: "chrome://settings" },
    { title: "Wikipedia: C++", url: "https://en.wikipedia.org/wiki/C++_(programming_language)" },
  ];

  it("produces exact expected output format with checklist", () => {
    const output = formatGroupMarkdown(
      { title: "Dev Group", color: "blue" },
      tabs,
      { date: "2026-10-28", listStyle: "checklist", includeInternalPages: false }
    );

    const expected = [
      "---",
      "source: TabVault",
      "group: Dev Group",
      "color: blue",
      "exported: 2026-10-28",
      "tabs: 2",
      "---",
      "",
      "# Dev Group",
      "",
      "- [ ] [GitHub](https://github.com)",
      "- [ ] [Wikipedia: C++](<https://en.wikipedia.org/wiki/C++_(programming_language)>)",
    ].join("\n");

    expect(output).toBe(expected);
  });

  it("includes internal pages when requested", () => {
    const output = formatGroupMarkdown(
      { title: "System", color: "grey" },
      tabs,
      { date: "2026-10-28", includeInternalPages: true }
    );

    expect(output).toContain("tabs: 3");
    expect(output).toContain("- [ ] [Chrome Settings](chrome://settings)");
  });

  it("handles empty title with 'Untitled group'", () => {
    const output = formatGroupMarkdown(
      { title: "", color: "red" },
      [],
      { date: "2026-10-28" }
    );

    expect(output).toContain("group: Untitled group");
    expect(output).toContain("# Untitled group");
    expect(output).toContain("tabs: 0");
  });

  it("quotes frontmatter when title contains special characters", () => {
    const output = formatGroupMarkdown(
      { title: "Project: 2026 #Launch", color: "purple" },
      [],
      { date: "2026-10-28" }
    );

    expect(output).toContain('group: "Project: 2026 #Launch"');
    expect(output).toContain("# Project: 2026 #Launch");
  });

  describe("existingNote modes in formatGroupMarkdown", () => {
    const sampleTabs: TabItem[] = [
      { title: "GitHub", url: "https://github.com" },
      { title: "Example", url: "https://example.com" },
    ];

    it("append mode outputs body only with ## heading and no front matter or # Title", () => {
      const output = formatGroupMarkdown(
        { title: "Job Search", color: "blue" },
        sampleTabs,
        {
          date: "2026-10-28",
          listStyle: "checklist",
          existingNote: "append",
        }
      );

      // Must not contain YAML front matter delimiters or properties
      expect(output).not.toContain("---");
      expect(output).not.toContain("source: TabVault");
      expect(output).not.toContain("group:");
      expect(output).not.toContain("color:");
      expect(output).not.toContain("exported:");
      expect(output).not.toContain("tabs:");

      // Must not contain # Title
      expect(output).not.toMatch(/^#[^#]/m);

      // Must contain ## heading with date
      expect(output).toContain("## Job Search (2026-10-28)");
      expect(output).toContain("- [ ] [GitHub](https://github.com)");
      expect(output).toContain("- [ ] [Example](https://example.com)");

      // Check exact format
      const expected = [
        "## Job Search (2026-10-28)",
        "",
        "- [ ] [GitHub](https://github.com)",
        "- [ ] [Example](https://example.com)",
      ].join("\n");
      expect(output).toBe(expected);
    });

    it("overwrite mode keeps full note with YAML front matter and # Title", () => {
      const output = formatGroupMarkdown(
        { title: "Job Search", color: "blue" },
        sampleTabs,
        {
          date: "2026-10-28",
          listStyle: "checklist",
          existingNote: "overwrite",
        }
      );

      expect(output).toContain("---");
      expect(output).toContain("source: TabVault");
      expect(output).toContain("group: Job Search");
      expect(output).toContain("color: blue");
      expect(output).toContain("exported: 2026-10-28");
      expect(output).toContain("tabs: 2");
      expect(output).toContain("# Job Search");
      expect(output).toContain("- [ ] [GitHub](https://github.com)");
      expect(output).toContain("- [ ] [Example](https://example.com)");
    });

    it("unique mode keeps full note with YAML front matter and # Title", () => {
      const output = formatGroupMarkdown(
        { title: "Job Search", color: "blue" },
        sampleTabs,
        {
          date: "2026-10-28",
          listStyle: "checklist",
          existingNote: "unique",
        }
      );

      expect(output).toContain("---");
      expect(output).toContain("source: TabVault");
      expect(output).toContain("group: Job Search");
      expect(output).toContain("color: blue");
      expect(output).toContain("exported: 2026-10-28");
      expect(output).toContain("tabs: 2");
      expect(output).toContain("# Job Search");
      expect(output).toContain("- [ ] [GitHub](https://github.com)");
      expect(output).toContain("- [ ] [Example](https://example.com)");
    });
  });
});

describe("formatCombinedMarkdown", () => {
  it("formats multiple groups into single document", () => {
    const groups = [
      {
        group: { title: "Group 1", color: "blue" },
        tabs: [{ title: "Page 1", url: "https://example.com/1" }],
      },
      {
        group: { title: "Group 2", color: "green" },
        tabs: [{ title: "Page 2", url: "https://example.com/2" }],
      },
    ];

    const result = formatCombinedMarkdown(groups, { date: "2026-10-28" });
    expect(result).toContain("## Group 1 (blue)");
    expect(result).toContain("- [ ] [Page 1](https://example.com/1)");
    expect(result).toContain("## Group 2 (green)");
    expect(result).toContain("- [ ] [Page 2](https://example.com/2)");
    expect(result).toContain("groups: 2");
  });
});
