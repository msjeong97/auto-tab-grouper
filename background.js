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
  if (!rule) return;

  await applyGrouping(tabId, tab.windowId, rule);
});

async function applyGrouping(tabId, windowId, rule) {
  try {
    const existingGroups = await chrome.tabGroups.query({
      title: rule.groupName,
      windowId: windowId
    });

    let groupId;

    if (existingGroups.length > 0) {
      groupId = existingGroups[0].id;
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
