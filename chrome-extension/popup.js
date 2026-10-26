// Double Control Extension v2.0.0 - Popup JavaScript
// Tabs + MCP 3000/3001 health + Latch MCP 3939 health + tool list

document.addEventListener('DOMContentLoaded', function() {
  // ---- Tabs ----
  const tabsList = document.getElementById('tabsList');
  const statusDiv = document.getElementById('status');
  const refreshBtn = document.getElementById('refreshBtn');

  function updateTabsDisplay(tabs) {
    if (!tabs || tabs.length === 0) {
      statusDiv.textContent = 'No tabs open';
      tabsList.innerHTML = '<div class="tab-item">No tabs found</div>';
      return;
    }
    statusDiv.textContent = `${tabs.length} tab(s) open`;
    tabsList.innerHTML = '';
    tabs.forEach(tab => {
      const tabItem = document.createElement('div');
      tabItem.className = 'tab-item' + (tab.active ? ' active' : '');
      const titleDiv = document.createElement('div');
      titleDiv.className = 'tab-title';
      titleDiv.textContent = tab.title || '(No title)';
      const urlDiv = document.createElement('div');
      urlDiv.className = 'tab-url';
      urlDiv.textContent = tab.url || '';
      tabItem.appendChild(titleDiv);
      tabItem.appendChild(urlDiv);
      tabItem.addEventListener('click', () => {
        chrome.tabs.update(tab.id, { active: true });
        window.close();
      });
      tabsList.appendChild(tabItem);
    });
  }

  function getTabs() {
    chrome.tabs.query({}, function(tabs) { updateTabsDisplay(tabs); });
  }
  getTabs();
  refreshBtn.addEventListener('click', getTabs);

  // ---- Remote Debugging shortcut ----
  document.getElementById('remoteDebugBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://inspect/#remote-debugging' });
    window.close();
  });

  // ---- MCP 3000/3001 health ----
  const mcpStatus = document.getElementById('mcpStatus');
  async function checkMcp() {
    const results = await Promise.all([
      fetch('http://localhost:3000/health', { signal: AbortSignal.timeout(4000) })
        .then(r => r.ok).catch(() => false),
      fetch('http://localhost:3001/health', { signal: AbortSignal.timeout(4000) })
        .then(r => r.ok ? r.json() : false).catch(() => false)
    ]);
    const s3000 = results[0] ? 'UP' : 'DOWN';
    const s3001 = results[1] ? ('UP' + (results[1].chromeConnected ? ' +chrome' : ' NO-chrome')) : 'DOWN';
    mcpStatus.textContent = `MCP 3000: ${s3000} | MCP 3001: ${s3001}`;
    mcpStatus.className = 'mcp-status ' + (results[0] && results[1] ? 'mcp-ok' : 'mcp-down');
  }
  checkMcp();

  // ---- Latch MCP 3939 health + tools ----
  const latchStatus = document.getElementById('latchStatus');
  const latchTunnel = document.getElementById('latchTunnel');
  const latchTools = document.getElementById('latchTools');
  const latchRefreshBtn = document.getElementById('latchRefreshBtn');
  const openPanelBtn = document.getElementById('openPanelBtn');

  async function checkLatch() {
    // Health: POST tools/list to /mcp/mistral
    try {
      const resp = await fetch('http://127.0.0.1:3939/mcp/mistral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
        signal: AbortSignal.timeout(5000)
      });
      if (resp.ok) {
        const data = await resp.json();
        const tools = (data.result && data.result.tools) || [];
        latchStatus.textContent = `Latch MCP: UP (${tools.length} tools)`;
        latchStatus.className = 'mcp-status mcp-ok';
        // Show tool names
        if (tools.length > 0) {
          latchTools.style.display = 'block';
          latchTools.innerHTML = '';
          tools.forEach(t => {
            const div = document.createElement('div');
            div.textContent = t.name;
            latchTools.appendChild(div);
          });
        }
      } else {
        latchStatus.textContent = 'Latch MCP: responded with error';
        latchStatus.className = 'mcp-status mcp-down';
      }
    } catch (e) {
      latchStatus.textContent = 'Latch MCP: DOWN (port 3939)';
      latchStatus.className = 'mcp-status mcp-down';
      latchTools.style.display = 'none';
    }

    // Read tunnel URL from status.json via fetch to the panel API (if available)
    try {
      const panelResp = await fetch('http://127.0.0.1:3939/panel', {
        signal: AbortSignal.timeout(3000)
      });
      // Panel requires token; we just check if it's alive
      if (panelResp.ok || panelResp.status === 401 || panelResp.status === 403) {
        // Try to read status.json via the file share or just show the known URL
      }
    } catch (e) { /* panel may need token */ }

    // Show tunnel URL from chrome.storage (saved by background or previous check)
    chrome.storage.local.get(['latchTunnelUrl'], (result) => {
      if (result.latchTunnelUrl) {
        latchTunnel.textContent = 'Tunnel: ' + result.latchTunnelUrl;
      }
    });
  }

  checkLatch();
  latchRefreshBtn.addEventListener('click', checkLatch);

  // Open Latch panel in a new tab
  openPanelBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://127.0.0.1:3939/panel' });
    window.close();
  });

  // ---- Auto-refresh ----
  setInterval(getTabs, 2000);
  setInterval(checkMcp, 5000);
  setInterval(checkLatch, 10000);
});
