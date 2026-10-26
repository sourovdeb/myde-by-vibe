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
      // Defense-in-depth: only accept execute_js from the extension's own background script.
      // Messages from web pages (via window.DoubleControl.sendMessage) arrive at the
      // background, not here — but validate anyway in case of forwarding bugs.
      if (sender.id !== chrome.runtime.id) {
        sendResponse({ success: false, error: 'Unauthorized sender: ' + (sender.id || 'unknown') });
        return true;
      }
      try {
        // Use Function constructor instead of window.eval — same page-context execution
        // but avoids the eval-specific CSP restrictions and is slightly more contained.
        const fn = new Function('return (' + request.code + ')');
        const result = fn();
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
