# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Auto Tab Grouper is a Chrome Extension (Manifest V3) that automatically groups browser tabs based on user-defined domain rules. Zero-dependency, vanilla JS — no build tools, no bundler, no npm.

## Development

**Install in Chrome for testing:**
1. Navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this project folder

There is no build step, test framework, or linter configured. Changes are tested manually by reloading the extension in Chrome.

## Architecture

```
manifest.json          → Entry point: declares service worker + options page
background.js          → Service Worker: listens to chrome.tabs.onUpdated,
                          reads rules from chrome.storage.sync, groups tabs
options.html/js/css     → Options Page: rule CRUD UI, global toggle
chrome.storage.sync     → Shared state between background.js and options.js
```

**Data flow:** Options page writes rules to `chrome.storage.sync` → Background service worker reads them on each tab event → matches hostname → creates/joins tab groups.

**Storage schema (`chrome.storage.sync`):**
```js
{
  isEnabled: boolean,
  rules: [{ id: string, host: string, groupName: string, color: string }]
}
```

## Key Design Decisions

- **No rule caching in background.js** — reads from `chrome.storage.sync` on every tab event because MV3 service workers can restart at any time, making in-memory caches unreliable.
- **Exact hostname matching only** — `new URL(tab.url).hostname === rule.host`, no wildcards or regex.
- **Existing group lookup by title + windowId** — uses `chrome.tabGroups.query()`, stateless across service worker restarts.
- **`changeInfo.status === 'complete'`** — groups tabs after page load completes (not on URL change) to avoid redirect/double-fire issues.

## Chrome APIs Used

- `chrome.tabs.onUpdated` — detect navigation
- `chrome.tabs.group` / `chrome.tabGroups.query` / `chrome.tabGroups.update` — manage tab groups
- `chrome.storage.sync` — persist rules (cross-device sync)
- Colors limited to 9 Chrome natives: blue, red, yellow, green, pink, purple, cyan, orange, grey
