# Auto Tab Grouper

Chrome Extension (Manifest V3) that automatically groups browser tabs based on user-defined domain rules.

## Features

- **Exact Domain Matching** - Group tabs by hostname (e.g., `github.com`, `mail.google.com`)
- **Window-specific Numbering** - Same rule across multiple windows gets unique numbered titles (e.g., "AI ①", "AI ②")
- **Cross-window Tab Move** - Dragging a tab to another window automatically regroups it
- **Auto Renumbering** - Closing a window renumbers remaining groups sequentially
- **Custom Group Names & Colors** - 9 Chrome native colors supported
- **Global Toggle** - Enable/disable auto grouping with one click
- **Cross-device Sync** - Rules sync across devices via `chrome.storage.sync`
- **Options Page** - Full CRUD for managing grouping rules

## Installation

1. Clone this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select this project folder

## Usage

1. Open the extension's **Options** page
2. Enable the global toggle
3. Add rules:
   - **Domain**: exact hostname to match (e.g., `github.com`)
   - **Group Name**: display name for the tab group
   - **Color**: pick from blue, red, yellow, green, pink, purple, cyan, orange, grey
4. Navigate to a matching domain — tabs are grouped automatically

## Project Structure

```
├── manifest.json    # Extension manifest (MV3)
├── background.js    # Service worker - tab event handling & grouping logic
├── options.html     # Options page markup
├── options.js       # Options page logic (rule CRUD)
├── options.css      # Options page styles
└── icons/           # Extension icons (16, 48, 128px)
```

## Permissions

| Permission | Reason |
|------------|--------|
| `tabs` | Detect tab navigation and assign tabs to groups |
| `tabGroups` | Create and update tab groups |
| `storage` | Persist rules and settings across sessions |
