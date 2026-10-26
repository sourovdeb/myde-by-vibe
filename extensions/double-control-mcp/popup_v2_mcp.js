// Double Control v2 popup logic. Talks to the background service worker.
// It NEVER sees or stores the raw key - only a length/status is shown.
(function () {
  const $ = (id) => document.getElementById(id);
  const status = $('status');

  function flash(msg, err = false) {
    status.textContent = msg || '';
    status.style.color = err ? '#d32f2f' : '#2e7d32';
    if (msg) setTimeout(() => { if (status.textContent === msg) status.textContent = ''; }, 6000);
  }
  function send(msg) {
    return chrome.runtime.sendMessage(msg).catch(e => ({ error: String(e.message || e) }));
  }

  // ---- Tabs ----
  async function loadTabs() {
    const r = await send({ cmd: 'tabs' });
    const list = $('tabsList'); list.innerHTML = '';
    (r.tabs || []).forEach(t => {
      const d = document.createElement('div');
      d.className = 'tab-item' + (t.active ? ' active' : '');
      d.innerHTML = '<div class="tab-title"></div><div class="tab-url"></div>';
      d.querySelector('.tab-title').textContent = t.title || '(no title)';
      d.querySelector('.tab-url').textContent = t.url || '';
      d.addEventListener('click', () => { send({ cmd: 'tab_switch', id: t.id }); window.close(); });
      list.appendChild(d);
    });
  }
  $('refreshBtn').addEventListener('click', loadTabs);
  $('openBtn').addEventListener('click', () => {
    const u = $('openUrl').value.trim(); if (!u) return;
    send({ cmd: 'tab_open', url: u }).then(r => flash(r.ok ? 'Opened tab' : 'Error: ' + r.error, !r.ok));
  });

  // ---- Key ----
  async function keyStatus() {
    const r = await send({ cmd: 'key_status' });
    $('keyStatus').textContent = r.present
      ? `Mistral key set locally (length ${r.len}). Stored only in chrome.storage.local - not committed.`
      : 'No Mistral key set. Paste it once above to enable embedding.';
  }
  $('keySet').addEventListener('click', () => {
    const k = $('keyInput').value.trim();
    if (!k) { flash('Nothing to save.', true); return; }
    send({ cmd: 'key_set', key: k }).then(r => {
      $('keyInput').value = ''; keyStatus();
      flash(r.ok ? 'Key saved locally (length ' + r.len + ').' : 'Error: ' + r.error, !r.ok);
    });
  });

  // ---- WordPress credentials (added 2026-10-24): stored only in chrome.storage.local; never echoed) ----
  async function wpStatus() {
    const r = await send({ cmd: 'wp_cred_status' });
    $('wpStatus').textContent = r.present
      ? `WordPress credentials set for ${r.site || '(unknown site)'} (application password length ${r.len}). Stored only in chrome.storage.local - not committed.`
      : 'No WordPress credentials set. Add site URL + application password once to enable WP REST calls from the extension.';
  }
  $('wpSet').addEventListener('click', () => {
    const site = $('wpSite').value.trim(), user = $('wpUser').value.trim(), pass = $('wpPass').value;
    if (!site || !pass) { flash('Site URL and application password are required.', true); return; }
    send({ cmd: 'wp_cred_set', site, user, pass }).then(r => {
      $('wpPass').value = ''; wpStatus();
      flash(r.ok ? ('WordPress credentials saved locally for ' + r.site + '.') : ('Error: ' + r.error), !r.ok);
    });
  });

  // ---- MCP health ----
  const SERVERS = ['system', 'chrome', 'opera', 'firefox', 'tunnel'];
  async function loadHealth() {
    const r = await send({ cmd: 'mcp_health' });
    const wrap = $('endpoints'); wrap.innerHTML = '';
    (r.endpoints || []).forEach(e => {
      const row = document.createElement('div'); row.className = 'ep';
      const left = document.createElement('span');
      left.innerHTML = `<span class="dot ${e.alive ? 'on' : 'off'}"></span>`;
      const name = document.createElement('span');
      name.textContent = `${e.server} ${e.alive ? '● up' : '○ down'}`;
      const right = document.createElement('span'); right.className = 'muted';
      right.textContent = e.alive ? ('status ' + e.status) : (e.error || 'no response');
      left.append(name); row.append(left, right); wrap.appendChild(row);
    });
    // fill the tool-server selector
    const sel = $('toolServer'); sel.innerHTML = '';
    SERVERS.forEach(s => {
      const o = document.createElement('option'); o.value = s; o.textContent = s; sel.appendChild(o);
    });
  }
  $('healthBtn').addEventListener('click', () => { loadHealth().catch(e => flash(String(e.message || e), true)); });

  function paintBridge(which, r) {
    const dot = $(which === 'latch' ? 'latchDot' : 'bridgeDot');
    const meta = $(which === 'latch' ? 'latchMeta' : 'bridgeMeta');
    dot.className = 'dot ' + (r.alive ? 'on' : 'off');
    const n = r.toolCount != null ? r.toolCount + ' tools' : 'tools unknown';
    meta.textContent = (r.alive ? 'UP' : 'down') + ' · calls ' + (r.callsOn ? 'on' : 'off') + ' · ' + n;
    const lines = [
      r.label + ' ' + (r.alive ? 'UP' : 'down'),
      'calls ' + (r.callsOn ? 'on' : 'off'),
      r.http != null ? 'http ' + r.http : '',
      r.initStatus != null ? 'initialize ' + r.initStatus : '',
      r.toolCount != null ? 'tools ' + r.toolCount : '',
      (r.tools || []).join(', '),
      r.error || r.rpcError || ''
    ].filter(Boolean);
    $('bridgeOut').textContent = lines.join('\n');
  }
  async function probe(which) {
    const r = await send({ cmd: 'local_bridge_status', which });
    paintBridge(which, r);
    return r;
  }
  $('latchDebug').addEventListener('click', () => probe('latch').catch(e => flash(String(e), true)));
  $('bridgeDebug').addEventListener('click', () => probe('mcpBridge').catch(e => flash(String(e), true)));
  function setCalls(which, on) {
    send({ cmd: 'local_bridge_set', which, on }).then(() => probe(which));
  }
  $('latchOff').addEventListener('click', () => setCalls('latch', false));
  $('latchOn').addEventListener('click', () => setCalls('latch', true));
  $('bridgeOff').addEventListener('click', () => setCalls('mcpBridge', false));
  $('bridgeOn').addEventListener('click', () => setCalls('mcpBridge', true));
  $('openBridgeAdmin').addEventListener('click', () => send({ cmd: 'tab_open', url: 'http://127.0.0.1:8766/' }));
  $('openPr3').addEventListener('click', () => send({ cmd: 'tab_open', url: 'https://github.com/sourovdeb/myde-by-vibe/pull/3' }));
  probe('latch'); probe('mcpBridge');

  // ---- MCP tools ----
  $('toolsBtn').addEventListener('click', async () => {
    const s = $('toolServer').value;
    $('toolList').textContent = 'Contacting ' + s + ' ...';
    const r = await send({ cmd: 'mcp_tools', server: s });
    if (r.error) { $('toolList').textContent = 'Error: ' + r.error; return; }
    $('toolList').textContent = (r.tools || []).length + ' tools:';
    (r.tools || []).forEach(t => {
      const d = document.createElement('div'); d.className = 'muted';
      d.textContent = '• ' + t.name + (t.desc ? ' - ' + t.desc : '');
      $('toolList').appendChild(d);
    });
  });

  // ---- Embed ----
  function showVector(out, label) {
    const el = $('embedOut');
    if (out.error) { el.textContent = 'Error: ' + out.error; el.className = 'muted'; el.style.color = '#d32f2f'; return; }
    const v = out.vectors || [out.a];
    const dim = out.dim || v[0]?.length || 0;
    const sample = (arr) => arr.slice(0, 6).map(x => x.toFixed(4)).join(', ') + ' …';
    let html = '';
    if (label === 'compare') {
      html = `<b>${out.model}</b> · similarity = <b>${out.similarity?.toFixed(4)}</b><br>
        A: ${sample(out.a)}<br>B: ${sample(out.b)}`;
    } else if (out.result) {
      const rr = out.result;
      html = `<b>${rr.model}</b> · dim ${rr.dim} · ${rr.vectors.length} vector(s)${out.title ? '<br>page: ' + out.title : ''}`;
    } else {
      html = `<b>${v && v[0] ? (out.model || '') : ''}</b> · dim ${dim}<br>${sample(v[0])}`;
    }
    el.innerHTML = html; el.style.color = ''; 
  }
  $('embedBtn').addEventListener('click', async () => {
    const text = $('embedText').value.trim();
    if (!text) { flash('Enter text first.', true); return; }
    const r = await send({ cmd: 'embed', texts: [text], model: $('embedModel').value });
    showVector(r, 'embed');
  });
  $('pageBtn').addEventListener('click', async () => {
    flash('Embedding active page…');
    const r = await send({ cmd: 'embed_active_page', model: $('embedModel').value });
    if (r.error) { flash(r.error, true); return; }
    showVector({ model: $('embedModel').value, result: r.result, title: r.title }, 'page');
  });

  // ---- Similar tabs (semantic search via embeddings) ----
  $('simBtn').addEventListener('click', async () => {
    const q = $('simQuery').value.trim();
    if (!q) { flash('Enter a query first.', true); return; }
    const out = $('simOut'); out.textContent = 'Searching tabs…'; out.style.color = '';
    const r = await send({ cmd: 'find_similar_tabs', query: q, model: $('embedModel').value, threshold: parseFloat($('simThresh').value) || 0.7, limit: parseInt($('simLimit').value) || 10 });
    if (r.error) { out.textContent = 'Error: ' + r.error; out.style.color = '#d32f2f'; return; }
    const tabs = r.tabs || [];
    out.innerHTML = '<b>' + tabs.length + ' similar tab(s)</b> · model ' + (r.model || '') + ' · ≥ ' + (r.threshold ?? '');
    tabs.forEach(t => {
      const d = document.createElement('div'); d.className = 'tab-item';
      d.innerHTML = '<div class="tab-title"></div><div class="tab-url"></div>';
      d.querySelector('.tab-title').textContent = '(' + t.sim + ') ' + (t.title || '(no title)');
      d.querySelector('.tab-url').textContent = t.url || '';
      d.addEventListener('click', () => { send({ cmd: 'tab_switch', id: t.id }); });
      out.appendChild(d);
    });
  });

  // ---- Remote debug ----
  $('rdCheck').addEventListener('click', async () => {
    const r = await send({ cmd: 'check_remote_debug' });
    const out = $('rdOut');
    out.textContent = r.open ? ('CDP port 9222 is OPEN. ' + (r.info || '')) : ('CDP port 9222 is CLOSED. ' + (r.note || ''));
    out.style.color = r.open ? '#2e7d32' : '#d32f2f';
  });
  $('rdLaunch').addEventListener('click', async () => {
    const r = await send({ cmd: 'launch_chrome_debug' });
    const pre = $('rdCmd'); pre.style.display = 'block'; pre.textContent = r.command || '';
    $('rdOut').textContent = r.note || ''; $('rdOut').style.color = '#666';
  });

  // ---- AI Agents ----
  const CAPABILITIES = ['browser_automation', 'embeddings', 'code_generation', 'wordpress_management', 'code_completion', 'file_io'];
  
  async function loadAgents() {
    const r = await send({ cmd: 'discover_agents' });
    const list = $('agentsList'); list.innerHTML = '';
    const agents = r.agents || {};
    
    if (Object.keys(agents).length === 0) {
      list.innerHTML = '<div class="muted">No agents discovered yet.</div>';
      return;
    }
    
    const filter = $('capabilityFilter').value;
    const filteredAgents = filter 
      ? Object.values(agents).filter(a => a.capabilities && a.capabilities.includes(filter))
      : Object.values(agents);
    
    filteredAgents.forEach(agent => {
      const d = document.createElement('div');
      d.className = 'tab-item';
      d.innerHTML = '<div class="tab-title"></div><div class="tab-url"></div>';
      d.querySelector('.tab-title').textContent = `${agent.name || agent.id} - ${agent.status || 'unknown'}`;
      d.querySelector('.tab-url').textContent = `Port: ${agent.port || 'N/A'} | Capabilities: ${(agent.capabilities || []).join(', ').slice(0, 80)}`;
      d.style.background = agent.status === 'connected' ? '#e8f5e9' : '#fff3e0';
      list.appendChild(d);
    });
    
    $('agentsStatus').textContent = `${Object.keys(agents).length} agent(s) discovered - ${Object.values(agents).filter(a => a.status === 'connected').length} connected`;
  }
  
  $('agentsDiscover').addEventListener('click', () => {
    flash('Discovering agents...');
    send({ cmd: 'discover_agents' }).then(r => {
      flash(r.agents ? Object.keys(r.agents).length + ' agents discovered' : 'Error: ' + r.error, !r.agents);
      loadAgents();
    });
  });
  
  $('agentsRefresh').addEventListener('click', () => {
    flash('Refreshing agents...');
    send({ cmd: 'discover_agents' }).then(r => {
      flash(r.agents ? Object.keys(r.agents).length + ' agents refreshed' : 'Error: ' + r.error, !r.agents);
      loadAgents();
    });
  });
  
  $('capabilityFilter').addEventListener('change', loadAgents);

  // ---- init ----
  loadTabs(); keyStatus(); wpStatus(); loadHealth().catch(() => {}); loadAgents().catch(() => {});
})();
