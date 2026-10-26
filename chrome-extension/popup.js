// Double Control Extension v2.1.0 - Popup JavaScript
// Tabs + MCP 3000/3001 health + Latch MCP 3939 toggle + debug + Gateway 3002

document.addEventListener('DOMContentLoaded', function() {
  // ============================================================
  // Tabs
  // ============================================================
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

  // Remote Debugging shortcut
  document.getElementById('remoteDebugBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://inspect/#remote-debugging' });
    window.close();
  });

  // ============================================================
  // MCP 3000/3001 health
  // ============================================================
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

  // ============================================================
  // Gateway token management
  // ============================================================
  const gatewayTokenInput = document.getElementById('gatewayToken');
  const saveTokenBtn = document.getElementById('saveTokenBtn');
  const testGatewayBtn = document.getElementById('testGatewayBtn');
  const gatewayStatus = document.getElementById('gatewayStatus');

  // Load saved token
  chrome.storage.local.get(['gatewayAuthToken'], (result) => {
    if (result.gatewayAuthToken) {
      gatewayTokenInput.value = result.gatewayAuthToken;
      gatewayTokenInput.type = 'password';
    }
  });

  saveTokenBtn.addEventListener('click', () => {
    const token = gatewayTokenInput.value.trim();
    if (token) {
      chrome.storage.local.set({ gatewayAuthToken: token }, () => {
        gatewayStatus.textContent = 'Token saved (' + token.length + ' chars)';
        gatewayStatus.style.color = '#2e7d32';
      });
    }
  });

  function getGatewayToken() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['gatewayAuthToken'], (result) => {
        resolve(result.gatewayAuthToken || '');
      });
    });
  }

  // Call gateway MCP tool
  async function callGatewayTool(toolName, args) {
    const token = await getGatewayToken();
    if (!token) throw new Error('No gateway token saved');
    const resp = await fetch('http://localhost:3002/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        jsonrpc: '2.0', id: Date.now(), method: 'tools/call',
        params: { name: toolName, arguments: args }
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!resp.ok) throw new Error('Gateway HTTP ' + resp.status);
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || 'MCP error');
    return data.result;
  }

  // Check gateway health (no auth needed)
  async function checkGateway() {
    try {
      const resp = await fetch('http://localhost:3002/health', { signal: AbortSignal.timeout(4000) });
      if (resp.ok) {
        const data = await resp.json();
        const upstreams = Object.entries(data.upstreamServers || {})
          .map(([k, v]) => `${k}:${v}`).join(' ');
        gatewayStatus.textContent = `Gateway: ${data.status} | ${data.nativeTools} native tools | ${upstreams}`;
        gatewayStatus.style.color = '#2e7d32';
      } else {
        gatewayStatus.textContent = 'Gateway: HTTP ' + resp.status;
        gatewayStatus.style.color = '#c62828';
      }
    } catch (e) {
      gatewayStatus.textContent = 'Gateway: DOWN (port 3002)';
      gatewayStatus.style.color = '#c62828';
    }
  }
  checkGateway();

  testGatewayBtn.addEventListener('click', async () => {
    gatewayStatus.textContent = 'Testing gateway...';
    try {
      const result = await callGatewayTool('system_info', {});
      const text = result.content?.[0]?.text || JSON.stringify(result);
      gatewayStatus.textContent = 'Gateway OK: ' + text.slice(0, 100);
      gatewayStatus.style.color = '#2e7d32';
    } catch (e) {
      gatewayStatus.textContent = 'Gateway test failed: ' + e.message;
      gatewayStatus.style.color = '#c62828';
    }
  });

  // ============================================================
  // Latch MCP 3939 — health + toggle + debug
  // ============================================================
  const latchStatus = document.getElementById('latchStatus');
  const latchTunnel = document.getElementById('latchTunnel');
  const latchTools = document.getElementById('latchTools');
  const latchRefreshBtn = document.getElementById('latchRefreshBtn');
  const latchDebugBtn = document.getElementById('latchDebugBtn');
  const openPanelBtn = document.getElementById('openPanelBtn');
  const latchToggle = document.getElementById('latchToggle');
  const latchToggleStatus = document.getElementById('latchToggleStatus');
  const latchDebugPanel = document.getElementById('latchDebugPanel');

  let latchRunning = false;
  let latchToolCount = 0;

  function debugLog(msg, type) {
    const line = document.createElement('div');
    line.className = type || '';
    const ts = new Date().toLocaleTimeString();
    line.textContent = `[${ts}] ${msg}`;
    latchDebugPanel.appendChild(line);
    latchDebugPanel.scrollTop = latchDebugPanel.scrollHeight;
  }

  function toggleDebugPanel() {
    latchDebugPanel.classList.toggle('visible');
    if (latchDebugPanel.classList.contains('visible')) {
      latchDebugBtn.textContent = 'Hide Debug';
    } else {
      latchDebugBtn.textContent = 'Debug';
    }
  }

  async function checkLatch() {
    latchToggleStatus.textContent = 'checking...';
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
        latchRunning = true;
        latchToolCount = tools.length;
        latchStatus.textContent = `Latch MCP: UP (${tools.length} tools)`;
        latchStatus.className = 'mcp-status mcp-ok';
        latchToggle.className = 'toggle-switch on';
        latchToggleStatus.textContent = 'ON — running';
        latchToggleStatus.style.color = '#2e7d32';

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
        throw new Error('HTTP ' + resp.status);
      }
    } catch (e) {
      latchRunning = false;
      latchToolCount = 0;
      latchStatus.textContent = 'Latch MCP: DOWN (port 3939)';
      latchStatus.className = 'mcp-status mcp-down';
      latchToggle.className = 'toggle-switch';
      latchToggleStatus.textContent = 'OFF — stopped';
      latchToggleStatus.style.color = '#c62828';
      latchTools.style.display = 'none';
    }

    // Tunnel URL
    chrome.storage.local.get(['latchTunnelUrl'], (result) => {
      if (result.latchTunnelUrl) {
        latchTunnel.textContent = 'Tunnel: ' + result.latchTunnelUrl;
      }
    });
  }

  // Toggle: start/stop Latch via gateway
  latchToggle.addEventListener('click', async () => {
    latchToggle.disabled = true;
    latchToggleStatus.textContent = 'working...';

    if (latchRunning) {
      // STOP Latch — gateway manage_process stop by name
      debugLog('Stopping Latch MCP (name: latch)...', 'debug-info');
      try {
        const result = await callGatewayTool('manage_process', {
          action: 'stop', name: 'latch'
        });
        const text = result.content?.[0]?.text || JSON.stringify(result);
        debugLog('Stop result: ' + text.slice(0, 200), 'debug-ok');
      } catch (e) {
        debugLog('Stop failed: ' + e.message, 'debug-error');
      }
    } else {
      // START Latch — gateway run_command with start /b (allow-listed)
      debugLog('Starting Latch MCP (latch.exe serve)...', 'debug-info');
      try {
        const result = await callGatewayTool('run_command', {
          command: 'start /b E:\\tools\\latch\\latch.exe serve',
          timeout_ms: 10000
        });
        const text = result.content?.[0]?.text || JSON.stringify(result);
        debugLog('Start result: ' + text.slice(0, 200), 'debug-ok');
      } catch (e) {
        debugLog('Start failed: ' + e.message, 'debug-error');
      }
    }

    // Wait then re-check
    await new Promise(r => setTimeout(r, 3000));
    await checkLatch();
    latchToggle.disabled = false;
  });

  // Debug button
  latchDebugBtn.addEventListener('click', async () => {
    toggleDebugPanel();
    if (!latchDebugPanel.classList.contains('visible')) return;

    latchDebugPanel.innerHTML = '';
    debugLog('=== Latch MCP Debug Session ===', 'debug-info');
    debugLog('Time: ' + new Date().toISOString(), 'debug-info');

    // 1. Port check
    debugLog('--- Port 3939 check ---', 'debug-info');
    try {
      const resp = await fetch('http://127.0.0.1:3939/mcp/mistral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
        signal: AbortSignal.timeout(5000)
      });
      const data = await resp.json();
      const tools = (data.result && data.result.tools) || [];
      debugLog(`HTTP ${resp.status} — ${tools.length} tools found`, 'debug-ok');
      tools.forEach(t => debugLog(`  tool: ${t.name}`, ''));
    } catch (e) {
      debugLog('Port check failed: ' + e.message, 'debug-error');
    }

    // 2. Process info via gateway
    debugLog('--- Process info (via gateway) ---', 'debug-info');
    try {
      const result = await callGatewayTool('manage_process', { action: 'list' });
      const text = result.content?.[0]?.text || JSON.stringify(result);
      // Filter for latch-related processes
      const lines = text.split('\n').filter(l =>
        l.toLowerCase().includes('latch') || l.toLowerCase().includes('3939') || l.toLowerCase().includes('node')
      );
      debugLog(lines.slice(0, 10).join('\n') || text.slice(0, 500), '');
    } catch (e) {
      debugLog('Process info failed: ' + e.message + ' (need gateway token?)', 'debug-error');
    }

    // 3. System info via gateway
    debugLog('--- System info (via gateway) ---', 'debug-info');
    try {
      const result = await callGatewayTool('system_info', {});
      const text = result.content?.[0]?.text || JSON.stringify(result);
      debugLog(text.slice(0, 500), '');
    } catch (e) {
      debugLog('System info failed: ' + e.message, 'debug-error');
    }

    // 4. Test a Latch tool call (list_files)
    debugLog('--- Tool call test: list_files ---', 'debug-info');
    try {
      const resp = await fetch('http://127.0.0.1:3939/mcp/mistral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 2, method: 'tools/call',
          params: { name: 'list_files', arguments: { path: 'E:\\' } }
        }),
        signal: AbortSignal.timeout(8000)
      });
      const data = await resp.json();
      const resultText = data.result?.content?.[0]?.text || JSON.stringify(data.result || data);
      debugLog('list_files result: ' + resultText.slice(0, 300), 'debug-ok');
    } catch (e) {
      debugLog('Tool call failed: ' + e.message, 'debug-error');
    }

    // 5. Gateway proxy test (call Latch through gateway)
    debugLog('--- Gateway proxy test (latch.list_files via 3002) ---', 'debug-info');
    try {
      const result = await callGatewayTool('list_files', { path: 'E:\\' });
      const text = result.content?.[0]?.text || JSON.stringify(result);
      debugLog('Gateway proxy result: ' + text.slice(0, 300), 'debug-ok');
    } catch (e) {
      debugLog('Gateway proxy failed: ' + e.message, 'debug-error');
    }

    debugLog('=== Debug session complete ===', 'debug-info');
  });

  checkLatch();
  latchRefreshBtn.addEventListener('click', checkLatch);

  // Open Latch panel
  openPanelBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://127.0.0.1:3939/panel' });
    window.close();
  });

  // ============================================================
  // Auto-refresh
  // ============================================================
  setInterval(getTabs, 2000);
  setInterval(checkMcp, 5000);
  setInterval(checkLatch, 10000);
  setInterval(checkGateway, 15000);
});
