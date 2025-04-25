// Keep track of tabs where the script is active
const activeTabs = new Set();

const defaultIconPaths = {
  "16": "icons/icon16.png",
  "48": "icons/icon48.png",
  "128": "icons/icon128.png"
};

const activeIconPaths = {
  "16": "icons/icon-active16.png",
  "48": "icons/icon-active48.png",
  "128": "icons/icon-active128.png"
};

async function setIconState(tabId, isActive) {
  if (!tabId) return;
  const iconPath = isActive ? activeIconPaths : defaultIconPaths;
  try {
    await chrome.action.setIcon({ tabId: tabId, path: iconPath });
    if (isActive) {
      activeTabs.add(tabId);
    } else {
      activeTabs.delete(tabId);
    }
  } catch (error) {
     activeTabs.delete(tabId);
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await setIconState(tab.id, true);
    } catch (err) {
      await setIconState(tab.id, false);
    }
  } else {
    console.error("Clicked tab has no ID.");
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "scriptInactive" && sender.tab?.id) {
    Promise.resolve(setIconState(sender.tab.id, false));
  }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (activeTabs.has(tabId)) {
    activeTabs.delete(tabId);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (activeTabs.has(tabId) && (changeInfo.status === 'loading' || changeInfo.url)) {
    await setIconState(tabId, false);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) {
       await setIconState(tab.id, false);
    }
  }
   activeTabs.clear();
});