// Auto Tab Grouper - Background Service Worker

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
    const isOurGroup = rules.some(r => r.groupName === group.title);
    if (isOurGroup) {
      await chrome.tabs.ungroup(tabId);
    }
  } catch (error) {
    console.error('[Auto Tab Grouper] Ungrouping failed:', error);
  }
}

async function applyGrouping(tabId, windowId, rule) {
  try {
    const existingGroups = await chrome.tabGroups.query({
      title: rule.groupName,
      windowId: windowId
    });

    let groupId;

    if (existingGroups.length > 0) {
      groupId = existingGroups[0].id;

      // Skip if another tab from the same domain is already in this group
      const tabsInGroup = await chrome.tabs.query({ groupId: groupId });
      const alreadyHasDomain = tabsInGroup.some(t => {
        if (t.id === tabId) return false;
        try { return new URL(t.url).hostname === rule.host; }
        catch { return false; }
      });
      if (alreadyHasDomain) return;

      await chrome.tabs.group({ tabIds: tabId, groupId: groupId });
    } else {
      groupId = await chrome.tabs.group({
        tabIds: tabId,
        createProperties: { windowId: windowId }
      });
      await chrome.tabGroups.update(groupId, {
        title: rule.groupName,
        color: rule.color
      });
    }
  } catch (error) {
    console.error('[Auto Tab Grouper] Grouping failed:', error);
  }
}
