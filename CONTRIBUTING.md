# Contributing to TabVault

Thank you for contributing to TabVault!

TabVault is built to be fast, private, and local-first with **zero runtime dependencies**. Please review these guidelines before submitting a pull request.

---

## Architectural Principles

1. **Manifest V3 & Zero Runtime Dependencies**: Keep external dependencies limited to dev/build tooling (`devDependencies`).
2. **Local-First & Private**: No analytics, telemetry, or remote code. All storage uses `chrome.storage.local`.
3. **Pure Domain Logic**: Formatting and serialization in `src/markdown.ts` and URI building in `src/obsidian.ts` must remain pure functions tested with Vitest. Chrome API interactions remain at the boundary in `background.ts`, `popup.ts`, and `options.ts`.

---

## Development Setup

### Prerequisites
- Node.js (v20+ or v22 LTS recommended)
- Google Chrome or Chromium-based browser

### Getting Started

```bash
git clone https://github.com/aryamantepal/tabvault.git
cd tabvault
npm install
npm run build
```

### Development Scripts

- `npm run build`: Bundles background worker, popup, and options pages to `dist/`.
- `npm run watch`: Watches `src/` and `public/` and rebuilds automatically.
- `npm run lint`: Runs ESLint and TypeScript type checking (`tsc --noEmit`).
- `npm test`: Runs the Vitest unit test suite.
- `npm run package`: Builds and archives `dist/` into a release `.zip`.

### Loading in Chrome

1. Open `chrome://extensions` in your browser.
2. Toggle on **Developer mode** in the upper-right corner.
3. Click **Load unpacked** and select the `dist/` directory inside this repository.
4. Click the extensions puzzle icon and pin **TabVault** to your toolbar.

---

## Manual Testing Checklist (v0.1)

Before opening a pull request, run `npm test && npm run lint && npm run build` and complete this manual test checklist:

1. **Popup Listing**:
   - Create 2-3 Chrome tab groups with different colors and titles.
   - Click the TabVault extension icon.
   - Verify all tab groups appear with matching color dots, titles, and tab counts.
2. **Clipboard Export**:
   - Click the **Copy** button on a group.
   - Verify the status bar displays `Copied N links to clipboard`.
   - Paste the clipboard contents into a text editor and confirm valid YAML front matter and Markdown links.
3. **Obsidian Export**:
   - Open Settings (gear icon in popup) and enter your Obsidian vault name.
   - Click **Obsidian** on a tab group.
   - Verify Obsidian launches and creates the note in the specified folder with correct content.
4. **Unconfigured Vault Guard**:
   - In Settings, clear the Obsidian vault name and save.
   - In the popup, click **Obsidian**.
   - Verify TabVault alerts you and redirects directly to Settings.
5. **Safe Protocol Length & Clipboard URI Flow**:
   - Verify that very large groups (exceeding 8,000 characters) copy to the clipboard and trigger an `obsidian://new?...&clipboard` URI or combined clipboard copy, with an informative status message.
6. **Append Mode**:
   - In Settings, set "If the note exists" to **Append**.
   - Export a group to Obsidian twice. Confirm that the second export appends only a `## <group> (<date>)` heading and the link list, without duplicating YAML front matter or `# Title`.
7. **Export All with 3 Tab Groups (Popup Lifetime & Background Dispatch)**:
   - Create 3 distinct tab groups in Chrome (e.g., *Job Search*, *Reading List*, *Papers*).
   - Open the TabVault popup and click **Obsidian** under "Export all groups".
   - Notice that Chrome closes the popup as Obsidian launches and takes OS window focus.
   - Allow ~1.5 seconds for the background service worker to dispatch all groups sequentially with 350ms delays.
   - Reopen the popup: verify that the status bar shows `Last export: Successfully exported 3 groups to Obsidian.` and all 3 notes exist in your Obsidian vault.
8. **Theme & Responsiveness**:
   - Toggle system dark mode and light mode; verify popup and options render with appropriate contrast and visible focus outlines.

---

## Pull Request Guidelines

1. Every pull request should reference a corresponding GitHub issue (`Fixes #<issue-number>`).
2. Keep commits atomic with descriptive commit messages following the Conventional Commits style (`feat:`, `fix:`, `docs:`, `chore:`).
3. Do not commit build artifacts (`dist/` or `*.zip`).
4. Ensure all unit tests and lint checks pass cleanly.
