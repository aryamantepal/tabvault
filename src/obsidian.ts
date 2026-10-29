import { getDefaultDateString } from "./markdown";
import { ExistingNoteAction, ObsidianHandoffResult, TabVaultSettings } from "./types";

/**
 * Maximum length of an inline `content=` URI. It applies only where the note
 * body travels in the link: legacy mode, and the fallback when the clipboard
 * write fails. The default flow keeps the body on the clipboard, so its URI is
 * short regardless of note size.
 *
 * The limit is a conservative guess rather than a verified hard Windows
 * limit. Windows ShellExecute and CreateProcess pipelines document ~8,192
 * character command buffers, and protocol handler limits vary across
 * platforms and versions, so 8,000 leaves a safety buffer.
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
 * Shown by Obsidian only when it can't read the clipboard. It is a string the
 * user can act on, not a note body, so the user is never left with a silent
 * empty note.
 */
export const CLIPBOARD_FALLBACK_MESSAGE =
  "TabVault couldn't share the clipboard with Obsidian. Paste with Cmd/Ctrl+V.";

function buildQuery(
  vault: string | undefined,
  filePath: string,
  content: string | undefined,
  existingNote: ExistingNoteAction | undefined,
  silent: boolean | undefined
): string {
  const params: [string, string][] = [];

  const trimmedVault = vault?.trim();
  if (trimmedVault) {
    params.push(["vault", trimmedVault]);
  }

  params.push(["file", filePath]);
  if (content !== undefined) {
    params.push(["content", content]);
  }

  if (existingNote === "overwrite") {
    params.push(["overwrite", "true"]);
  } else if (existingNote === "append") {
    params.push(["append", "true"]);
  }

  if (silent) {
    params.push(["silent", "true"]);
  }

  // encodeURIComponent rather than URLSearchParams so spaces become "%20", not
  // "+", which Obsidian may display literally.
  return params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
}

/**
 * Builds an obsidian://new URI that carries the note body in `content=`.
 * Used by legacy mode and as the fallback when the clipboard write fails.
 */
export function buildObsidianUri(
  vault: string | undefined,
  filePath: string,
  content: string,
  existingNote?: ExistingNoteAction,
  silent?: boolean
): string {
  return `obsidian://new?${buildQuery(vault, filePath, content, existingNote, silent)}`;
}

/**
 * Builds an obsidian://new URI that reads the note body from the system
 * clipboard. The `clipboard` param is a bare flag (no value) and is appended
 * last. The short `content=` message is only used by Obsidian when it can't
 * read the clipboard.
 * See https://help.obsidian.md/Extending+Obsidian/Obsidian+URI
 */
export function buildObsidianClipboardUri(
  vault: string | undefined,
  filePath: string,
  existingNote?: ExistingNoteAction,
  silent?: boolean
): string {
  const query = buildQuery(vault, filePath, CLIPBOARD_FALLBACK_MESSAGE, existingNote, silent);
  return `obsidian://new?${query}&clipboard`;
}

/**
 * Strips YAML front matter and top-level # title from Markdown if present,
 * ensuring body-only content with a ## heading for append mode.
 */
export function formatAppendMarkdown(
  markdown: string,
  groupTitle?: string,
  date: string = getDefaultDateString()
): string {
  let content = markdown;
  // Remove YAML front matter if present
  if (content.startsWith("---")) {
    const endFm = content.indexOf("\n---", 3);
    if (endFm !== -1) {
      content = content.slice(endFm + 4).replace(/^\r?\n+/, "");
    }
  }
  // Remove top-level # title if present
  content = content.replace(/^#[ \t]+[^\r\n]*\r?\n*/, "").replace(/^\r?\n+/, "");

  // If it doesn't already start with a ## heading, prepend ## <group> (<date>)
  if (!content.startsWith("## ")) {
    const title = groupTitle?.trim() || "Untitled group";
    content = `## ${title} (${date})\n\n${content}`;
  }
  return content;
}

/**
 * Prepares the Obsidian export handoff.
 *
 * Default: returns a "clipboard_uri" result. The caller must write `markdown`
 * to the clipboard, then open `uri`. If that write fails, the caller opens
 * `fallbackUri` (inline content) instead; it is undefined when the inline URI
 * would exceed MAX_OBSIDIAN_URI_LENGTH, in which case there is no safe fallback.
 *
 * Legacy mode: returns a "uri" result with inline content, switching to
 * "clipboard_uri" only when that URI is too long.
 */
export function prepareObsidianHandoff(
  groupTitle: string | undefined,
  markdown: string,
  settings: Pick<TabVaultSettings, "vault" | "folder" | "nameTemplate"> & {
    existingNote?: ExistingNoteAction;
    legacyMode?: boolean;
    silent?: boolean;
  },
  date: string = getDefaultDateString()
): ObsidianHandoffResult {
  const vault = settings.vault?.trim();

  const noteName = resolveNoteName(settings.nameTemplate, groupTitle, date);
  const folder = sanitizeFolderPath(settings.folder);
  const filePath = folder ? `${folder}/${noteName}` : noteName;

  const contentToExport =
    settings.existingNote === "append"
      ? formatAppendMarkdown(markdown, groupTitle, date)
      : markdown;

  const inlineUri = buildObsidianUri(
    vault,
    filePath,
    contentToExport,
    settings.existingNote,
    settings.silent
  );
  const inlineFits = inlineUri.length <= MAX_OBSIDIAN_URI_LENGTH;

  if (settings.legacyMode && inlineFits) {
    return { success: true, type: "uri", uri: inlineUri, noteName, markdown: contentToExport };
  }

  return {
    success: true,
    type: "clipboard_uri",
    uri: buildObsidianClipboardUri(vault, filePath, settings.existingNote, settings.silent),
    fallbackUri: inlineFits ? inlineUri : undefined,
    noteName,
    markdown: contentToExport,
  };
}

/**
 * Dispatches an obsidian:// URI by navigating the active tab to it.
 *
 * The earlier approach (create a hidden tab, close it after 500 ms) could
 * cancel the protocol handoff, or Chrome's "Open Obsidian?" prompt, before it
 * finished. Navigating the active tab creates nothing to clean up, and Chrome
 * keeps showing the current page because external protocols don't replace it.
 * Falls back to a new tab only when there is no active tab to reuse.
 *
 * Must run in the service worker (see OPEN_OBSIDIAN_URI in background.ts): the
 * popup can be destroyed the moment Obsidian takes focus.
 */
export async function openObsidianUri(uri: string): Promise<void> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id !== undefined) {
    await chrome.tabs.update(activeTab.id, { url: uri });
  } else {
    await chrome.tabs.create({ url: uri });
  }
}
