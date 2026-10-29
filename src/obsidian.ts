import { getDefaultDateString } from "./markdown";
import { ExistingNoteAction, ObsidianHandoffResult, TabVaultSettings } from "./types";

/**
 * Threshold for switching from inline content= URIs to the clipboard flow.
 *
 * We keep short inline content= URIs for notes under this threshold because
 * it is non-destructive — it avoids clobbering whatever the user already has on
 * their system clipboard. For notes exceeding the threshold, we switch to
 * Obsidian's `clipboard` parameter (`obsidian://new?...&clipboard`), which lets
 * Obsidian pull note content directly from the clipboard without risking OS-level
 * URI length truncation.
 *
 * The 8,000 character limit is a conservative guess rather than a verified
 * hard Windows limit. While Windows ShellExecute and CreateProcess pipelines
 * frequently document ~8,192 character command buffers, OS protocol handler limits
 * vary across platforms and versions. 8,000 provides a reliable safety buffer.
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
 * Builds an obsidian://new URI with inline content.
 * Query parameters use encodeURIComponent (not URLSearchParams) so spaces are
 * encoded as "%20" rather than "+", which Obsidian may display literally.
 */
export function buildObsidianUri(
  vault: string | undefined,
  filePath: string,
  content: string,
  existingNote?: ExistingNoteAction
): string {
  const params: [string, string][] = [];

  const trimmedVault = vault?.trim();
  if (trimmedVault) {
    params.push(["vault", trimmedVault]);
  }

  params.push(["file", filePath]);
  params.push(["content", content]);

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
 * Builds an obsidian://new URI that reads content from the system clipboard.
 * The `clipboard` param is a bare flag (no value). This avoids embedding
 * the note body in the URI, sidestepping OS protocol-handler length limits.
 * See https://help.obsidian.md/Extending+Obsidian/Obsidian+URI
 */
export function buildObsidianClipboardUri(
  vault: string | undefined,
  filePath: string,
  existingNote?: ExistingNoteAction
): string {
  const params: [string, string][] = [];

  const trimmedVault = vault?.trim();
  if (trimmedVault) {
    params.push(["vault", trimmedVault]);
  }

  params.push(["file", filePath]);

  if (existingNote === "overwrite") {
    params.push(["overwrite", "true"]);
  } else if (existingNote === "append") {
    params.push(["append", "true"]);
  }

  const query = params
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  // `clipboard` is a bare parameter (no =value) that tells Obsidian to use
  // the current clipboard content as the note body.
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
 * For small notes, returns a "uri" result with inline content.
 * For large notes (exceeding MAX_OBSIDIAN_URI_LENGTH), returns a "clipboard_uri"
 * result: the caller must first write the markdown to the clipboard, then open
 * the returned URI which uses Obsidian's `clipboard` parameter.
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

  const noteName = resolveNoteName(settings.nameTemplate, groupTitle, date);
  const folder = sanitizeFolderPath(settings.folder);
  const filePath = folder ? `${folder}/${noteName}` : noteName;

  const contentToExport =
    settings.existingNote === "append"
      ? formatAppendMarkdown(markdown, groupTitle, date)
      : markdown;

  const uri = buildObsidianUri(vault, filePath, contentToExport, settings.existingNote);

  if (uri.length > MAX_OBSIDIAN_URI_LENGTH) {
    // URI too long for safe protocol dispatch. Use the clipboard flow instead:
    // the caller writes markdown to the clipboard, then opens a short URI with
    // the `clipboard` flag so Obsidian reads from the clipboard.
    const clipboardUri = buildObsidianClipboardUri(vault, filePath, settings.existingNote);
    return {
      success: true,
      type: "clipboard_uri",
      uri: clipboardUri,
      noteName,
      markdown: contentToExport,
    };
  }

  return {
    success: true,
    type: "uri",
    uri,
    noteName,
    markdown: contentToExport,
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
