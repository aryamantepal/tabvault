# TabVault

A free, open-source Chrome extension that exports a Chrome tab group as a Markdown note in Obsidian (or to your clipboard).

![TabVault demo](assets/demo.gif)

> No accounts, no tracking, no servers. Everything runs locally in your browser.

## Why

Chrome has no built-in way to copy all the links in a tab group. If you keep reading lists or job-hunt tabs in groups and move to a new computer (or just want them in your notes), you end up copying URLs one by one. [Obsidian Web Clipper](https://obsidian.md/clipper) clips single pages, not whole groups. TabVault fills that gap.

## Features (v0.1)

- Lists your tab groups in the popup (name, color, tab count)
- One click to export a group as Markdown:
  - Title is the group name
  - Each tab is a checklist item: `- [ ] [Page title](https://url)`
- Two outputs:
  1. **Send to Obsidian** via an `obsidian://new` link (into a vault and folder you choose, or your last-opened vault if blank)
  2. **Copy to clipboard**
- Clipboard handoff by default: **Obsidian** copies the note to your clipboard and opens `obsidian://new?...&clipboard`, so note length never hits operating system link limits. The link also carries a short message that Obsidian shows only if it can't read the clipboard. If the clipboard write fails, TabVault puts the note in the link instead (up to ~8,000 characters).
- Legacy mode (Settings): puts the note content in the link and leaves your clipboard alone. Notes over ~8,000 characters still use the clipboard, since longer links are unreliable on some operating systems.
- **Export All to Obsidian** always uses content-in-the-link, one note per group, one after another. It runs in the extension's background worker so it keeps going when Chrome closes the popup as Obsidian takes focus, and that worker can't write the clipboard. Groups too long for a link are copied together as one combined Markdown note instead.
- Links are opened in your current tab, which stays on its page. Chrome may ask once whether to allow opening Obsidian.
- Settings: vault name (optional, defaults to your last-opened vault), folder, note-name template, checklist vs. plain list, behavior if the note already exists in Obsidian (create a new unique note, overwrite, or append), search across all windows, include/exclude internal browser pages, legacy mode, and "Don't bring Obsidian to the front" (`silent=true`)
- Optional "Export all groups" that produces one note per group (or copies all to clipboard)

## Not in scope for v0.1

Restoring groups, syncing, duplicate detection, Firefox support. These are good first issues for contributors later.

## Limitations

- **"Opened in Obsidian" means Chrome handed the link off.** TabVault can't see whether Obsidian created the note.
- **Saved tab groups must be open:** Chrome's extension API only returns tab groups that are currently open in a window. Saved groups that are closed into the bookmarks bar do not appear in TabVault. Click a group in your bookmarks bar to open it before exporting.

## Example output

```markdown
---
source: TabVault
group: Job Search
color: blue
exported: 2026-10-28
tabs: 3
---

# Job Search

- [ ] [Software Engineer - Example Co](https://example.com/jobs/1)
- [ ] [ML Engineer - Another Co](https://example.com/jobs/2)
- [ ] [Careers | Third Co](https://example.com/careers)
```

## Install (development)

```bash
git clone https://github.com/aryamantepal/tabvault.git
cd tabvault
npm install
npm run build
```

Then open `chrome://extensions`, enable Developer mode, click **Load unpacked**, and choose the `dist/` folder.

## Usage

1. Click the TabVault icon.
2. (Optional) Set your Obsidian vault name in Settings (leave blank to default to your last-opened vault).
3. Click **Obsidian** or **Copy** next to a tab group (or use **Export All to Obsidian** / **Copy All to Clipboard** at the bottom).

> **Note:** Saved groups that are closed don't show up here. Click a group in your bookmarks bar to open it, then export.

## Privacy

- Permissions requested: `tabs`, `tabGroups`, and `storage` (for your settings, stored locally). No `clipboardWrite` permission is needed since clipboard copying runs with user gesture activation directly from the popup. Your clipboard is overwritten with the note when you click **Obsidian** (unless legacy mode is on).
- No network requests. No analytics. No remote code.
- Tab titles and URLs are read only when you click Obsidian or Copy.

## Development

- TypeScript, Manifest V3, built with esbuild
- `npm run build` bundles to `dist/`
- `npm run watch` rebuilds on change
- `npm run lint` and `npm test` for the formatter unit tests
- `npm run package` zips `dist/` for the Chrome Web Store

See [AGENTS.md](AGENTS.md) for the architecture and conventions, and [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute.

## Contributing

Issues and PRs are welcome. Look for issues labeled `good first issue`. Ideas: Firefox support, restoring groups from a note, duplicate detection, better Obsidian integration.

## License

MIT, see [LICENSE](LICENSE).
