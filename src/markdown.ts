import { ListStyle, MarkdownFormatOptions, TabGroupItem, TabItem } from "./types";

/**
 * Checks whether a URL is a browser-internal page.
 */
export function isInternalPage(url?: string): boolean {
  if (!url) return true;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith("chrome://") ||
    trimmed.startsWith("chrome-extension://") ||
    trimmed.startsWith("about:") ||
    trimmed.startsWith("edge://") ||
    trimmed.startsWith("brave://")
  );
}

/**
 * Quotes a YAML string value if it contains special characters or is empty.
 */
export function quoteYamlString(value: string): string {
  if (
    value === "" ||
    /[:#"'`\n\r\t]/.test(value) ||
    value.startsWith(" ") ||
    value.endsWith(" ") ||
    /^[-?[\]{}!*&>|%@,]/.test(value)
  ) {
    return JSON.stringify(value);
  }
  return value;
}

/**
 * Sanitizes a tab title for use in Markdown link text.
 * Escapes [ and ], collapses newlines to spaces, trims whitespace,
 * and falls back to URL hostname or 'Untitled'.
 */
export function sanitizeTabTitle(title: string | undefined, url: string | undefined): string {
  let cleaned = (title ?? "").replace(/[\r\n]+/g, " ").trim();

  if (!cleaned && url) {
    try {
      const parsed = new URL(url);
      cleaned = parsed.hostname || url;
    } catch {
      cleaned = url;
    }
  }

  if (!cleaned) {
    cleaned = "Untitled";
  }

  // Escape backslashes first, then Markdown link brackets and special formatting chars:
  // [, ], |, *, _, <, >, `
  return cleaned
    .replace(/\\/g, "\\\\")
    .replace(/([|*_<`>[\]])/g, "\\$1");
}

/**
 * Formats a URL for Markdown link destination.
 * If URL contains spaces, parentheses, or angular brackets, wraps it in <...>
 * according to CommonMark specification.
 */
export function sanitizeMarkdownUrl(url: string | undefined): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (
    trimmed.includes(" ") ||
    trimmed.includes("(") ||
    trimmed.includes(")") ||
    trimmed.includes("<") ||
    trimmed.includes(">")
  ) {
    const escaped = trimmed.replace(/>/g, "%3E").replace(/</g, "%3C");
    return `<${escaped}>`;
  }
  return trimmed;
}

/**
 * Formats a single tab entry as a Markdown list item.
 */
export function formatTabListItem(
  tab: TabItem,
  listStyle: ListStyle = "checklist"
): string {
  const prefix = listStyle === "plain" ? "-" : "- [ ]";
  const title = sanitizeTabTitle(tab.title, tab.url);
  const url = sanitizeMarkdownUrl(tab.url);
  return `${prefix} [${title}](${url})`;
}

/**
 * Gets the current date in YYYY-MM-DD format.
 */
export function getDefaultDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formats a tab group and its tabs into the standard TabVault Markdown note.
 */
export function formatGroupMarkdown(
  group: Pick<TabGroupItem, "title" | "color">,
  tabs: TabItem[],
  options: MarkdownFormatOptions = {}
): string {
  const {
    date = getDefaultDateString(),
    listStyle = "checklist",
    includeInternalPages = false,
  } = options;

  const rawGroupTitle = group.title?.trim() || "Untitled group";
  const color = group.color || "grey";

  // Filter tabs according to settings
  const filteredTabs = includeInternalPages
    ? tabs
    : tabs.filter((t) => !isInternalPage(t.url));

  const tabLines = filteredTabs.map((t) => formatTabListItem(t, listStyle));
  const tabsCount = filteredTabs.length;

  const yamlGroup = quoteYamlString(rawGroupTitle);
  const headerTitle = rawGroupTitle.replace(/[\r\n]+/g, " ").trim();

  const lines: string[] = [
    "---",
    "source: TabVault",
    `group: ${yamlGroup}`,
    `color: ${color}`,
    `exported: ${date}`,
    `tabs: ${tabsCount}`,
    "---",
    "",
    `# ${headerTitle}`,
    "",
  ];

  if (tabLines.length > 0) {
    lines.push(...tabLines);
  }

  return lines.join("\n");
}

/**
 * Formats multiple tab groups into a single combined Markdown document.
 */
export function formatCombinedMarkdown(
  groups: Array<{ group: Pick<TabGroupItem, "title" | "color">; tabs: TabItem[] }>,
  options: MarkdownFormatOptions = {}
): string {
  const {
    date = getDefaultDateString(),
    listStyle = "checklist",
    includeInternalPages = false,
  } = options;

  const lines: string[] = [
    "---",
    "source: TabVault",
    `exported: ${date}`,
    `groups: ${groups.length}`,
    "---",
    "",
    "# Tab Groups Export",
    "",
  ];

  for (const { group, tabs } of groups) {
    const rawGroupTitle = group.title?.trim() || "Untitled group";
    const headerTitle = rawGroupTitle.replace(/[\r\n]+/g, " ").trim();
    const filteredTabs = includeInternalPages
      ? tabs
      : tabs.filter((t) => !isInternalPage(t.url));

    lines.push(`## ${headerTitle} (${group.color || "grey"})`);
    lines.push("");

    if (filteredTabs.length === 0) {
      lines.push("_No tabs in this group_");
    } else {
      for (const tab of filteredTabs) {
        lines.push(formatTabListItem(tab, listStyle));
      }
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
