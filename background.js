// Double Control Extension - Background Service Worker
let tabsCache = [];

async function updateTabCache() {
  try {
    const tabs = await chrome.tabs.query({});
    tabsCache = tabs;
    console.log('Tab cache updated:', tabsCache.length, 'tabs');
  } catch (error) {
    console.error('Error updating tab cache:', error);
  }
}

// External message port
let externalPort = null;

chrome.runtime.onConnectExternal.addListener((port) => {
  console.log('External connection established:', port.sender);
  externalPort = port;
  
  port.postMessage({
    type: 'connected',
    tabs: tabsCache.map(t => ({
      id: t.id,
      title: t.title,
      url: t.url,
      active: t.active,
      windowId: t.windowId
    }))
  });
  
  port.onMessage.addListener((msg) => {
    console.log('Received message from external:', msg);
    
    if (msg.type === 'get_tabs') {
      port.postMessage({
        type: 'tabs',
        tabs: tabsCache.map(t => ({
          id: t.id,
          title: t.title,
          url: t.url,
          active: t.active,
          windowId: t.windowId
        }))
      });
    }
    
    if (msg.type === 'open_tab') {
      chrome.tabs.create({ url: msg.url }, (tab) => {
        port.postMessage({ type: 'tab_opened', tab: tab });
      });
    }
    
    if (msg.type === 'close_tab') {
      chrome.tabs.remove(msg.tabId, () => {
        port.postMessage({ type: 'tab_closed', tabId: msg.tabId });
      });
    }
    
    if (msg.type === 'switch_tab') {
      chrome.tabs.update(msg.tabId, { active: true }, (tab) => {
        port.postMessage({ type: 'tab_switched', tab: tab });
      });
    }
  });
  
  port.onDisconnect.addListener(() => {
    console.log('External connection closed');
    externalPort = null;
  });
});

// Tab events
chrome.tabs.onCreated.addListener(updateTabCache);
chrome.tabs.onUpdated.addListener(updateTabCache);
chrome.tabs.onRemoved.addListener(updateTabCache);
chrome.tabs.onActivated.addListener(updateTabCache);

// Initial cache update
updateTabCache();
setInterval(updateTabCache, 5000);

console.log('Double Control Extension background service worker loaded');
