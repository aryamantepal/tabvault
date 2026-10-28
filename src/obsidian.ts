import { getDefaultDateString } from "./markdown";
import { ExistingNoteAction, ObsidianHandoffResult, TabVaultSettings } from "./types";

/**
 * Maximum safe length for an obsidian:// URI before falling back to clipboard.
 * Windows protocol handlers invoke applications via ShellExecute and command-line
 * process creation. On Windows, command-line buffers and protocol dispatch pipelines
 * enforce limits around 8,192 characters (8 KB). Exceeding this boundary can cause
 * protocol link launches to fail silently or truncate query parameters. A threshold of
 * 8,000 characters provides a reliable safety margin across Windows and Chromium.
 */
export const MAX_OBSIDIAN_URI_LENGTH = 8000;

/**
 * Characters that are illegal in Obsidian / operating system filenames:
 * \ / : * ? " < > |
 */
const ILLEGAL_FILENAME_REGEX = /[\\/:*?"<>|]/g;

/**
 * Sanitizes a string for use as a valid filename by stripping illegal characters
 * and trimming invalid leading/trailing punctuation or whitespace.
 */
export function sanitizeFileName(name: string): string {
  const stripped = name.replace(ILLEGAL_FILENAME_REGEX, "").trim();
  // Strip trailing periods or spaces which cause issues on Windows/macOS
  const cleaned = stripped.replace(/[. ]+$/, "").trim();
  return cleaned || "Untitled";
}

/**
 * Resolves the note name from the template string.
 * Supported tokens: {{group}}, {{date}}.
 */
export function resolveNoteName(
  template: string,
  groupTitle: string | undefined,
  date: string = getDefaultDateString()
): string {
  const rawTitle = groupTitle?.trim() || "Untitled group";
  let resolved = template || "{{group}}";

  resolved = resolved.replace(/\{\{group\}\}/g, rawTitle);
  resolved = resolved.replace(/\{\{date\}\}/g, date);

  return sanitizeFileName(resolved);
}

/**
 * Normalizes folder path by cleaning illegal characters, preserving forward slashes,
 * and trimming leading/trailing slashes.
 */
export function sanitizeFolderPath(folder: string): string {
  if (!folder) return "";
  const normalized = folder.replace(/\\/g, "/");
  const parts = normalized
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => sanitizeFileName(part))
    .filter((part) => part.length > 0 && part !== "Untitled");
  return parts.join("/");
}

/**
 * Builds the obsidian://new URI string.
 * Query parameters are constructed with encodeURIComponent rather than URLSearchParams
 * to ensure spaces are encoded as "%20" rather than "+", which Obsidian may display literally.
 * Supports Obsidian's native existing note handling ("overwrite=true", "append=true",
 * or omitting both to create a new unique incremented note name).
 */
export function buildObsidianUri(
  vault: string,
  filePath: string,
  content: string,
  existingNote?: ExistingNoteAction
): string {
  const params: [string, string][] = [
    ["vault", vault],
    ["file", filePath],
    ["content", content],
  ];

  if (existingNote === "overwrite") {
    params.push(["overwrite", "true"]);
  } else if (existingNote === "append") {
    params.push(["append", "true"]);
  }

  const query = params
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  return `obsidian://new?${query}`;
}

/**
 * Prepares the Obsidian export handoff.
 * Checks for vault existence, generates the note path, builds the URI,
 * and validates length against MAX_OBSIDIAN_URI_LENGTH.
 */
export function prepareObsidianHandoff(
  groupTitle: string | undefined,
  markdown: string,
  settings: Pick<TabVaultSettings, "vault" | "folder" | "nameTemplate"> & {
    existingNote?: ExistingNoteAction;
  },
  date: string = getDefaultDateString()
): ObsidianHandoffResult {
  const vault = settings.vault?.trim();
  if (!vault) {
    return {
      success: false,
      error: "no_vault",
      message: "Please configure your Obsidian vault name in TabVault settings.",
    };
  }

  const noteName = resolveNoteName(settings.nameTemplate, groupTitle, date);
  const folder = sanitizeFolderPath(settings.folder);
  const filePath = folder ? `${folder}/${noteName}` : noteName;

  const uri = buildObsidianUri(vault, filePath, markdown, settings.existingNote);

  if (uri.length > MAX_OBSIDIAN_URI_LENGTH) {
    return {
      success: true,
      type: "clipboard_fallback",
      noteName,
      reason: `Note exceeds safe protocol URI length limit (${uri.length.toLocaleString()} > ${MAX_OBSIDIAN_URI_LENGTH.toLocaleString()} chars). Markdown was copied to clipboard instead.`,
      markdown,
    };
  }

  return {
    success: true,
    type: "uri",
    uri,
    noteName,
    markdown,
  };
}

/**
 * Dispatches an obsidian:// URI via Chrome tabs API.
 * We create an inactive tab to trigger the protocol handler and immediately close it.
 * This prevents leaving an empty orphaned tab in the user's browser window.
 */
export async function openObsidianUri(uri: string): Promise<void> {
  const tab = await chrome.tabs.create({ url: uri, active: false });
  if (tab.id !== undefined) {
    // A short 500ms delay ensures the OS protocol dispatcher handles the request before tab cleanup
    setTimeout(() => {
      chrome.tabs.remove(tab.id!).catch(() => {
        // Tab may have already been closed automatically by Chrome
      });
    }, 500);
  }
}
