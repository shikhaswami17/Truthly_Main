// Background service worker for Truthly extension

chrome.runtime.onInstalled.addListener(() => {
  console.log('Truthly Extension installed');
  
  // Set default settings
  chrome.storage.sync.set({
    enabled: true,
    serverUrl: 'http://localhost:5000',
    frontendUrl: 'http://localhost:3000',
    autoAnalyze: true,
    cacheResults: true
  });
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Toggle extension on/off or open popup
  if (tab.url.includes('google.com/search')) {
    // Refresh the current tab to re-run content script
    chrome.tabs.reload(tab.id);
  }
});

// Message handling for communication between content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSettings') {
    chrome.storage.sync.get(['enabled', 'serverUrl', 'frontendUrl', 'autoAnalyze'], (result) => {
      sendResponse(result);
    });
    return true; // Will respond asynchronously
  }

  if (request.action === 'updateSettings') {
    chrome.storage.sync.set(request.settings, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'clearCache') {
    chrome.storage.local.clear(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.type === 'OPEN_DETAILS') {
    const truthlyUrl = `http://localhost:3000/result?url=${encodeURIComponent(request.url)}`;
    chrome.tabs.create({ url: truthlyUrl });
  }
});

// Optional: Add context menu items
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'checkFactsTruthly',
    title: 'Check facts with Truthly',
    contexts: ['selection', 'link']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'checkFactsTruthly') {
    let url = info.linkUrl || info.selectionText;
    if (url) {
      // Open Truthly analysis page
      const truthlyUrl = `http://localhost:3000/result?url=${encodeURIComponent(url)}`;
      chrome.tabs.create({ url: truthlyUrl });
    }
  }
});
