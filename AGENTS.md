# AGENTS.md

Instructions for AI coding agents working on TabVault. Read this fully before writing code.

## Goal

Build a Chrome (Manifest V3) extension that exports a Chrome tab group as a Markdown note, delivered to Obsidian through an `obsidian://new` URI or copied to the clipboard. See README.md for the product description. Ship the smallest working v0.1, then stop.

## Hard constraints

- Manifest V3, TypeScript, no runtime dependencies (dev dependencies only).
- Permissions: `tabs`, `tabGroups`, `storage`. Do not add host permissions, `<all_urls>`, `history`, or `bookmarks`.
- No network requests, analytics, telemetry, or remote code. Everything is local.
- No frameworks for the popup (plain TypeScript and DOM, small CSS). Keep the bundle tiny.
- License is MIT. Do not add code with an incompatible license.

## Repository layout

```
tabvault/
├── src/
│   ├── background.ts     # service worker: installation defaults & background batch export
│   ├── batch.ts          # PURE functions: batch export planning & result formatting (unit tested)
│   ├── popup.ts          # popup UI: list groups, export buttons, status messages
│   ├── popup.html
│   ├── options.ts        # settings page (vault, folder, name template, list style, existing note)
│   ├── options.html
│   ├── markdown.ts       # PURE functions: groups + tabs -> Markdown string (unit tested)
│   ├── obsidian.ts       # builds obsidian://new URIs, handles URL-length fallback
│   ├── settings.ts       # typed wrapper over chrome.storage.local
│   ├── tabs.ts           # shared tab and group queries via chrome.tabGroups / chrome.tabs
│   └── types.ts
├── public/
│   ├── manifest.json
│   └── icons/            # 16, 48, 128 px
├── tests/
│   └── markdown.test.ts
├── .github/
│   ├── workflows/ci.yml        # lint + test + build on PRs
│   ├── workflows/release.yml   # on tag v*: build, zip dist/, attach to GitHub Release
│   └── ISSUE_TEMPLATE/         # bug_report.md, feature_request.md
├── README.md  AGENTS.md  CONTRIBUTING.md  LICENSE  package.json  tsconfig.json  .gitignore
```

## Behavior spec

### Listing groups
- Use `chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT })` or all windows (a setting; default: all windows).
- For each group, count tabs with `chrome.tabs.query({ groupId })`.
- Show title (or "Untitled group" if empty), color dot, and tab count.

### Markdown format (`markdown.ts`)
Given a group `{ title, color }` and tabs `[{ title, url }]`, output exactly:

```
---
source: TabVault
group: <title>
color: <color>
exported: <YYYY-MM-DD>
tabs: <n>
---

# <title>

- [ ] [<tab title>](<url>)
```

Rules:
- Escape `[`, `]` in tab titles; replace newlines with spaces; trim; fall back to the URL host if the title is empty.
- Wrap URLs containing `)` or spaces with `<...>` or percent-encode them so the link stays valid.
- Skip `chrome://`, `chrome-extension://`, and `about:` tabs by default (setting: include them).
- List style setting: `checklist` (`- [ ]`) or `plain` (`-`).
- YAML front matter value for `group` must be quoted if it contains `:`, `#`, or quotes.
- Same input must always give the same output (take the date as a parameter for testing).

### Obsidian handoff (`obsidian.ts`)
- URI form: `obsidian://new?vault=<vault>&file=<folder/name>&content=<encoded markdown>` with everything `encodeURIComponent`-encoded.
- Note name comes from a template, default `{{group}}`. Supported tokens: `{{group}}`, `{{date}}`. Strip characters that are illegal in file names (`\ / : * ? " < > |`).
- If the encoded URI is longer than about 8,000 characters (make it a constant), switch to the clipboard flow: copy Markdown to the clipboard and open `obsidian://new?...&clipboard`. For batch export, oversized groups are copied together as combined Markdown to the clipboard.
- Open the URI with `chrome.tabs.create({ url })` and close that tab afterwards, or use `chrome.tabs.update` on the current tab. Pick whichever works reliably and document the choice in a comment.
- If no vault name is set, open the options page and show a message.

### Clipboard
- Use `navigator.clipboard.writeText` from the popup (user gesture). Show "Copied N links" feedback.

### Settings (`settings.ts`)
Defaults: `vault: ""`, `folder: ""`, `nameTemplate: "{{group}}"`, `listStyle: "checklist"`, `allWindows: true`, `includeInternalPages: false`, `existingNote: "unique"`. Store them in `chrome.storage.local`. Do not use `chrome.storage.sync`, because the author does not want cloud sync.

### Export all
- A button that exports every group, one note each, one after another. Handled in the background service worker so the export loop survives when the popup closes on focus loss. Sequential dispatch with a short delay between URIs, and results stored in `chrome.storage.local` to report to the user upon reopening.

## UI

- Popup width about 360px. List of groups with **Obsidian** and **Copy** buttons.
- Status line for success and error messages. No alert dialogs.
- Respect light and dark mode via `prefers-color-scheme`.
- Keyboard accessible, with real `<button>` elements and visible focus states.

## Build and tooling

- `esbuild` bundling `background.ts`, `popup.ts`, and `options.ts` into `dist/`, copying `public/` and the HTML files.
- Scripts: `build`, `watch`, `lint` (eslint + tsc --noEmit), `test` (vitest), `package` (zip `dist/` to `tabvault-<version>.zip`).
- `tsconfig`: strict mode, target ES2022, types from `@types/chrome`.
- `.gitignore`: `node_modules`, `dist`, `*.zip`.

## Tests

- Unit tests for `markdown.ts` and the URI and file-name logic in `obsidian.ts`: empty title, special characters, parentheses in URLs, long lists, internal pages skipped, front matter quoting, URL-length fallback.
- No tests that need a real browser are required for v0.1. Add a short manual test checklist to CONTRIBUTING.md.

## Definition of done for v0.1

1. `npm install && npm run build` succeeds, and `dist/` loads unpacked in Chrome with no errors.
2. The popup lists groups from the current browser profile.
3. Export to Obsidian creates the note with the correct content, and Copy puts the same Markdown on the clipboard.
4. Over-long groups fall back to the clipboard with a visible explanation.
5. `npm test` and `npm run lint` pass.
6. README, CONTRIBUTING.md, MIT LICENSE (copyright "Aryaman Tepal", year 2026), issue templates, and the CI and release workflows exist.

## Conventions

- Small, focused commits with clear messages. Do not commit `dist/`.
- Keep functions pure where possible and push Chrome API calls to the edges.
- Prefer clarity over cleverness. Comment the reason for non-obvious choices, especially around Obsidian URI limits.
- Do not add features beyond the spec. If something is ambiguous, pick the simplest option and note it in a comment or in the PR description.

## Future work (do NOT implement now)

Restore a group from a note, duplicate detection, Firefox support (`browser` API and MV2/MV3 differences), a direct write to the vault through the File System Access API, and templates for note formats.
