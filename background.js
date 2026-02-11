// Auto Tab Grouper - Background Service Worker

const CIRCLED_NUMBERS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

function buildGroupTitle(groupName, num) {
  return `${groupName} ${CIRCLED_NUMBERS[num - 1] || `(${num})`}`;
}

function parseGroupTitle(title) {
  for (let i = 0; i < CIRCLED_NUMBERS.length; i++) {
    const suffix = ` ${CIRCLED_NUMBERS[i]}`;
    if (title.endsWith(suffix)) {
      return { groupName: title.slice(0, -suffix.length), number: i + 1 };
    }
  }
  return null;
}

function isGroupForRule(title, groupName) {
  const parsed = parseGroupTitle(title);
  return parsed !== null && parsed.groupName === groupName;
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const existing = await chrome.storage.sync.get(['isEnabled', 'rules']);
    if (existing.isEnabled === undefined) {
      await chrome.storage.sync.set({ isEnabled: true, rules: [] });
    }
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url) return;
  if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) return;

  const { isEnabled, rules } = await chrome.storage.sync.get(['isEnabled', 'rules']);
  if (!isEnabled) return;
  if (!rules || rules.length === 0) return;

  const hostname = new URL(tab.url).hostname;
  const rule = rules.find(r => r.host === hostname);

  if (rule) {
    await applyGrouping(tabId, tab.windowId, rule);
  } else if (tab.groupId !== -1) {
    await tryUngrouping(tabId, tab.groupId, rules);
  }
});

// When a tab is moved to a different window, regroup it under that window's group
// Uses a delay to let Chrome finish its internal group management first
chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
  setTimeout(async () => {
    try {
      const { isEnabled, rules } = await chrome.storage.sync.get(['isEnabled', 'rules']);
      if (!isEnabled || !rules || rules.length === 0) return;

      const tab = await chrome.tabs.get(tabId);
      if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) return;

      const hostname = new URL(tab.url).hostname;
      const rule = rules.find(r => r.host === hostname);
      if (!rule) return;

      if (tab.groupId !== -1) {
        await chrome.tabs.ungroup(tabId);
      }
      await applyGrouping(tabId, attachInfo.newWindowId, rule);
    } catch (error) {
      console.error('[Auto Tab Grouper] Re-grouping on window move failed:', error);
    }
  }, 500);
});

// When a window is closed:
// 1. Try to remove orphaned saved groups (groups not in any open window)
// 2. Renumber remaining active groups sequentially
chrome.windows.onRemoved.addListener(async (windowId) => {
  // Wait for Chrome to finish closing the window
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const { isEnabled, rules } = await chrome.storage.sync.get(['isEnabled', 'rules']);
    if (!isEnabled || !rules || rules.length === 0) return;

    const allGroups = await chrome.tabGroups.query({});
    const openWindows = await chrome.windows.getAll();
    const openWindowIds = new Set(openWindows.map(w => w.id));

    // Renumber remaining active groups (only in open windows)
    const groupNames = [...new Set(rules.map(r => r.groupName))];

    for (const groupName of groupNames) {
      const ruleGroups = allGroups
        .filter(g => isGroupForRule(g.title, groupName) && openWindowIds.has(g.windowId))
        .sort((a, b) => parseGroupTitle(a.title).number - parseGroupTitle(b.title).number);

      for (let i = 0; i < ruleGroups.length; i++) {
        const expectedNum = i + 1;
        const currentNum = parseGroupTitle(ruleGroups[i].title).number;

        if (currentNum !== expectedNum) {
          await chrome.tabGroups.update(ruleGroups[i].id, {
            title: buildGroupTitle(groupName, expectedNum)
          });
        }
      }
    }
  } catch (error) {
    console.error('[Auto Tab Grouper] Cleanup on window close failed:', error);
  }
});

// When rules change, scan all existing tabs and apply grouping
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'sync') return;
  if (!changes.rules && !changes.isEnabled) return;

  const { isEnabled, rules } = await chrome.storage.sync.get(['isEnabled', 'rules']);
  if (!isEnabled || !rules || rules.length === 0) return;

  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  for (const tab of tabs) {
    const hostname = new URL(tab.url).hostname;
    const rule = rules.find(r => r.host === hostname);

    if (rule) {
      await applyGrouping(tab.id, tab.windowId, rule);
    }
  }
});

async function tryUngrouping(tabId, groupId, rules) {
  try {
    const group = await chrome.tabGroups.get(groupId);
    const isOurGroup = rules.some(r => isGroupForRule(group.title, r.groupName));
    if (isOurGroup) {
      await chrome.tabs.ungroup(tabId);
    }
  } catch (error) {
    console.error('[Auto Tab Grouper] Ungrouping failed:', error);
  }
}

async function applyGrouping(tabId, windowId, rule) {
  try {
    const allGroups = await chrome.tabGroups.query({});
    const windowGroups = allGroups.filter(g => g.windowId === windowId);
    const existingGroup = windowGroups.find(g => isGroupForRule(g.title, rule.groupName));

    let groupId;

    if (existingGroup) {
      groupId = existingGroup.id;

      // If another window has a group with the same title, rename ours
      const hasDuplicate = allGroups.some(g =>
        g.id !== existingGroup.id && g.title === existingGroup.title
      );

      if (hasDuplicate) {
        const takenNumbers = allGroups
          .filter(g => g.id !== existingGroup.id)
          .map(g => parseGroupTitle(g.title))
          .filter(p => p !== null && p.groupName === rule.groupName)
          .map(p => p.number);

        let num = 1;
        while (takenNumbers.includes(num)) num++;

        await chrome.tabGroups.update(groupId, {
          title: buildGroupTitle(rule.groupName, num)
        });
      }

      await chrome.tabs.group({ tabIds: tabId, groupId: groupId });
    } else {
      const takenNumbers = allGroups
        .map(g => parseGroupTitle(g.title))
        .filter(p => p !== null && p.groupName === rule.groupName)
        .map(p => p.number);

      let num = 1;
      while (takenNumbers.includes(num)) num++;

      groupId = await chrome.tabs.group({
        tabIds: tabId,
        createProperties: { windowId: windowId }
      });
      await chrome.tabGroups.update(groupId, {
        title: buildGroupTitle(rule.groupName, num),
        color: rule.color
      });
    }

    await moveUngroupedTabsToEnd(windowId);
  } catch (error) {
    console.error('[Auto Tab Grouper] Grouping failed:', error);
  }
}

// Move ungrouped tabs to the right side of the tab bar,
// keeping grouped tabs on the left
async function moveUngroupedTabsToEnd(windowId) {
  const tabs = await chrome.tabs.query({ windowId });
  const ungroupedTabs = tabs
    .filter(t => !t.pinned && t.groupId === -1)
    .sort((a, b) => a.index - b.index);

  if (ungroupedTabs.length === 0) return;

  await chrome.tabs.move(
    ungroupedTabs.map(t => t.id),
    { index: -1 }
  );
}
