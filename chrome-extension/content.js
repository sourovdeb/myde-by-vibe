// Double Control Extension - Content Script
// Injected into pages to enable communication

(function() {
  'use strict';
  
  // Check if this script is already injected
  if (window.__doubleControlInjected) {
    return;
  }
  window.__doubleControlInjected = true;
  
  console.log('Double Control content script injected');
  
  // Listen for messages from the background service worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    if (request.type === 'execute_js') {
      try {
        const result = window.eval(request.code);
        sendResponse({ success: true, result: result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      return true; // Keep the message channel open for async response
    }
    
    if (request.type === 'get_page_info') {
      sendResponse({
        title: document.title,
        url: window.location.href,
        width: window.innerWidth,
        height: window.innerHeight
      });
    }
  });
  
  // Expose API to the page
  window.DoubleControl = {
    sendMessage: function(message) {
      chrome.runtime.sendMessage(message);
    },
    getPageInfo: function() {
      return {
        title: document.title,
        url: window.location.href,
        width: window.innerWidth,
        height: window.innerHeight
      };
    }
  };
  
  console.log('Double Control API available as window.DoubleControl');
})();
