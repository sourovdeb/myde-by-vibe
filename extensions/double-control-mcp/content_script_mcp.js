// Double Control v2 content script - runs on all pages (document_end).
// Exposes the documented global API surface (window.DCMCP + console.dcmcp) that
// MCP_ENHANCEMENT_README.md promises. All real work is delegated to the
// background service worker via chrome.runtime.sendMessage. Nothing secret is
// held here; the Mistral key lives only in chrome.storage.local.
(function () {
  if (window.__DC_CONTENT_LOADED__) return;
  window.__DC_CONTENT_LOADED__ = true;

  const post = (msg) => new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res) => resolve(res || {}));
  });

  // Legacy page-text grab (used by background "embed_active_page").
  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (msg && msg.cmd === 'page_text') {
      const text = (document.body?.innerText || '').replace(/\n{3,}/g, '\n\n').slice(0, 60000);
      sendResponse({ title: document.title, url: location.href, text });
    }
    if (msg && msg.cmd === 'dc_ping') sendResponse({ pong: true, ext: 'double-control', version: '2.0.0' });
    return true;
  });

  // ---------------------------------------------------------------------------
  // window.DCMCP  (documented in MCP_ENHANCEMENT_README.md)
  // ---------------------------------------------------------------------------
  const client = {
    listMcpTools: (server) => post({ cmd: 'mcp_tools', server }).then(r => r.tools || []),
    callMcpTool: (server, tool, args = {}) => post({ cmd: 'mcp_call', server, tool, args }).then(r => r.result),

    getEmbedding: async (text, model = 'mistral-embed-2312') => {
      const r = await post({ cmd: 'embed', texts: [text], model });
      if (r.error) throw new Error(r.error);
      return r.result.vectors[0];
    },
    findSimilarTabs: (query, options = {}) => post({
      cmd: 'find_similar_tabs',
      query,
      model: options.model || 'mistral-embed-2312',
      threshold: options.threshold ?? 0.7,
      limit: options.limit ?? 10
    }).then(r => r.tabs || []),

    getTabs: () => post({ cmd: 'tabs' }).then(r => r.tabs || []),
    switchTab: (tabId) => post({ cmd: 'tab_switch', id: tabId }),
    closeTab: (tabId) => post({ cmd: 'tab_close', id: tabId }),
    newTab: (url) => post({ cmd: 'tab_open', url }).then(r => ({})),
    refreshTabs: () => post({ cmd: 'tabs_refresh' }),

    checkRemoteDebugPort: () => post({ cmd: 'check_remote_debug' }).then(r => r.open === true),
    launchChromeWithDebug: () => post({ cmd: 'launch_chrome_debug' })
  };

  window.DCMCP = {
    client,
    ready: async () => { const r = await post({ cmd: 'ping' }); return r.ok === true; }
  };

  // Documented console shortcuts.
  window.console.dcmcp = {
    tabs: {
      get: () => client.getTabs(),
      switch: (id) => client.switchTab(id),
      close: (id) => client.closeTab(id),
      new: (url) => client.newTab(url),
      refresh: () => client.refreshTabs()
    },
    embedding: {
      get: (text, model) => client.getEmbedding(text, model),
      findSimilar: (query, opts) => client.findSimilarTabs(query, opts)
    },
    mcp: {
      listTools: (server) => client.listMcpTools(server),
      callTool: (server, tool, args) => client.callMcpTool(server, tool, args)
    }
  };
})();
