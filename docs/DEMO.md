# TabVault 20-Second Demo Script

This script guides recording a crisp, 20-second demonstration GIF/video showing TabVault exporting Chrome tab groups to Obsidian and copying to the clipboard.

---

## Prerequisites & Setup (Before Recording)

1. **Obsidian**:
   - Create or open a test vault (e.g. `Vault`).
   - Keep Obsidian running in the background.
2. **Chrome Tab Setup**:
   - Open `scripts/demo-tabs.html` in Chrome.
   - Use the buttons to open the pages and create 3 colored tab groups:
     - 🔵 **Job Search** (Blue, 5 tabs: GitHub Careers, Stripe Jobs, Anthropic Careers, Cloudflare, Vercel)
     - 🔴 **Reading List** (Red, 5 tabs: CommonMark, SQLite Architecture, Rust Book, CSS Flexbox, MDN MV3)
     - 🟢 **Papers** (Green, 5 tabs: Attention Is All You Need, FlashAttention, LoRA, DeepSeek-V3, Llama 3)
3. **TabVault Settings**:
   - Open TabVault Settings and set your vault name (e.g., `Vault`).
   - Set Folder to `Clips` (or leave empty).

---

## Shot-by-Shot Timeline (0:00 – 0:20)

### Shot 1: The Problem & The Popup (0:00 – 0:04)
- **Visual**: Screen shows Chrome with 3 distinct, organized tab groups along the tab bar (Job Search, Reading List, Papers).
- **Action**: Mouse clicks the TabVault icon in the extension toolbar. The popup opens instantly, displaying all 3 groups with their colors, names, and tab counts (`5 tabs` each).
- **On-Screen Caption**: *Export Chrome tab groups directly to Obsidian.*

### Shot 2: Export Group to Obsidian (0:04 – 0:08)
- **Visual**: In the popup list, mouse hovers over the **Job Search** card.
- **Action**: Click the purple **Obsidian** button on **Job Search**.
- **Result**: The popup shows `Opened "Job Search" in Obsidian.`. Obsidian launches to the foreground.
- **On-Screen Caption**: *One click opens your vault.*

### Shot 3: Verified Note in Obsidian (0:08 – 0:12)
- **Visual**: Obsidian active window displaying the freshly created note `# Job Search`.
- **Details visible**:
  - Valid YAML front matter (`source: TabVault`, `group: Job Search`, `color: blue`, `exported: 2026-10-28`, `tabs: 5`).
  - Formatted checklist items:
    - `[ ] [GitHub - Careers and Open Roles](https://github.com/about/careers)`
    - `[ ] [Stripe - Jobs and Engineering Careers](https://stripe.com/jobs)`
    - `[ ] [Anthropic - Careers in AI Safety](https://www.anthropic.com/careers)`
- **On-Screen Caption**: *Clean Markdown with front matter & checklist links.*

### Shot 4: One-Click Copy to Clipboard (0:12 – 0:16)
- **Visual**: Switch back to Chrome. Click the TabVault toolbar icon.
- **Action**: Click the **Copy** button on the **Reading List** group.
- **Result**: Green/grey status bar confirms `Copied 5 links to clipboard.`.
- **On-Screen Caption**: *Or copy clean Markdown directly to your clipboard.*

### Shot 5: Paste & Conclusion (0:16 – 0:20)
- **Visual**: Switch to a text editor, scratchpad, or Obsidian daily note.
- **Action**: Press `Cmd+V` / `Ctrl+V` to paste the complete Markdown note with YAML front matter and checklist links.
- **End Title (Last 1 sec)**:
  - **TabVault** — Zero dependencies. 100% local.
  - `github.com/aryamantepal/tabvault`

---

## Recording Tips

- Screen Resolution: 1280×720 or 1440×900 (scaled for crisp GIF text).
- Frame Rate: 30 fps or 60 fps.
- Export as optimized `.gif` or `.mp4` into `assets/demo.gif`.

---

## Verified Behavior

Checked manually in Chrome on macOS with the clipboard-first handoff (#15, #16, 2026-10-29):

- **Obsidian** on a group creates the note.
- Export All with 3 groups creates 3 notes (legacy inline links, 500 ms apart).
