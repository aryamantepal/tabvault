# TabVault

A free, open-source Chrome extension that exports a Chrome tab group as a Markdown note in Obsidian (or to your clipboard).

> No accounts, no tracking, no servers. Everything runs locally in your browser.

## Why

Chrome has no built-in way to copy all the links in a tab group. If you keep reading lists or job-hunt tabs in groups and move to a new computer (or just want them in your notes), you end up copying URLs one by one. [Obsidian Web Clipper](https://obsidian.md/clipper) clips single pages, not whole groups. TabVault fills that gap.

## Features (v0.1)

- Lists your tab groups in the popup (name, color, tab count)
- One click to export a group as Markdown:
  - Title is the group name
  - Each tab is a checklist item: `- [ ] [Page title](https://url)`
- Two outputs:
  1. **Send to Obsidian** via an `obsidian://new` link, into a vault and folder you choose
  2. **Copy to clipboard** (also the automatic fallback when the note is too long for a URL)
- Settings: vault name, folder, note-name template, checklist vs plain list
- Optional "Export all groups" that produces one note per group

## Not in scope for v0.1

Restoring groups, syncing, duplicate detection, Firefox support. These are good first issues for contributors later.

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
2. Set your Obsidian vault name once in Settings.
3. Click **Export** next to a tab group, then choose **Obsidian** or **Copy**.

## Privacy

- Permissions requested: `tabs`, `tabGroups`, `storage` (for your settings, stored locally), and `clipboardWrite`.
- No network requests. No analytics. No remote code.
- Tab titles and URLs are read only when you click Export.

## Development

- TypeScript, Manifest V3, built with esbuild (or Vite)
- `npm run build` bundles to `dist/`
- `npm run watch` rebuilds on change
- `npm run lint` and `npm test` for the formatter unit tests
- `npm run package` zips `dist/` for the Chrome Web Store

See [AGENTS.md](AGENTS.md) for the architecture and conventions, and [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute.

## Contributing

Issues and PRs are welcome. Look for issues labeled `good first issue`. Ideas: Firefox support, restoring groups from a note, duplicate detection, better Obsidian integration.

## License

MIT, see [LICENSE](LICENSE).
